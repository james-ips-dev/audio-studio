import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IncompatiblePatchError } from '../../../core/storageFactory';
import type { InstrumentComponentProps } from '../../../core/types';
import { useTranslation } from '../../../core/useTranslation';
import { ConfirmModal } from '../../../shared-ui/ConfirmModal';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import { LiveStereoWavRecorder } from '../../../shared-ui/WavExporter';
import { RileyModularEngine } from '../audio/RileyModularEngine';
import {
  formatStepNoteName,
  RILEY_SCALES,
  ROOT_NOTE_OPTIONS,
  SCALE_IDS,
} from '../constants/scales';
import {
  cloneRileySongPatch,
  RILEY_FACTORY_SONG_PRESETS,
} from '../constants/songPresets';
import {
  FULL_SYNTH_VOICE_PRESETS,
  ORIGINAL_RILEY_VOICE_PRESETS,
} from '../constants/voicePresets';
import {
  deleteUserPatch,
  exportRileyPatchToJsonFile,
  importRileyPatchFromJsonFile,
  listUserPatches,
  loadRileyAutosaveSnapshot,
  saveRileyAutosaveSnapshot,
  saveUserPatch,
} from '../storage/rileyPatchDB';
import type {
  BiosphereModRate,
  EngineMode,
  FilterMode,
  FullSynthParams,
  LfoDest,
  LfoWave,
  OscWave,
  PatchCable,
  RileyModel,
  RileySongPatch,
  ScaleId,
  VoiceFxSyncRate,
  VoiceTrack,
} from '../types';
import { RackErrorBoundary } from './RackErrorBoundary';
import '../rileyrack.css';

interface CableEndpoints {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

const CABLE_PALETTE = [
  '#F59E0B',
  '#38BDF8',
  '#10B981',
  '#F43F5E',
  '#A855F7',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

const CLOCK_DIV_JACKS = [
  { id: 'clk-div-1', label: '÷1', tipEn: 'Master 16th Clock (Voice Speed)', tipJa: 'マスター16分クロック（各ボイス速度）' },
  { id: 'clk-div-2', label: '÷2', tipEn: 'Half Speed Clock (1/2x)', tipJa: '1/2倍速クロック出力' },
  { id: 'clk-div-3', label: '÷3', tipEn: 'Triplet / Polyrhythm Clock (1/3x)', tipJa: '1/3倍速ポリリズムクロック出力' },
  { id: 'clk-div-5', label: '÷5', tipEn: 'Quintuplet Clock (1/5x)', tipJa: '1/5倍速クロック出力' },
  { id: 'clk-div-7', label: '÷7', tipEn: 'Septuplet Clock (1/7x)', tipJa: '1/7倍速クロック出力' },
];

function buildCatenaryPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const sag = Math.min(110, 24 + dist * 0.22);
  const midX = (x1 + x2) / 2;
  const midY = Math.max(y1, y2) + sag;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const RileyRackContent: React.FC<Partial<InstrumentComponentProps>> = ({
  registerHandle,
}) => {
  const { language, t } = useTranslation();
  const isJa = language === 'ja';

  const [patch, setPatch] = useState<RileySongPatch>(() => {
    const restored = loadRileyAutosaveSnapshot();
    return restored ?? cloneRileySongPatch(RILEY_FACTORY_SONG_PRESETS[0]);
  });

  const [engine] = useState<RileyModularEngine>(
    () => new RileyModularEngine(patch)
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isWavRecording, setIsWavRecording] = useState<boolean>(false);
  const [activeSteps, setActiveSteps] = useState<number[]>([
    0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const [evolveBar, setEvolveBar] = useState<number>(1);
  const [evolveLastEvent, setEvolveLastEvent] = useState<string>(
    isJa ? 'ポリメトリック・フェーズロック待機中' : 'Polymetric Phase Lock Ready'
  );

  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState<number>(0);
  const [userPatches, setUserPatches] = useState<RileySongPatch[]>([]);
  const [hideCables, setHideCables] = useState<boolean>(false);
  const [mixerDrawerOpen, setMixerDrawerOpen] = useState<boolean>(false);

  // Save As Dialog State
  const [saveAsModalOpen, setSaveAsModalOpen] = useState<boolean>(false);
  const [saveAsNameInput, setSaveAsNameInput] = useState<string>('');
  const [activeVoiceTab, setActiveVoiceTab] = useState<'synth' | 'fx'>('synth');
  const [activeVoiceFxTab, setActiveVoiceFxTab] = useState<'echo' | 'delay' | 'flanger' | 'phaser' | 'compressor'>('echo');
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);

  // SVG Patchbay State & Refs
  const rackRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wavRecorderRef = useRef<LiveStereoWavRecorder | null>(null);

  const [activeSourceJack, setActiveSourceJack] = useState<string | null>(null);
  const [danglingSourceCoords, setDanglingSourceCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pointerCoords, setPointerCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [cableLines, setCableLines] = useState<CableEndpoints[]>([]);
  const [svgSize, setSvgSize] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 900,
  });

  const ecoMode = Boolean(patch.ecoMode);

  // Sync patch into engine
  useEffect(() => {
    engine.setPatch(patch);
  }, [engine, patch]);

  // Debounced 1000ms autosave to localStorage ('rileyrack800_autosave_v1')
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveRileyAutosaveSnapshot(patch);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [patch]);

  // Load user patches from IndexedDB ('RileyRack800_DB') on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await listUserPatches();
      if (active) {
        setUserPatches(saved);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Subscribe to Playhead & Evolve telemetry from engine
  useEffect(() => {
    const unsubPlayhead = engine.onPlayhead((update) => {
      setActiveSteps(update.steps);
      setEvolveBar(update.bar);
    });
    const unsubEvolve = engine.onEvolveMutation((mutatedPatch, telemetry) => {
      setPatch(mutatedPatch);
      setEvolveBar(telemetry.currentBar);
      if (telemetry.lastEvent) {
        setEvolveLastEvent(telemetry.lastEvent);
      }
    });
    return () => {
      unsubPlayhead();
      unsubEvolve();
    };
  }, [engine]);

  // Register lifecycle handle with Studio Suite Host Shell & cleanup on unmount
  useEffect(() => {
    if (registerHandle) {
      registerHandle({
        suspendAndCleanup: async () => {
          if (wavRecorderRef.current?.isRecording()) {
            wavRecorderRef.current.dispose();
            setIsWavRecording(false);
          }
          setIsPlaying(false);
          await engine.dispose();
        },
        isAudioActive: () => engine.isEnginePlaying(),
      });
    }
  }, [engine, registerHandle]);

  useEffect(() => {
    return () => {
      if (wavRecorderRef.current?.isRecording()) {
        wavRecorderRef.current.dispose();
      }
      void engine.dispose();
    };
  }, [engine]);

  // Escape key cancels active cable drag
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeSourceJack) {
        setActiveSourceJack(null);
        setDanglingSourceCoords(null);
        setPointerCoords(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSourceJack]);

  // Scroll-Anchored SVG Patchbay Coordinate Calculator (Section 6 Eco Mode: throttled 100ms in Eco Mode)
  const recomputeCablePositions = useCallback(() => {
    const container = rackRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    setSvgSize({
      width: Math.max(container.scrollWidth, container.clientWidth),
      height: Math.max(container.scrollHeight, container.clientHeight),
    });

    const getJackCoords = (
      jackId: string
    ): { x: number; y: number } | null => {
      const el = container.querySelector<HTMLElement>(
        `[data-riley-jack="${jackId}"]`
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left - cRect.left + scrollLeft + r.width / 2,
        y: r.top - cRect.top + scrollTop + r.height / 2,
      };
    };

    const nextLines: CableEndpoints[] = [];
    for (const c of patch.cables) {
      const p1 = getJackCoords(c.from);
      const p2 = getJackCoords(c.to);
      if (p1 && p2) {
        nextLines.push({
          id: c.id,
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          color: c.color,
        });
      }
    }
    setCableLines(nextLines);
  }, [patch.cables]);

  useEffect(() => {
    const container = rackRef.current;
    if (!container) return;

    let throttleTimer: number | null = null;
    const scheduleUpdate = () => {
      if (ecoMode) {
        if (throttleTimer !== null) return;
        throttleTimer = window.setTimeout(() => {
          throttleTimer = null;
          recomputeCablePositions();
        }, 100);
      } else {
        recomputeCablePositions();
      }
    };

    recomputeCablePositions();

    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(container);
    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (throttleTimer !== null) {
        window.clearTimeout(throttleTimer);
      }
      ro.disconnect();
      container.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [recomputeCablePositions, ecoMode, mixerDrawerOpen, selectedVoiceIdx]);

  // Transport Play / Stop
  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      await engine.start();
      setIsPlaying(true);
    }
  }, [engine, isPlaying]);

  // WAV Recording
  const handleToggleWavRecord = useCallback(() => {
    const ctx = engine.ensureContext();
    const tap = engine.getMasterGain();
    if (!ctx || !tap) return;

    if (isWavRecording && wavRecorderRef.current) {
      const safeName = (patch.name || 'rileyrack')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-');
      wavRecorderRef.current.stopAndExport(`rileyrack800-${safeName}`);
      setIsWavRecording(false);
    } else {
      const rec = new LiveStereoWavRecorder(ctx, tap);
      wavRecorderRef.current = rec;
      rec.start();
      setIsWavRecording(true);
    }
  }, [engine, isWavRecording, patch.name]);

  // Patching Jack Interaction
  const handleJackClick = useCallback(
    (
      jackId: string,
      direction: 'out' | 'in',
      e: React.MouseEvent<HTMLButtonElement>
    ) => {
      e.stopPropagation();

      // Shift+Click or Right-click removes any cables attached to this jack
      if (e.shiftKey) {
        setPatch((prev) => ({
          ...prev,
          cables: prev.cables.filter(
            (c) => c.from !== jackId && c.to !== jackId
          ),
        }));
        setActiveSourceJack(null);
        setDanglingSourceCoords(null);
        setPointerCoords(null);
        return;
      }

      if (direction === 'out') {
        if (activeSourceJack === jackId) {
          setActiveSourceJack(null);
          setDanglingSourceCoords(null);
          setPointerCoords(null);
        } else {
          setActiveSourceJack(jackId);
          const container = rackRef.current;
          if (container) {
            const cRect = container.getBoundingClientRect();
            const r = e.currentTarget.getBoundingClientRect();
            setDanglingSourceCoords({
              x: r.left - cRect.left + container.scrollLeft + r.width / 2,
              y: r.top - cRect.top + container.scrollTop + r.height / 2,
            });
            setPointerCoords({
              x: e.clientX - cRect.left + container.scrollLeft,
              y: e.clientY - cRect.top + container.scrollTop,
            });
          }
        }
        return;
      }

      // Clicking an INPUT jack
      if (activeSourceJack) {
        setPatch((prev) => {
          const exists = prev.cables.some(
            (c) => c.from === activeSourceJack && c.to === jackId
          );
          if (exists) return prev;
          // Replace existing cable on a clock input jack so a voice has a single deterministic clock source
          const filtered = jackId.endsWith('-clk')
            ? prev.cables.filter((c) => c.to !== jackId)
            : prev.cables;
          const nextCable: PatchCable = {
            id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            from: activeSourceJack,
            to: jackId,
            color:
              CABLE_PALETTE[filtered.length % CABLE_PALETTE.length] ??
              '#F59E0B',
          };
          return {
            ...prev,
            cables: [...filtered, nextCable],
          };
        });
        setActiveSourceJack(null);
        setDanglingSourceCoords(null);
        setPointerCoords(null);
      } else {
        // Clicking an input jack without an active source unplugs cables into that input jack
        setPatch((prev) => ({
          ...prev,
          cables: prev.cables.filter((c) => c.to !== jackId),
        }));
      }
    },
    [activeSourceJack]
  );

  const handleRackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activeSourceJack || !rackRef.current) return;
      const cRect = rackRef.current.getBoundingClientRect();
      setPointerCoords({
        x: e.clientX - cRect.left + rackRef.current.scrollLeft,
        y: e.clientY - cRect.top + rackRef.current.scrollTop,
      });
    },
    [activeSourceJack]
  );

  // Voice helper updater
  const updateVoice = useCallback(
    (voiceIndex: number, updater: (v: VoiceTrack) => VoiceTrack) => {
      setPatch((prev) => ({
        ...prev,
        voices: prev.voices.map((v, idx) =>
          idx === voiceIndex ? updater(v) : v
        ),
      }));
    },
    []
  );

  // Patch Manager Handlers (Save, Save As, Delete, Export, Import)
  const handleSelectSongPreset = useCallback(
    (presetId: string) => {
      const factoryMatch = RILEY_FACTORY_SONG_PRESETS.find(
        (fp) => fp.id === presetId
      );
      if (factoryMatch) {
        const next = cloneRileySongPatch(factoryMatch);
        next.ecoMode = ecoMode;
        setPatch(next);
        return;
      }
      const userMatch = userPatches.find((up) => up.id === presetId);
      if (userMatch) {
        const next = cloneRileySongPatch(userMatch);
        next.ecoMode = ecoMode;
        setPatch(next);
      }
    },
    [ecoMode, userPatches]
  );

  const handleSaveCurrentPatch = useCallback(async () => {
    if (patch.isFactory) {
      setSaveAsNameInput(`${patch.name} (User)`);
      setSaveAsModalOpen(true);
      return;
    }
    const saved = await saveUserPatch(patch);
    const updatedList = await listUserPatches();
    setUserPatches(updatedList);
    setPatch(saved);
    setToastMessage({
      title: isJa ? 'パッチ保存完了' : 'Patch Saved',
      message: isJa
        ? `「${saved.name}」を RileyRack800_DB に上書き保存しました。`
        : `Saved "${saved.name}" to RileyRack800_DB.`,
      variant: 'info',
    });
  }, [isJa, patch]);

  const handleConfirmSaveAs = useCallback(async () => {
    const customName = saveAsNameInput.trim() || `${patch.name} (Custom)`;
    const toSave: RileySongPatch = {
      ...cloneRileySongPatch(patch),
      id: `user-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      name: customName,
      nameJa: undefined,
      isFactory: false,
      createdAt: Date.now(),
    };
    const saved = await saveUserPatch(toSave);
    const updatedList = await listUserPatches();
    setUserPatches(updatedList);
    setPatch(saved);
    setSaveAsModalOpen(false);
  }, [patch, saveAsNameInput]);

  const handleDeleteCurrentUserPatch = useCallback(async () => {
    if (patch.isFactory || !patch.id.startsWith('user-')) return;
    await deleteUserPatch(patch.id);
    const updatedList = await listUserPatches();
    setUserPatches(updatedList);
    const fallback = cloneRileySongPatch(RILEY_FACTORY_SONG_PRESETS[0]);
    fallback.ecoMode = ecoMode;
    setPatch(fallback);
  }, [ecoMode, patch.id, patch.isFactory]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const imported = await importRileyPatchFromJsonFile(file);
        imported.ecoMode = ecoMode;
        const saved = await saveUserPatch({
          ...imported,
          isFactory: false,
        });
        const updatedList = await listUserPatches();
        setUserPatches(updatedList);
        setPatch(saved);
      } catch (err) {
        const msg =
          err instanceof IncompatiblePatchError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to import patch file.';
        setToastMessage({
          title: isJa ? 'インポートエラー' : 'Patch Import Error',
          message: msg,
          variant: 'danger',
        });
      }
    },
    [ecoMode, isJa]
  );

  const selectedVoice = patch.voices[selectedVoiceIdx] ?? patch.voices[0];
  const currentScale = RILEY_SCALES[patch.scaleId] ?? RILEY_SCALES.mixolydian;
  const allPresets = useMemo(
    () => [...RILEY_FACTORY_SONG_PRESETS, ...userPatches],
    [userPatches]
  );

  return (
    <div
      ref={rackRef}
      onPointerMove={handleRackPointerMove}
      className={`inst-rileyrack relative w-full h-full overflow-y-auto overflow-x-hidden p-2.5 space-y-2.5 select-none ${
        ecoMode ? 'inst-rileyrack-eco' : ''
      }`}
    >
      {/* ====================================================================
          SCROLL-ANCHORED SVG PATCHBAY OVERLAY (Section 10.2)
          ==================================================================== */}
      {!hideCables && (
        <svg
          width={svgSize.width}
          height={svgSize.height}
          className="pointer-events-none absolute top-0 left-0 z-20 overflow-visible"
        >
          {cableLines.map((line) => (
            <g key={line.id}>
              <path
                d={buildCatenaryPath(line.x1, line.y1, line.x2, line.y2)}
                fill="none"
                stroke={line.color}
                strokeWidth={3.2}
                strokeLinecap="round"
                opacity={0.86}
                style={
                  ecoMode
                    ? undefined
                    : { filter: `drop-shadow(0 2px 5px ${line.color}88)` }
                }
              />
              <circle cx={line.x1} cy={line.y1} r={4} fill={line.color} />
              <circle cx={line.x2} cy={line.y2} r={4} fill={line.color} />
            </g>
          ))}

          {activeSourceJack && danglingSourceCoords && pointerCoords && (
            <path
              d={buildCatenaryPath(
                danglingSourceCoords.x,
                danglingSourceCoords.y,
                pointerCoords.x,
                pointerCoords.y
              )}
              fill="none"
              stroke="#FBBF24"
              strokeWidth={3}
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}

      {/* ====================================================================
          ROW 1: TOP EURORACK ROW (3 MODULES: 5 COLS + 3 COLS + 4 COLS)
          ==================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 relative z-10">
        {/* MODULE 1 (5 Cols): Master Clock, Quantizer & Patch Manager */}
        <section className="xl:col-span-5 rounded-xl border border-amber-500/25 bg-[#10141E] p-3 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <h2 className="font-studio-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 truncate">
                {t(
                  'riley.masterClockTitle',
                  '01 // MASTER CLOCK, QUANTIZER & PATCH MANAGER'
                )}
              </h2>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* ECO MODE Toggle (Section 6) */}
              <button
                type="button"
                onClick={() => {
                  const nextEco = !ecoMode;
                  engine.setEcoMode(nextEco);
                  setPatch((prev) => ({ ...prev, ecoMode: nextEco }));
                }}
                title={t(
                  'transport.ecoTooltip',
                  'ECO Mode (strict 8-voice monophonic cap, 3-drawbar organ, static tape delay & 2-loop biosphere for low-spec devices)'
                )}
                className={`h-6 px-2 rounded font-studio-mono text-[10px] font-bold border transition-colors cursor-pointer ${
                  ecoMode
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {ecoMode
                  ? t('transport.ecoOn', '⚡ ECO ON')
                  : t('transport.ecoOff', 'ECO')}
              </button>

              {/* Live WAV Recorder */}
              <button
                type="button"
                onClick={handleToggleWavRecord}
                className={`h-6 px-2 rounded font-studio-mono text-[10px] font-bold border transition-colors cursor-pointer ${
                  isWavRecording
                    ? 'bg-red-600 text-white border-red-400 animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                }`}
              >
                {isWavRecording
                  ? t('transport.stopWav', '■ STOP .WAV')
                  : t('transport.recWav', '● REC .WAV')}
              </button>
            </div>
          </div>

          {/* Transport + Song Preset Selector + Patch I/O */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleTogglePlay()}
              className={`h-8 px-3 rounded-lg font-studio-mono text-xs font-bold tracking-wider transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-amber-400 text-black'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40'
              }`}
            >
              {isPlaying
                ? t('riley.stop', '■ STOP RACK')
                : t('riley.run', '▶ RUN RACK')}
            </button>

            <div className="flex items-center bg-black/50 rounded-lg border border-white/10 p-0.5 flex-1 min-w-[180px]">
              <select
                aria-label="Song Preset Selector"
                value={patch.id}
                onChange={(e) => handleSelectSongPreset(e.target.value)}
                className="h-7 px-1.5 bg-transparent font-studio-mono text-[11px] font-bold text-amber-200 flex-1 min-w-0 truncate cursor-pointer"
              >
                <optgroup
                  label={
                    isJa
                      ? '🏛️ 10 ファクトリー・ソングプリセット'
                      : '🏛️ 10 FACTORY SONG PRESETS'
                  }
                  className="bg-[#10141E] text-amber-300"
                >
                  {RILEY_FACTORY_SONG_PRESETS.map((fp) => (
                    <option
                      key={fp.id}
                      value={fp.id}
                      className="bg-[#10141E] text-white"
                    >
                      {isJa && fp.nameJa ? fp.nameJa : fp.name} ({fp.bpm} BPM)
                    </option>
                  ))}
                </optgroup>
                {userPatches.length > 0 && (
                  <optgroup
                    label={
                      isJa
                        ? '💾 ユーザー保存パッチ (RileyRack800_DB)'
                        : '💾 USER SAVED PATCHES (RileyRack800_DB)'
                    }
                    className="bg-[#10141E] text-sky-300"
                  >
                    {userPatches.map((up) => (
                      <option
                        key={up.id}
                        value={up.id}
                        className="bg-[#10141E] text-white"
                      >
                        ★ {up.name} ({up.bpm} BPM)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <button
                type="button"
                onClick={() => {
                  const idx = allPresets.findIndex((p) => p.id === patch.id);
                  const prev =
                    idx <= 0 ? allPresets.length - 1 : idx - 1;
                  handleSelectSongPreset(allPresets[prev].id);
                }}
                title={isJa ? '前のソングプリセット' : 'Previous Song Preset'}
                className="w-6 h-6 rounded bg-white/5 hover:bg-white/15 font-studio-mono text-[10px] text-gray-300 cursor-pointer"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = allPresets.findIndex((p) => p.id === patch.id);
                  const next =
                    idx < 0 || idx >= allPresets.length - 1 ? 0 : idx + 1;
                  handleSelectSongPreset(allPresets[next].id);
                }}
                title={isJa ? '次のソングプリセット' : 'Next Song Preset'}
                className="w-6 h-6 rounded bg-white/5 hover:bg-white/15 font-studio-mono text-[10px] text-gray-300 ml-0.5 cursor-pointer"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Patch Manager Action Bar: SAVE / SAVE AS / DEL / EXPORT / IMPORT */}
          <div className="flex flex-wrap items-center gap-1 font-studio-mono text-[10px]">
            <button
              type="button"
              onClick={() => void handleSaveCurrentPatch()}
              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold cursor-pointer"
            >
              {t('riley.save', '💾 SAVE')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSaveAsNameInput(`${patch.name} (Copy)`);
                setSaveAsModalOpen(true);
              }}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 cursor-pointer"
            >
              {t('riley.saveAs', 'SAVE AS')}
            </button>
            {!patch.isFactory && (
              <button
                type="button"
                onClick={() => void handleDeleteCurrentUserPatch()}
                className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 cursor-pointer"
              >
                {t('riley.delete', 'DEL')}
              </button>
            )}
            <button
              type="button"
              onClick={() => exportRileyPatchToJsonFile(patch)}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 cursor-pointer"
            >
              {t('riley.export', '⬇ EXPORT')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 cursor-pointer"
            >
              {t('riley.import', '📂 IMPORT')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                  e.target.value = '';
                }
              }}
            />

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMixerDrawerOpen((v) => !v)}
                className={`px-2 py-1 rounded border font-bold cursor-pointer ${
                  mixerDrawerOpen
                    ? 'bg-sky-400 text-black border-sky-300'
                    : 'bg-white/5 hover:bg-white/10 text-sky-300 border-sky-500/30'
                }`}
              >
                {t('riley.mixer', '🎚️ MIXER')}
              </button>
            </div>
          </div>

          {/* Quantizer & Tempo Row: BPM (60-180), Scale, Root (C-B), Just Intonation / 12-TET */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 items-center bg-black/40 p-2 rounded-lg border border-white/5">
            {/* BPM */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between font-studio-mono text-[9px] text-gray-400">
                <span>TEMPO</span>
                <span className="text-amber-300 font-bold">{patch.bpm} BPM</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setPatch((p) => ({ ...p, bpm: Math.max(60, p.bpm - 1) }))
                  }
                  className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold cursor-pointer"
                >
                  -
                </button>
                <input
                  type="range"
                  min={60}
                  max={180}
                  value={patch.bpm}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, bpm: Number(e.target.value) }))
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPatch((p) => ({ ...p, bpm: Math.min(180, p.bpm + 1) }))
                  }
                  className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Scale Selector */}
            <div className="flex flex-col gap-0.5">
              <span className="font-studio-mono text-[9px] text-gray-400">
                {isJa ? 'モード音階 (SCALE)' : 'MODAL SCALE'}
              </span>
              <select
                aria-label="Modal Scale"
                value={patch.scaleId}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    scaleId: e.target.value as ScaleId,
                  }))
                }
                className="h-6 px-1.5 rounded bg-black/60 border border-white/15 font-studio-mono text-[10px] text-amber-200 cursor-pointer"
              >
                {SCALE_IDS.map((sid) => {
                  const sc = RILEY_SCALES[sid];
                  return (
                    <option key={sid} value={sid} className="bg-[#10141E]">
                      {isJa ? sc.nameJa : sc.name}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Root Note Selector */}
            <div className="flex flex-col gap-0.5">
              <span className="font-studio-mono text-[9px] text-gray-400">
                {isJa ? 'ルート音 (ROOT)' : 'ROOT KEY'}
              </span>
              <select
                aria-label="Root Note"
                value={patch.rootMidi}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    rootMidi: Number(e.target.value),
                  }))
                }
                className="h-6 px-1.5 rounded bg-black/60 border border-white/15 font-studio-mono text-[10px] font-bold text-cyan-300 cursor-pointer"
              >
                {ROOT_NOTE_OPTIONS.map((rn) => (
                  <option
                    key={rn.midi}
                    value={rn.midi}
                    className="bg-[#10141E]"
                  >
                    {rn.name} ({rn.midi})
                  </option>
                ))}
              </select>
            </div>

            {/* Just Intonation vs 12-TET Toggle */}
            <div className="flex flex-col gap-0.5">
              <span className="font-studio-mono text-[9px] text-gray-400">
                {isJa ? '音律 (TUNING)' : 'TUNING SYSTEM'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPatch((p) => ({ ...p, justIntonation: !p.justIntonation }))
                }
                className={`h-6 px-2 rounded font-studio-mono text-[10px] font-bold border transition-colors cursor-pointer ${
                  patch.justIntonation
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                    : 'bg-sky-500/20 border-sky-400/60 text-sky-300'
                }`}
              >
                {patch.justIntonation
                  ? t('riley.justInt', 'JUST INT (PURE)')
                  : t('riley.tet12', '12-TET (EQUAL)')}
              </button>
            </div>
          </div>

          {/* 5 Clock Divider Output Jacks (÷1, ÷2, ÷3, ÷5, ÷7) + Cable Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="font-studio-mono text-[9px] text-gray-400 uppercase">
                {isJa ? 'クロック分周出力:' : 'CLK DIV OUT:'}
              </span>
              {CLOCK_DIV_JACKS.map((j) => {
                const isSelected = activeSourceJack === j.id;
                const isPatched = patch.cables.some((c) => c.from === j.id);
                return (
                  <button
                    key={j.id}
                    type="button"
                    data-riley-jack={j.id}
                    onClick={(e) => handleJackClick(j.id, 'out', e)}
                    title={isJa ? j.tipJa : j.tipEn}
                    className={`h-6 px-2 rounded-full font-studio-mono text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-400 text-black border-white scale-105'
                        : isPatched
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                          : 'bg-black/60 border-white/20 text-gray-300 hover:border-amber-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <span>{j.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 font-studio-mono text-[9px]">
              <button
                type="button"
                onClick={() => setHideCables((v) => !v)}
                className={`px-2 py-1 rounded border cursor-pointer ${
                  hideCables
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                }`}
              >
                {hideCables
                  ? t('riley.showCables', '🔌 CABLES')
                  : t('riley.hideCables', '🙈 HIDE CABLES')}{' '}
                ({patch.cables.length})
              </button>
              <button
                type="button"
                onClick={() =>
                  setPatch((prev) => ({ ...prev, cables: [] }))
                }
                className="px-2 py-1 rounded bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-gray-300 hover:text-rose-200 cursor-pointer"
              >
                {t('riley.clearCables', 'CLEAR')}
              </button>
            </div>
          </div>
        </section>

        {/* MODULE 2 (3 Cols): Generative Evolve Engine */}
        <section className="xl:col-span-3 rounded-xl border border-emerald-500/25 bg-[#10141E] p-3 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h2 className="font-studio-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                {t('riley.evolveTitle', '02 // GENERATIVE EVOLVE ENGINE')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setPatch((p) => ({
                  ...p,
                  evolve: { ...p.evolve, enabled: !p.evolve.enabled },
                }))
              }
              className={`h-6 px-2 rounded font-studio-mono text-[10px] font-bold border cursor-pointer ${
                patch.evolve.enabled
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              {patch.evolve.enabled
                ? t('riley.evolveAutoOn', 'AUTO EVOLVE: ON')
                : t('riley.evolveAutoOff', 'AUTO EVOLVE: OFF')}
            </button>
          </div>

          {/* Interval Bars Selector & Live Bar Countdown Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-studio-mono text-[10px]">
              <span className="text-gray-400">
                {isJa ? '変異周期 (INTERVAL):' : 'INTERVAL BARS:'}
              </span>
              <div className="flex items-center gap-1">
                {([4, 8, 16, 32, 64] as const).map((bars) => (
                  <button
                    key={bars}
                    type="button"
                    onClick={() =>
                      setPatch((p) => ({
                        ...p,
                        evolve: { ...p.evolve, intervalBars: bars },
                      }))
                    }
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      patch.evolve.intervalBars === bars
                        ? 'bg-emerald-400 text-black'
                        : 'bg-white/5 text-gray-300 hover:bg-white/15'
                    }`}
                  >
                    {bars}B
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-black/50 rounded-lg p-2 border border-white/5 space-y-1">
              <div className="flex items-center justify-between font-studio-mono text-[10px]">
                <span className="text-emerald-300 font-bold">
                  Bar {evolveBar} / {patch.evolve.intervalBars}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const { nextPatch, eventLog } = engine.triggerManualMorph();
                    setPatch(nextPatch);
                    setEvolveLastEvent(eventLog);
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 font-bold cursor-pointer"
                >
                  {t('riley.morphNow', '✨ MORPH NOW')}
                </button>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-200"
                  style={{
                    width: `${Math.min(100, (evolveBar / patch.evolve.intervalBars) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3 Independent Mutation Toggles */}
          <div className="grid grid-cols-3 gap-1.5 font-studio-mono text-[9px]">
            <button
              type="button"
              onClick={() =>
                setPatch((p) => ({
                  ...p,
                  evolve: { ...p.evolve, pitchDrift: !p.evolve.pitchDrift },
                }))
              }
              className={`py-1.5 px-1 rounded border font-bold cursor-pointer ${
                patch.evolve.pitchDrift
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-black/40 border-white/10 text-gray-500'
              }`}
            >
              {t('riley.pitchDrift', 'PITCH DRIFT')}
            </button>
            <button
              type="button"
              onClick={() =>
                setPatch((p) => ({
                  ...p,
                  evolve: {
                    ...p.evolve,
                    rhythmLength: !p.evolve.rhythmLength,
                  },
                }))
              }
              className={`py-1.5 px-1 rounded border font-bold cursor-pointer ${
                patch.evolve.rhythmLength
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-black/40 border-white/10 text-gray-500'
              }`}
            >
              {t('riley.rhythmLen', 'RHYTHM / LEN')}
            </button>
            <button
              type="button"
              onClick={() =>
                setPatch((p) => ({
                  ...p,
                  evolve: { ...p.evolve, timbreMorph: !p.evolve.timbreMorph },
                }))
              }
              className={`py-1.5 px-1 rounded border font-bold cursor-pointer ${
                patch.evolve.timbreMorph
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-black/40 border-white/10 text-gray-500'
              }`}
            >
              {t('riley.timbreMorph', 'TIMBRE MORPH')}
            </button>
          </div>

          {/* Live Mutation Log Ticker */}
          <div className="bg-black/60 rounded px-2 py-1 border border-white/10 font-studio-mono text-[10px] text-emerald-300 truncate">
            ⚡ {evolveLastEvent}
          </div>
        </section>

        {/* MODULE 3 (4 Cols): Time Lag Accumulator // Magnetic Tape Loop */}
        <section className="xl:col-span-4 rounded-xl border border-sky-500/25 bg-[#10141E] p-3 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <h2 className="font-studio-mono text-[10px] font-bold uppercase tracking-wider text-sky-300 truncate">
                {t(
                  'riley.tapeLoopTitle',
                  '03 // TIME LAG ACCUMULATOR // TAPE LOOP'
                )}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => engine.clearTape()}
              className="h-6 px-2 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 font-studio-mono text-[10px] font-bold text-rose-200 cursor-pointer"
            >
              {t('riley.clearTape', '🧹 CLEAR TAPE')}
            </button>
          </div>

          {/* 6 Rotary Knobs for Stereo Time Lag Tape Delay */}
          <div className="grid grid-cols-6 gap-1 items-center justify-items-center py-1">
            <RotaryKnob
              size="sm"
              label="DELAY L"
              value={patch.delay.delayLMs}
              min={120}
              max={1400}
              step={5}
              defaultValue={420}
              accentColor="#38BDF8"
              formatValue={(v) => `${Math.round(v)}ms`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  delay: { ...p.delay, delayLMs: val },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label="DELAY R"
              value={patch.delay.delayRMs}
              min={150}
              max={1600}
              step={5}
              defaultValue={630}
              accentColor="#38BDF8"
              formatValue={(v) => `${Math.round(v)}ms`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  delay: { ...p.delay, delayRMs: val },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label="TONE"
              value={patch.delay.toneHz}
              min={400}
              max={2200}
              step={10}
              defaultValue={1450}
              accentColor="#F59E0B"
              formatValue={(v) => `${Math.round(v)}Hz`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  delay: { ...p.delay, toneHz: val },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label="FEEDBK"
              value={patch.delay.feedback}
              min={0}
              max={0.64}
              step={0.01}
              defaultValue={0.48}
              accentColor="#10B981"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  delay: { ...p.delay, feedback: Math.min(0.64, val) },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label="CROSS"
              value={patch.delay.crossFeed}
              min={0}
              max={0.14}
              step={0.01}
              defaultValue={0.11}
              accentColor="#A855F7"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  delay: { ...p.delay, crossFeed: Math.min(0.14, val) },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label="WET MIX"
              value={patch.delay.mix}
              min={0}
              max={0.7}
              step={0.01}
              defaultValue={0.4}
              accentColor="#38BDF8"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  delay: { ...p.delay, mix: Math.min(0.7, val) },
                }))
              }
            />
          </div>

          {/* Tape Input Jacks (tla-in-l, tla-in-r) & Vibe Description */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10 gap-2">
            <span className="text-[10px] text-gray-400 truncate">
              {isJa
                ? (patch.vibeJa ?? patch.vibe ?? '120Hz HPF + 酸化テープLPF保護回路')
                : (patch.vibe ?? '120Hz HPF + Oxide LPF Runaway-Proof Matrix')}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {(['tla-in-l', 'tla-in-r'] as const).map((jid) => {
                const isPatched = patch.cables.some((c) => c.to === jid);
                return (
                  <button
                    key={jid}
                    type="button"
                    data-riley-jack={jid}
                    onClick={(e) => handleJackClick(jid, 'in', e)}
                    title={
                      isJa
                        ? `${jid === 'tla-in-l' ? 'TAPE L' : 'TAPE R'} 入力端子（CV OUTから結線してテープ変調）`
                        : `Patch any Voice CV OUT here to modulate & feed ${jid === 'tla-in-l' ? 'Left' : 'Right'} Tape Loop`
                    }
                    className={`h-6 px-2 rounded-full font-studio-mono text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                      activeSourceJack
                        ? 'bg-sky-500/30 border-sky-300 text-white animate-pulse'
                        : isPatched
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-black/60 border-white/20 text-gray-300 hover:border-sky-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full border border-sky-300 inline-block" />
                    <span>{jid === 'tla-in-l' ? 'TAPE L IN' : 'TAPE R IN'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ====================================================================
          COLLAPSIBLE 8-VOICE MIXER DRAWER (Toggled via MIXER button)
          ==================================================================== */}
      {mixerDrawerOpen && (
        <section className="rounded-xl border border-sky-500/35 bg-[#0D121B] p-3 space-y-2.5 relative z-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-studio-mono text-xs font-bold text-sky-300">
              {isJa
                ? '🎚️ 8チャンネル・ポリメトリック・ミキサー＆テープセンド・コンソール'
                : '🎚️ 8-CHANNEL POLYMETRIC MIXER & TAPE ACCUMULATOR SEND CONSOLE'}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-studio-mono text-[10px]">
                <span className="text-gray-400">
                  {t('transport.masterVol', 'MASTER VOL')}:
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={patch.masterVol ?? 0.85}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      masterVol: Number(e.target.value),
                    }))
                  }
                  className="w-24 accent-sky-400 cursor-pointer"
                />
                <span className="text-sky-300 font-bold">
                  {Math.round((patch.masterVol ?? 0.85) * 100)}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMixerDrawerOpen(false)}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 font-studio-mono text-[10px] text-gray-200 cursor-pointer"
              >
                {t('drawer.close', '✕ CLOSE')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
            {patch.voices.map((v, idx) => (
              <div
                key={v.id}
                className="rounded-lg bg-black/50 border border-white/10 p-2 flex flex-col gap-1.5 font-studio-mono text-[10px]"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="font-bold"
                    style={{ color: v.color }}
                  >
                    VOICE {idx + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(idx, (cur) => ({ ...cur, mute: !cur.mute }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                        v.mute
                          ? 'bg-rose-500 text-black'
                          : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(idx, (cur) => ({ ...cur, solo: !cur.solo }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                        v.solo
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>VOL</span>
                    <span>{Math.round(v.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={v.volume}
                    onChange={(e) =>
                      updateVoice(idx, (cur) => ({
                        ...cur,
                        volume: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />

                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>PAN</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(idx, (cur) => ({ ...cur, pan: 0 }))
                      }
                      className="text-sky-300 hover:underline cursor-pointer"
                    >
                      {v.pan === 0
                        ? 'C'
                        : v.pan < 0
                          ? `L${Math.round(Math.abs(v.pan) * 100)}`
                          : `R${Math.round(v.pan * 100)}`}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.02}
                    value={v.pan}
                    onChange={(e) =>
                      updateVoice(idx, (cur) => ({
                        ...cur,
                        pan: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />

                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>TAPE SEND</span>
                    <span>{Math.round(v.tapeSend * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.7}
                    step={0.01}
                    value={v.tapeSend}
                    onChange={(e) =>
                      updateVoice(idx, (cur) => ({
                        ...cur,
                        tapeSend: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====================================================================
          ROW 2: MIDDLE EURORACK ROW — 8-CHANNEL POLYMETRIC SEQUENCER BANK (4x2 GRID)
          ==================================================================== */}
      <section className="space-y-2 relative z-10">
        <div className="flex items-center justify-between px-1">
          <span className="font-studio-mono text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {t(
              'riley.seqBankTitle',
              '8-CHANNEL POLYMETRIC SEQUENCER BANK (4×2 EURORACK GRID)'
            )}
          </span>
          <span className="font-studio-mono text-[10px] text-gray-500">
            {isJa
              ? 'セルをクリックでゲートON/OFF • ▲/▼で音階度数を変更 • CLK INへ分周クロックを結線可能'
              : 'Click step to toggle Gate • Click ▲/▼ to shift Scale Degree • Patch CLK DIV to CLK IN'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {patch.voices.map((voice, vIdx) => {
            const isSelected = selectedVoiceIdx === vIdx;
            const currentStep = activeSteps[vIdx] ?? 0;
            const clkJackId = `v${vIdx + 1}-clk`;
            const cvJackId = `v${vIdx + 1}-cv`;
            const seqTrigJackId = `v${vIdx + 1}-seq-trig`;
            const clkCable = patch.cables.find((c) => c.to === clkJackId);
            const cvPatched = patch.cables.some((c) => c.from === cvJackId);
            const trigPatched = patch.cables.some((c) => c.from === seqTrigJackId);

            return (
              <div
                key={voice.id}
                style={{
                  borderColor: isSelected
                    ? `${voice.color}99`
                    : 'rgba(255,255,255,0.1)',
                }}
                className="rounded-xl border bg-[#10141E] p-2.5 flex flex-col gap-2 transition-colors"
              >
                {/* Voice Card Header */}
                <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: voice.color }}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedVoiceIdx(vIdx)}
                      className="font-studio-mono text-xs font-bold text-white hover:underline cursor-pointer"
                    >
                      V{vIdx + 1}
                    </button>

                    {/* RILEY / SYNTH PRO Quick Mode Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(vIdx, (cur) => ({
                          ...cur,
                          mode:
                            cur.mode === 'ORIGINAL_RILEY'
                              ? 'FULL_SYNTH_SUITE'
                              : 'ORIGINAL_RILEY',
                        }))
                      }
                      className={`px-1.5 py-0.5 rounded font-studio-mono text-[9px] font-bold border cursor-pointer ${
                        voice.mode === 'ORIGINAL_RILEY'
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                          : 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                      }`}
                    >
                      {voice.mode === 'ORIGINAL_RILEY' ? 'RILEY' : 'SYNTH PRO'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedVoiceIdx(vIdx)}
                      className={`px-1.5 py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      EDIT
                    </button>
                  </div>

                  {/* Mute, Solo & Patch Jacks (CLK IN / CV OUT) */}
                  <div className="flex items-center gap-1 font-studio-mono text-[9px]">
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(vIdx, (cur) => ({ ...cur, mute: !cur.mute }))
                      }
                      title={t('mixer.mute', 'Mute Voice')}
                      className={`w-5 h-5 rounded font-bold cursor-pointer ${
                        voice.mute
                          ? 'bg-rose-500 text-black'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(vIdx, (cur) => ({ ...cur, solo: !cur.solo }))
                      }
                      title={t('mixer.solo', 'Solo Voice')}
                      className={`w-5 h-5 rounded font-bold cursor-pointer ${
                        voice.solo
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      S
                    </button>

                    {/* CLK IN Jack */}
                    <button
                      type="button"
                      data-riley-jack={clkJackId}
                      onClick={(e) => handleJackClick(clkJackId, 'in', e)}
                      title={
                        isJa
                          ? `V${vIdx + 1} CLK IN 端子（クロック分周出力から結線）`
                          : `V${vIdx + 1} CLK IN Jack (Patch from CLK DIV OUT)`
                      }
                      className={`h-5 px-1.5 rounded-full border flex items-center gap-0.5 cursor-pointer ${
                        activeSourceJack
                          ? 'bg-amber-500/30 border-amber-300 text-white animate-pulse'
                          : clkCable
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                            : 'bg-black/60 border-white/20 text-gray-400 hover:border-amber-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full border border-amber-300" />
                      <span>CLK</span>
                    </button>

                    {/* CV OUT Jack */}
                    <button
                      type="button"
                      data-riley-jack={cvJackId}
                      onClick={(e) => handleJackClick(cvJackId, 'out', e)}
                      title={
                        isJa
                          ? `V${vIdx + 1} CV OUT 端子（TAPE L/R INへ結線可能）`
                          : `V${vIdx + 1} CV OUT Jack (Patch to TAPE L/R IN)`
                      }
                      className={`h-5 px-1.5 rounded-full border flex items-center gap-0.5 cursor-pointer ${
                        activeSourceJack === cvJackId
                          ? 'bg-amber-400 text-black border-white'
                          : cvPatched
                            ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                            : 'bg-black/60 border-white/20 text-gray-400 hover:border-sky-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      <span>CV</span>
                    </button>

                    {/* TRIG OUT Jack (Sequencer Trigger -> Thunder / External) */}
                    <button
                      type="button"
                      data-riley-jack={seqTrigJackId}
                      onClick={(e) => handleJackClick(seqTrigJackId, 'out', e)}
                      title={
                        isJa
                          ? `V${vIdx + 1} TRIG OUT 端子（THUNDER TRIG INへ結線して発火連動）`
                          : `V${vIdx + 1} TRIG OUT Jack (Patch to THUNDER TRIG IN)`
                      }
                      className={`h-5 px-1.5 rounded-full border flex items-center gap-0.5 cursor-pointer ${
                        activeSourceJack === seqTrigJackId
                          ? 'bg-amber-400 text-black border-white'
                          : trigPatched
                            ? 'bg-yellow-500/25 border-yellow-400 text-yellow-200'
                            : 'bg-black/60 border-white/20 text-gray-400 hover:border-yellow-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      <span>TRIG</span>
                    </button>
                  </div>
                </div>

                {/* Polymetric Controls Row: Length (3-16), Speed, Octave, Volume */}
                <div className="grid grid-cols-4 gap-1 items-center font-studio-mono text-[9px] bg-black/40 p-1.5 rounded border border-white/5">
                  {/* Length */}
                  <div className="flex flex-col">
                    <span className="text-gray-400">LEN: {voice.length}st</span>
                    <input
                      type="range"
                      min={3}
                      max={16}
                      value={voice.length}
                      onChange={(e) =>
                        updateVoice(vIdx, (cur) => ({
                          ...cur,
                          length: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  {/* Speed */}
                  <div className="flex flex-col">
                    <span className="text-gray-400">
                      {clkCable ? `CLK:${clkCable.from.replace('clk-div-', '÷')}` : 'SPEED'}
                    </span>
                    <select
                      aria-label={`Voice ${vIdx + 1} Speed`}
                      value={voice.speed}
                      onChange={(e) =>
                        updateVoice(vIdx, (cur) => ({
                          ...cur,
                          speed: Number(e.target.value),
                        }))
                      }
                      className="h-5 rounded bg-black/60 border border-white/15 text-[9px] text-amber-200 px-1 cursor-pointer"
                    >
                      <option value={0.5}>1/2x</option>
                      <option value={1}>1x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2x</option>
                    </select>
                  </div>

                  {/* Octave */}
                  <div className="flex flex-col">
                    <span className="text-gray-400">OCTAVE</span>
                    <select
                      aria-label={`Voice ${vIdx + 1} Octave`}
                      value={voice.octave}
                      onChange={(e) =>
                        updateVoice(vIdx, (cur) => ({
                          ...cur,
                          octave: Number(e.target.value),
                        }))
                      }
                      className="h-5 rounded bg-black/60 border border-white/15 text-[9px] text-cyan-200 px-1 cursor-pointer"
                    >
                      <option value={-1}>-1 Oct</option>
                      <option value={0}>0 Oct</option>
                      <option value={1}>+1 Oct</option>
                      <option value={2}>+2 Oct</option>
                    </select>
                  </div>

                  {/* Volume */}
                  <div className="flex flex-col">
                    <span className="text-gray-400">
                      VOL {Math.round(voice.volume * 100)}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={voice.volume}
                      onChange={(e) =>
                        updateVoice(vIdx, (cur) => ({
                          ...cur,
                          volume: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 16-Step Polymetric Grid (8x2 cells) */}
                <div className="grid grid-cols-8 gap-1">
                  {voice.steps.map((cell, sIdx) => {
                    const isWithinLoop = sIdx < voice.length;
                    const isPlayhead =
                      isPlaying && isWithinLoop && currentStep === sIdx;
                    const noteLabel = formatStepNoteName(
                      patch.scaleId,
                      patch.rootMidi,
                      cell.degree,
                      voice.octave
                    );
                    const scaleLen = currentScale.semitones.length;

                    return (
                      <div
                        key={sIdx}
                        style={{
                          borderColor: isPlayhead
                            ? '#FFFFFF'
                            : cell.active && isWithinLoop
                              ? `${voice.color}88`
                              : 'rgba(255,255,255,0.08)',
                          backgroundColor: !isWithinLoop
                            ? 'rgba(0,0,0,0.25)'
                            : isPlayhead
                              ? `${voice.color}44`
                              : cell.active
                                ? `${voice.color}22`
                                : 'rgba(0,0,0,0.55)',
                        }}
                        className={`rounded border p-1 flex flex-col items-center justify-between font-studio-mono transition-colors ${
                          !isWithinLoop ? 'opacity-30' : ''
                        }`}
                      >
                        {/* Degree Up/Down mini buttons */}
                        <div className="w-full flex items-center justify-between text-[8px] text-gray-400">
                          <button
                            type="button"
                            onClick={() =>
                              updateVoice(vIdx, (cur) => ({
                                ...cur,
                                steps: cur.steps.map((st, idx) =>
                                  idx === sIdx
                                    ? {
                                        ...st,
                                        active: true,
                                        degree:
                                          ((st.degree - 1) % scaleLen +
                                            scaleLen) %
                                          scaleLen,
                                      }
                                    : st
                                ),
                              }))
                            }
                            className="hover:text-white px-0.5 cursor-pointer"
                            title="Degree -1"
                          >
                            ▼
                          </button>
                          <span className="text-[7px] text-gray-500">
                            {sIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateVoice(vIdx, (cur) => ({
                                ...cur,
                                steps: cur.steps.map((st, idx) =>
                                  idx === sIdx
                                    ? {
                                        ...st,
                                        active: true,
                                        degree: (st.degree + 1) % scaleLen,
                                      }
                                    : st
                                ),
                              }))
                            }
                            className="hover:text-white px-0.5 cursor-pointer"
                            title="Degree +1"
                          >
                            ▲
                          </button>
                        </div>

                        {/* Gate Toggle & Note Readout */}
                        <button
                          type="button"
                          onClick={() =>
                            updateVoice(vIdx, (cur) => ({
                              ...cur,
                              steps: cur.steps.map((st, idx) =>
                                idx === sIdx
                                  ? { ...st, active: !st.active }
                                  : st
                              ),
                            }))
                          }
                          className="w-full py-0.5 text-center text-[9px] font-bold cursor-pointer truncate"
                          style={{
                            color: cell.active ? '#FFFFFF' : '#6B7280',
                          }}
                        >
                          {cell.active ? noteLabel : '—'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
          ROW 3: BOTTOM EURORACK ROW — VOICE SOUND DESIGNER (7 COLS) + BIOSPHERE (5 COLS)
          ==================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 relative z-10 pb-4">
        {/* MODULE 4 (7 Cols): Tabbed Voice Sound Designer */}
        <section className="xl:col-span-7 rounded-xl border border-amber-500/25 bg-[#10141E] p-3 flex flex-col justify-between gap-2.5">
          {/* Header & Voice 1-8 Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: selectedVoice.color }}
              />
              <h2 className="font-studio-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
                {t(
                  'riley.voiceEditorTitle',
                  '04 // VOICE SOUND DESIGNER (ORIGINAL RILEY + FULL SYNTH SUITE)'
                )}
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setSelectedVoiceIdx((i) => (i <= 0 ? 7 : i - 1))
                }
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 font-studio-mono text-[10px] text-gray-300 cursor-pointer"
              >
                ◀
              </button>
              <div className="flex items-center gap-1 overflow-x-auto">
                {patch.voices.map((v, idx) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVoiceIdx(idx)}
                    style={{
                      borderColor:
                        selectedVoiceIdx === idx ? v.color : 'transparent',
                      backgroundColor:
                        selectedVoiceIdx === idx
                          ? `${v.color}28`
                          : 'rgba(255,255,255,0.04)',
                    }}
                    className="px-2 py-0.5 rounded border font-studio-mono text-[10px] font-bold text-white cursor-pointer"
                  >
                    V{idx + 1}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setSelectedVoiceIdx((i) => (i >= 7 ? 0 : i + 1))
                }
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 font-studio-mono text-[10px] text-gray-300 cursor-pointer"
              >
                ▶
              </button>

              <button
                type="button"
                onClick={() => engine.previewVoice(selectedVoiceIdx, 0)}
                className="ml-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 font-studio-mono text-[10px] font-bold text-amber-200 cursor-pointer"
              >
                {t('riley.auditionNote', '🔊 AUDITION')}
              </button>
            </div>
          </div>

          {/* Engine Mode Switch + 10 Curated Voice Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setActiveVoiceTab('synth')}
                className={`px-2.5 py-1 rounded font-studio-mono text-[10px] font-bold cursor-pointer transition-colors ${
                  activeVoiceTab === 'synth'
                    ? 'bg-amber-400 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {isJa ? '🎛️ 音源エンジン' : '🎛️ SYNTH ENGINE'}
              </button>
              <button
                type="button"
                onClick={() => setActiveVoiceTab('fx')}
                className={`px-2.5 py-1 rounded font-studio-mono text-[10px] font-bold cursor-pointer transition-colors ${
                  activeVoiceTab === 'fx'
                    ? 'bg-indigo-400 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {isJa ? '⚡ エフェクトラック (FX)' : '⚡ VOICE FX RACK'}
              </button>
            </div>

            {activeVoiceTab === 'synth' ? (
              <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
                <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-white/10">
                  {(['ORIGINAL_RILEY', 'FULL_SYNTH_SUITE'] as EngineMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          updateVoice(selectedVoiceIdx, (cur) => ({
                            ...cur,
                            mode: m,
                          }))
                        }
                        className={`px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer transition-colors ${
                          selectedVoice.mode === m
                            ? m === 'ORIGINAL_RILEY'
                              ? 'bg-amber-400 text-black'
                              : 'bg-sky-400 text-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {m === 'ORIGINAL_RILEY'
                          ? isJa ? 'ORIGINAL' : 'ORIGINAL'
                          : isJa ? 'PRO SYNTH' : 'PRO SYNTH'}
                      </button>
                    )
                  )}
                </div>

                {/* 10 Voice Presets Dropdown */}
                <div className="flex items-center gap-1 min-w-[200px]">
                  {selectedVoice.mode === 'ORIGINAL_RILEY' ? (
                    <select
                      aria-label="Original Riley Voice Preset"
                      onChange={(e) => {
                        const found = ORIGINAL_RILEY_VOICE_PRESETS.find(
                          (p) => p.id === e.target.value
                        );
                        if (found) {
                          updateVoice(selectedVoiceIdx, (cur) => ({
                            ...cur,
                            riley: { ...found.params },
                          }));
                        }
                      }}
                      defaultValue=""
                      className="h-6 px-1.5 rounded bg-black/60 border border-amber-500/40 font-studio-mono text-[9px] font-bold text-amber-200 flex-1 cursor-pointer"
                    >
                      <option value="" disabled>
                        {isJa
                          ? '▼ 10音色プリセット...'
                          : '▼ 10 Voice Presets...'}
                      </option>
                      {ORIGINAL_RILEY_VOICE_PRESETS.map((vp, idx) => (
                        <option key={vp.id} value={vp.id} className="bg-[#10141E]">
                          {idx + 1}. {isJa ? vp.nameJa : vp.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      aria-label="Full Synth Suite Voice Preset"
                      onChange={(e) => {
                        const found = FULL_SYNTH_VOICE_PRESETS.find(
                          (p) => p.id === e.target.value
                        );
                        if (found) {
                          updateVoice(selectedVoiceIdx, (cur) => ({
                            ...cur,
                            synth: JSON.parse(
                              JSON.stringify(found.params)
                            ) as FullSynthParams,
                          }));
                        }
                      }}
                      defaultValue=""
                      className="h-6 px-1.5 rounded bg-black/60 border border-sky-500/40 font-studio-mono text-[9px] font-bold text-sky-200 flex-1 cursor-pointer"
                    >
                      <option value="" disabled>
                        {isJa
                          ? '▼ 10音色プリセット...'
                          : '▼ 10 Voice Presets...'}
                      </option>
                      {FULL_SYNTH_VOICE_PRESETS.map((vp, idx) => (
                        <option key={vp.id} value={vp.id} className="bg-[#10141E]">
                          {idx + 1}. {isJa ? vp.nameJa : vp.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ) : (
              /* FX Unit Selector Buttons */
              <div className="flex items-center gap-1 font-studio-mono text-[9px]">
                {(['echo', 'delay', 'flanger', 'phaser', 'compressor'] as const).map((fxKey) => {
                  const isEnabled = selectedVoice.fx?.[fxKey]?.enabled;
                  const isActive = activeVoiceFxTab === fxKey;
                  return (
                    <button
                      key={fxKey}
                      type="button"
                      onClick={() => setActiveVoiceFxTab(fxKey)}
                      className={`px-2 py-1 rounded uppercase font-bold border cursor-pointer ${
                        isActive
                          ? 'bg-indigo-500 text-white border-indigo-400'
                          : isEnabled
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {fxKey.toUpperCase()}
                      {isEnabled ? ' ●' : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Voice Editor: SYNTH ENGINE or FX RACK */}
          {activeVoiceTab === 'synth' ? (
            /* Active Engine Parameter Controls (ORIGINAL_RILEY or FULL_SYNTH_SUITE) */
            selectedVoice.mode === 'ORIGINAL_RILEY' ? (
            <div className="space-y-3 bg-black/35 p-3 rounded-lg border border-white/5">
              {/* Model Selector: ORGAN / PLUCK / PAD */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-studio-mono text-[10px]">
                  <span className="text-gray-400">
                    {isJa ? '音源モデル:' : 'RILEY MODEL:'}
                  </span>
                  {(['organ', 'pluck', 'pad'] as RileyModel[]).map((mdl) => (
                    <button
                      key={mdl}
                      type="button"
                      onClick={() =>
                        updateVoice(selectedVoiceIdx, (cur) => ({
                          ...cur,
                          riley: { ...cur.riley, model: mdl },
                        }))
                      }
                      className={`px-2.5 py-1 rounded uppercase font-bold cursor-pointer ${
                        selectedVoice.riley.model === mdl
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/5 text-gray-300 hover:bg-white/15'
                      }`}
                    >
                      {mdl}
                    </button>
                  ))}
                </div>
                <span className="font-studio-mono text-[10px] text-gray-400">
                  {ecoMode
                    ? isJa
                      ? '⚡ 省電力: 3ドローバー＋共有ビブラートLFO'
                      : '⚡ Eco: 3 Drawbars + Shared Vibrato Bus'
                    : isJa
                      ? '5倍音ドローバー＋独立ビブラートLFO'
                      : '5 Additive Drawbars + Per-Note Vibrato'}
                </span>
              </div>

              {/* 8 Knobs for Original Riley + Channel Strip */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 justify-items-center">
                <RotaryKnob
                  size="sm"
                  label="CUTOFF"
                  value={selectedVoice.riley.cutoff}
                  min={180}
                  max={8500}
                  step={10}
                  defaultValue={2400}
                  accentColor={selectedVoice.color}
                  formatValue={(v) => `${Math.round(v)}Hz`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      riley: { ...cur.riley, cutoff: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="RESON"
                  value={selectedVoice.riley.resonance}
                  min={0.5}
                  max={12}
                  step={0.1}
                  defaultValue={2.0}
                  accentColor={selectedVoice.color}
                  formatValue={(v) => v.toFixed(1)}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      riley: { ...cur.riley, resonance: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="ATTACK"
                  value={selectedVoice.riley.attack}
                  min={0.005}
                  max={0.45}
                  step={0.005}
                  defaultValue={0.015}
                  accentColor={selectedVoice.color}
                  formatValue={(v) => `${Math.round(v * 1000)}ms`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      riley: { ...cur.riley, attack: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="RELEASE"
                  value={selectedVoice.riley.release}
                  min={0.06}
                  max={1.4}
                  step={0.01}
                  defaultValue={0.38}
                  accentColor={selectedVoice.color}
                  formatValue={(v) => `${v.toFixed(2)}s`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      riley: { ...cur.riley, release: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="BRIGHT"
                  value={selectedVoice.riley.brightness}
                  min={0.05}
                  max={1.0}
                  step={0.01}
                  defaultValue={0.7}
                  accentColor={selectedVoice.color}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      riley: { ...cur.riley, brightness: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="VOLUME"
                  value={selectedVoice.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.75}
                  accentColor="#10B981"
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      volume: val,
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="PAN"
                  bipolar
                  value={selectedVoice.pan}
                  min={-1}
                  max={1}
                  step={0.02}
                  defaultValue={0}
                  accentColor="#38BDF8"
                  formatValue={(v) =>
                    Math.abs(v) < 0.03
                      ? 'C'
                      : v < 0
                        ? `L${Math.round(Math.abs(v) * 100)}`
                        : `R${Math.round(v * 100)}`
                  }
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      pan: val,
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="TAPE SEND"
                  value={selectedVoice.tapeSend}
                  min={0}
                  max={0.7}
                  step={0.01}
                  defaultValue={0.35}
                  accentColor="#A855F7"
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      tapeSend: val,
                    }))
                  }
                />
              </div>
            </div>
          ) : (
            /* FULL SYNTH SUITE EDITOR */
            <div className="space-y-2.5 bg-black/35 p-2.5 rounded-lg border border-white/5 font-studio-mono text-[10px]">
              {/* Top Row: OSC 1, OSC 2, Sub, Noise, Filter Mode & LFO selectors */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                <div className="bg-black/40 p-1.5 rounded border border-white/5">
                  <div className="text-[9px] text-gray-400">OSC 1 WAVE</div>
                  <select
                    value={selectedVoice.synth.osc1Wave}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          osc1Wave: e.target.value as OscWave,
                        },
                      }))
                    }
                    className="w-full h-5 bg-black/60 rounded border border-white/15 text-sky-200 text-[10px] cursor-pointer"
                  >
                    <option value="sawtooth">Sawtooth</option>
                    <option value="square">Square</option>
                    <option value="triangle">Triangle</option>
                    <option value="sine">Sine</option>
                  </select>
                </div>

                <div className="bg-black/40 p-1.5 rounded border border-white/5">
                  <div className="text-[9px] text-gray-400">OSC 2 WAVE</div>
                  <select
                    value={selectedVoice.synth.osc2Wave}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          osc2Wave: e.target.value as OscWave,
                        },
                      }))
                    }
                    className="w-full h-5 bg-black/60 rounded border border-white/15 text-sky-200 text-[10px] cursor-pointer"
                  >
                    <option value="sawtooth">Sawtooth</option>
                    <option value="square">Square</option>
                    <option value="triangle">Triangle</option>
                    <option value="sine">Sine</option>
                  </select>
                </div>

                <div className="bg-black/40 p-1.5 rounded border border-white/5">
                  <div className="text-[9px] text-gray-400">FILTER MODE</div>
                  <select
                    value={selectedVoice.synth.filterMode}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          filterMode: e.target.value as FilterMode,
                        },
                      }))
                    }
                    className="w-full h-5 bg-black/60 rounded border border-white/15 text-amber-200 text-[10px] cursor-pointer"
                  >
                    <option value="LP24">LP24 (4-Pole)</option>
                    <option value="LP12">LP12 (2-Pole)</option>
                    <option value="BP12">BP12 (Band)</option>
                    <option value="HP12">HP12 (High)</option>
                  </select>
                </div>

                <div className="bg-black/40 p-1.5 rounded border border-white/5">
                  <div className="text-[9px] text-gray-400">SUB / NOISE</div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(selectedVoiceIdx, (cur) => ({
                          ...cur,
                          synth: {
                            ...cur.synth,
                            subOctave: cur.synth.subOctave === -1 ? -2 : -1,
                          },
                        }))
                      }
                      className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-200 text-[9px] cursor-pointer"
                    >
                      {selectedVoice.synth.subOctave}Oct
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateVoice(selectedVoiceIdx, (cur) => ({
                          ...cur,
                          synth: {
                            ...cur.synth,
                            noiseType:
                              cur.synth.noiseType === 'white'
                                ? 'pink'
                                : 'white',
                          },
                        }))
                      }
                      className="px-1.5 py-0.5 rounded bg-white/10 text-pink-200 text-[9px] uppercase cursor-pointer"
                    >
                      {selectedVoice.synth.noiseType}
                    </button>
                  </div>
                </div>

                <div className="bg-black/40 p-1.5 rounded border border-white/5">
                  <div className="text-[9px] text-gray-400">LFO WAVE</div>
                  <select
                    value={selectedVoice.synth.lfoWave}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          lfoWave: e.target.value as LfoWave,
                        },
                      }))
                    }
                    className="w-full h-5 bg-black/60 rounded border border-white/15 text-emerald-200 text-[10px] cursor-pointer"
                  >
                    <option value="sine">Sine</option>
                    <option value="triangle">Triangle</option>
                    <option value="square">Square</option>
                    <option value="sh">S&amp;H Step</option>
                  </select>
                </div>

                <div className="bg-black/40 p-1.5 rounded border border-white/5">
                  <div className="text-[9px] text-gray-400">LFO DEST</div>
                  <select
                    value={selectedVoice.synth.lfoDest}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          lfoDest: e.target.value as LfoDest,
                        },
                      }))
                    }
                    className="w-full h-5 bg-black/60 rounded border border-white/15 text-emerald-200 text-[10px] cursor-pointer"
                  >
                    <option value="cutoff">Filter Cutoff</option>
                    <option value="pitch">Osc Pitch</option>
                    <option value="detune">Osc2 Chorus</option>
                    <option value="pan">Stereo Pan</option>
                  </select>
                </div>
              </div>

              {/* 8 Primary Synth Rotary Knobs */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 justify-items-center">
                <RotaryKnob
                  size="sm"
                  label="OSC MIX"
                  value={selectedVoice.synth.oscMix}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.45}
                  accentColor="#38BDF8"
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, oscMix: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="OSC2 SEMI"
                  bipolar
                  value={selectedVoice.synth.osc2Coarse}
                  min={-24}
                  max={24}
                  step={1}
                  defaultValue={12}
                  accentColor="#38BDF8"
                  formatValue={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}st`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, osc2Coarse: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="WAVEFOLD"
                  value={selectedVoice.synth.wavefold}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.25}
                  accentColor="#F59E0B"
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, wavefold: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="SUB LVL"
                  value={selectedVoice.synth.subLevel}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.25}
                  accentColor="#06B6D4"
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, subLevel: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="CUTOFF"
                  value={selectedVoice.synth.cutoff}
                  min={40}
                  max={14000}
                  step={20}
                  defaultValue={2200}
                  accentColor={selectedVoice.color}
                  formatValue={(v) => `${Math.round(v)}Hz`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, cutoff: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="RESON"
                  value={selectedVoice.synth.resonance}
                  min={0.5}
                  max={16}
                  step={0.1}
                  defaultValue={2.4}
                  accentColor={selectedVoice.color}
                  formatValue={(v) => v.toFixed(1)}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, resonance: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="ENV DEPTH"
                  bipolar
                  value={selectedVoice.synth.filterEnvDepth}
                  min={-1}
                  max={1}
                  step={0.02}
                  defaultValue={0.5}
                  accentColor="#10B981"
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, filterEnvDepth: val },
                    }))
                  }
                />
                <RotaryKnob
                  size="sm"
                  label="LFO DEPTH"
                  value={selectedVoice.synth.lfoDepth}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.15}
                  accentColor="#A855F7"
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    updateVoice(selectedVoiceIdx, (cur) => ({
                      ...cur,
                      synth: { ...cur.synth, lfoDepth: val },
                    }))
                  }
                />
              </div>

              {/* Compact AMP ADSR + LFO Rate + Noise Strip */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 border-t border-white/10">
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>AMP ATK</span>
                    <span>{selectedVoice.synth.ampEnv.attack.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0.004}
                    max={1.4}
                    step={0.01}
                    value={selectedVoice.synth.ampEnv.attack}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          ampEnv: {
                            ...cur.synth.ampEnv,
                            attack: Number(e.target.value),
                          },
                        },
                      }))
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>AMP DEC</span>
                    <span>{selectedVoice.synth.ampEnv.decay.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0.004}
                    max={1.4}
                    step={0.01}
                    value={selectedVoice.synth.ampEnv.decay}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          ampEnv: {
                            ...cur.synth.ampEnv,
                            decay: Number(e.target.value),
                          },
                        },
                      }))
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>AMP SUS</span>
                    <span>
                      {Math.round(selectedVoice.synth.ampEnv.sustain * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.005}
                    max={1}
                    step={0.01}
                    value={selectedVoice.synth.ampEnv.sustain}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          ampEnv: {
                            ...cur.synth.ampEnv,
                            sustain: Number(e.target.value),
                          },
                        },
                      }))
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>AMP REL</span>
                    <span>
                      {selectedVoice.synth.ampEnv.release.toFixed(2)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.004}
                    max={1.4}
                    step={0.01}
                    value={selectedVoice.synth.ampEnv.release}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          ampEnv: {
                            ...cur.synth.ampEnv,
                            release: Number(e.target.value),
                          },
                        },
                      }))
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>LFO RATE</span>
                    <span>{selectedVoice.synth.lfoRate.toFixed(1)}Hz</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={12}
                    step={0.1}
                    value={selectedVoice.synth.lfoRate}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          lfoRate: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>NOISE</span>
                    <span>
                      {Math.round(selectedVoice.synth.noiseLevel * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={selectedVoice.synth.noiseLevel}
                    onChange={(e) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        synth: {
                          ...cur.synth,
                          noiseLevel: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-pink-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
            )
          ) : (
            /* FX RACK EDITOR FOR SELECTED VOICE */
            <div className="space-y-3 bg-black/35 p-3 rounded-lg border border-indigo-500/20">
              {/* FX Unit Header: Enable Toggle, Sync Toggle, Sync Rate */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-studio-mono text-xs font-bold text-indigo-300 uppercase">
                    {activeVoiceFxTab}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateVoice(selectedVoiceIdx, (cur) => {
                        const unit = cur.fx[activeVoiceFxTab];
                        return {
                          ...cur,
                          fx: {
                            ...cur.fx,
                            [activeVoiceFxTab]: {
                              ...unit,
                              enabled: !unit.enabled,
                            },
                          },
                        };
                      });
                    }}
                    className={`px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold border cursor-pointer ${
                      selectedVoice.fx[activeVoiceFxTab].enabled
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-400'
                    }`}
                  >
                    {selectedVoice.fx[activeVoiceFxTab].enabled ? 'ACTIVE' : 'BYPASS'}
                  </button>
                </div>

                {activeVoiceFxTab !== 'compressor' && (
                  <div className="flex items-center gap-1.5 font-studio-mono text-[9px]">
                    <button
                      type="button"
                      onClick={() => {
                        updateVoice(selectedVoiceIdx, (cur) => {
                          const unit = cur.fx[activeVoiceFxTab as 'echo' | 'delay' | 'flanger' | 'phaser'];
                          return {
                            ...cur,
                            fx: {
                              ...cur.fx,
                              [activeVoiceFxTab]: {
                                ...unit,
                                sync: !unit.sync,
                              },
                            },
                          };
                        });
                      }}
                      className={`px-2 py-0.5 rounded border font-bold cursor-pointer ${
                        (selectedVoice.fx[activeVoiceFxTab as 'echo' | 'delay' | 'flanger' | 'phaser']).sync
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      {(selectedVoice.fx[activeVoiceFxTab as 'echo' | 'delay' | 'flanger' | 'phaser']).sync
                        ? '⏱ SYNC'
                        : '∞ FREE'}
                    </button>

                    <select
                      aria-label="FX Sync Rate"
                      value={(selectedVoice.fx[activeVoiceFxTab as 'echo' | 'delay' | 'flanger' | 'phaser']).syncRate}
                      onChange={(e) => {
                        const val = e.target.value as VoiceFxSyncRate;
                        updateVoice(selectedVoiceIdx, (cur) => {
                          const unit = cur.fx[activeVoiceFxTab as 'echo' | 'delay' | 'flanger' | 'phaser'];
                          return {
                            ...cur,
                            fx: {
                              ...cur.fx,
                              [activeVoiceFxTab]: {
                                ...unit,
                                syncRate: val,
                              },
                            },
                          };
                        });
                      }}
                      className="h-6 px-1.5 rounded bg-black/70 border border-white/10 text-[9px] text-gray-300 cursor-pointer"
                    >
                      {(['free', '1/16', '1/8', '1/4', '1/2', '1-bar', '2-bar', '4-bar'] as VoiceFxSyncRate[]).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* FX Knobs per active unit */}
              {activeVoiceFxTab === 'echo' && (
                <div className="grid grid-cols-4 gap-2 items-center justify-items-center py-2">
                  <RotaryKnob
                    size="sm"
                    label="TIME"
                    value={selectedVoice.fx.echo.timeMs}
                    min={20}
                    max={1000}
                    step={10}
                    defaultValue={240}
                    accentColor="#818CF8"
                    formatValue={(v) => `${Math.round(v)}ms`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, echo: { ...cur.fx.echo, timeMs: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="FEEDBACK"
                    value={selectedVoice.fx.echo.feedback}
                    min={0}
                    max={0.85}
                    step={0.01}
                    defaultValue={0.35}
                    accentColor="#818CF8"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, echo: { ...cur.fx.echo, feedback: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="TONE"
                    value={selectedVoice.fx.echo.toneHz}
                    min={300}
                    max={8000}
                    step={50}
                    defaultValue={2800}
                    accentColor="#818CF8"
                    formatValue={(v) => `${Math.round(v)}Hz`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, echo: { ...cur.fx.echo, toneHz: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="MIX"
                    value={selectedVoice.fx.echo.mix}
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={0.35}
                    accentColor="#818CF8"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, echo: { ...cur.fx.echo, mix: val } },
                      }))
                    }
                  />
                </div>
              )}

              {activeVoiceFxTab === 'delay' && (
                <div className="grid grid-cols-4 gap-2 items-center justify-items-center py-2">
                  <RotaryKnob
                    size="sm"
                    label="TIME"
                    value={selectedVoice.fx.delay.timeMs}
                    min={50}
                    max={1600}
                    step={10}
                    defaultValue={380}
                    accentColor="#6366F1"
                    formatValue={(v) => `${Math.round(v)}ms`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, delay: { ...cur.fx.delay, timeMs: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="FEEDBACK"
                    value={selectedVoice.fx.delay.feedback}
                    min={0}
                    max={0.88}
                    step={0.01}
                    defaultValue={0.45}
                    accentColor="#6366F1"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, delay: { ...cur.fx.delay, feedback: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="CROSSFEED"
                    value={selectedVoice.fx.delay.crossfeed}
                    min={0}
                    max={0.5}
                    step={0.01}
                    defaultValue={0.15}
                    accentColor="#6366F1"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, delay: { ...cur.fx.delay, crossfeed: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="MIX"
                    value={selectedVoice.fx.delay.mix}
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={0.4}
                    accentColor="#6366F1"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, delay: { ...cur.fx.delay, mix: val } },
                      }))
                    }
                  />
                </div>
              )}

              {activeVoiceFxTab === 'flanger' && (
                <div className="grid grid-cols-4 gap-2 items-center justify-items-center py-2">
                  <RotaryKnob
                    size="sm"
                    label="RATE"
                    value={selectedVoice.fx.flanger.rateHz}
                    min={0.05}
                    max={8}
                    step={0.05}
                    defaultValue={0.4}
                    accentColor="#EC4899"
                    formatValue={(v) => `${v.toFixed(2)}Hz`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, flanger: { ...cur.fx.flanger, rateHz: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="DEPTH"
                    value={selectedVoice.fx.flanger.depthMs}
                    min={0.5}
                    max={8}
                    step={0.1}
                    defaultValue={3.5}
                    accentColor="#EC4899"
                    formatValue={(v) => `${v.toFixed(1)}ms`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, flanger: { ...cur.fx.flanger, depthMs: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="FEEDBACK"
                    bipolar
                    value={selectedVoice.fx.flanger.feedback}
                    min={-0.85}
                    max={0.85}
                    step={0.02}
                    defaultValue={0.45}
                    accentColor="#EC4899"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, flanger: { ...cur.fx.flanger, feedback: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="MIX"
                    value={selectedVoice.fx.flanger.mix}
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={0.4}
                    accentColor="#EC4899"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, flanger: { ...cur.fx.flanger, mix: val } },
                      }))
                    }
                  />
                </div>
              )}

              {activeVoiceFxTab === 'phaser' && (
                <div className="grid grid-cols-4 gap-2 items-center justify-items-center py-2">
                  <RotaryKnob
                    size="sm"
                    label="RATE"
                    value={selectedVoice.fx.phaser.rateHz}
                    min={0.05}
                    max={8}
                    step={0.05}
                    defaultValue={0.25}
                    accentColor="#8B5CF6"
                    formatValue={(v) => `${v.toFixed(2)}Hz`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, phaser: { ...cur.fx.phaser, rateHz: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="DEPTH"
                    value={selectedVoice.fx.phaser.depth}
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={0.65}
                    accentColor="#8B5CF6"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, phaser: { ...cur.fx.phaser, depth: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="FEEDBACK"
                    value={selectedVoice.fx.phaser.feedback}
                    min={0}
                    max={0.85}
                    step={0.01}
                    defaultValue={0.5}
                    accentColor="#8B5CF6"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, phaser: { ...cur.fx.phaser, feedback: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="MIX"
                    value={selectedVoice.fx.phaser.mix}
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={0.45}
                    accentColor="#8B5CF6"
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, phaser: { ...cur.fx.phaser, mix: val } },
                      }))
                    }
                  />
                </div>
              )}

              {activeVoiceFxTab === 'compressor' && (
                <div className="grid grid-cols-5 gap-2 items-center justify-items-center py-2">
                  <RotaryKnob
                    size="sm"
                    label="THRESH"
                    value={selectedVoice.fx.compressor.thresholdDb}
                    min={-48}
                    max={0}
                    step={1}
                    defaultValue={-18}
                    accentColor="#F59E0B"
                    formatValue={(v) => `${Math.round(v)}dB`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, compressor: { ...cur.fx.compressor, thresholdDb: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="RATIO"
                    value={selectedVoice.fx.compressor.ratio}
                    min={1}
                    max={20}
                    step={0.5}
                    defaultValue={4}
                    accentColor="#F59E0B"
                    formatValue={(v) => `${v.toFixed(1)}:1`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, compressor: { ...cur.fx.compressor, ratio: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="ATTACK"
                    value={selectedVoice.fx.compressor.attackSec}
                    min={0.001}
                    max={0.1}
                    step={0.002}
                    defaultValue={0.015}
                    accentColor="#F59E0B"
                    formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, compressor: { ...cur.fx.compressor, attackSec: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="RELEASE"
                    value={selectedVoice.fx.compressor.releaseSec}
                    min={0.02}
                    max={0.8}
                    step={0.01}
                    defaultValue={0.18}
                    accentColor="#F59E0B"
                    formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, compressor: { ...cur.fx.compressor, releaseSec: val } },
                      }))
                    }
                  />
                  <RotaryKnob
                    size="sm"
                    label="GAIN"
                    value={selectedVoice.fx.compressor.gainDb}
                    min={0}
                    max={18}
                    step={0.5}
                    defaultValue={3}
                    accentColor="#F59E0B"
                    formatValue={(v) => `+${v.toFixed(1)}dB`}
                    onChange={(val) =>
                      updateVoice(selectedVoiceIdx, (cur) => ({
                        ...cur,
                        fx: { ...cur.fx, compressor: { ...cur.fx.compressor, gainDb: val } },
                      }))
                    }
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {/* MODULE 5 (5 Cols): Biosphere // Synced Nature Soundscape */}
        <section className="xl:col-span-5 rounded-xl border border-teal-500/25 bg-[#10141E] p-3 flex flex-col justify-between gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <h2 className="font-studio-mono text-[10px] font-bold uppercase tracking-wider text-teal-300">
                {t(
                  'riley.biosphereTitle',
                  '05 // BIOSPHERE // SYNCED NATURE SOUNDSCAPE'
                )}
              </h2>
            </div>

            <div className="flex items-center gap-1 font-studio-mono text-[10px]">
              <button
                type="button"
                onClick={() =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: {
                      ...p.biosphere,
                      clockSync: !p.biosphere.clockSync,
                    },
                  }))
                }
                className={`h-6 px-2 rounded border font-bold cursor-pointer ${
                  patch.biosphere.clockSync
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {patch.biosphere.clockSync
                  ? t('riley.clkSync', '⏱ CLK SYNC')
                  : t('riley.freeRun', '∞ FREE RUN')}
              </button>

              <button
                type="button"
                onClick={() =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: {
                      ...p.biosphere,
                      enabled: !p.biosphere.enabled,
                    },
                  }))
                }
                className={`h-6 px-2 rounded border font-bold cursor-pointer ${
                  patch.biosphere.enabled
                    ? 'bg-teal-500/25 border-teal-400 text-teal-200'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {patch.biosphere.enabled
                  ? t('riley.bioActive', '🌿 ACTIVE')
                  : t('riley.bioMuted', '🔇 MUTED')}
              </button>
            </div>
          </div>

          {/* Biosphere Master Level & Ocean Wave Swell Cycle Selector (Free, 4-Bar, 8-Bar) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-black/40 p-2 rounded-lg border border-white/5 font-studio-mono text-[10px]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-gray-300">
                <span>{isJa ? '環境音マスター音量' : 'BIOSPHERE MASTER'}</span>
                <span className="text-teal-300 font-bold">
                  {Math.round(patch.biosphere.masterVol * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={patch.biosphere.masterVol}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: {
                      ...p.biosphere,
                      masterVol: Number(e.target.value),
                    },
                  }))
                }
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-gray-400 text-[9px]">
                {isJa ? '波スウェル周期 (WAVE SWELL):' : 'OCEAN WAVE SWELL:'}
              </span>
              <div className="grid grid-cols-3 gap-1">
                {([0, 4, 8] as const).map((bars) => (
                  <button
                    key={bars}
                    type="button"
                    onClick={() =>
                      setPatch((p) => ({
                        ...p,
                        biosphere: { ...p.biosphere, waveSyncBars: bars },
                      }))
                    }
                    className={`py-1 rounded text-[9px] font-bold border cursor-pointer ${
                      patch.biosphere.waveSyncBars === bars
                        ? 'bg-teal-400 text-black border-teal-300'
                        : 'bg-white/5 border-white/10 text-gray-300'
                    }`}
                  >
                    {bars === 0
                      ? isJa
                        ? '連続 (Free)'
                        : 'Free'
                      : `${bars}-Bar`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5 Nature Generators: Rain, Stream, Waves, Wind, Distant Thunder */}
          <div className="grid grid-cols-5 gap-1.5 items-center justify-items-center py-1">
            <RotaryKnob
              size="sm"
              label={isJa ? '雨 (RAIN)' : 'RAIN'}
              value={patch.biosphere.rain}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.3}
              accentColor="#38BDF8"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  biosphere: { ...p.biosphere, rain: val },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label={isJa ? 'せせらぎ' : 'STREAM'}
              value={patch.biosphere.stream}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.25}
              accentColor="#06B6D4"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  biosphere: { ...p.biosphere, stream: val },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label={isJa ? '波 (WAVES)' : 'WAVES'}
              value={patch.biosphere.waves}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.35}
              accentColor="#10B981"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  biosphere: { ...p.biosphere, waves: val },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label={isJa ? '風 (WIND)' : 'WIND'}
              value={patch.biosphere.wind}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.3}
              accentColor="#A855F7"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  biosphere: { ...p.biosphere, wind: val },
                }))
              }
            />
            <RotaryKnob
              size="sm"
              label={isJa ? '遠雷確率' : 'THUNDER'}
              value={patch.biosphere.thunderProb}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.15}
              accentColor="#F59E0B"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                setPatch((p) => ({
                  ...p,
                  biosphere: { ...p.biosphere, thunderProb: val },
                }))
              }
            />
          </div>

          {/* Biosphere Individual Preamps & Modulations Strip */}
          <div className="grid grid-cols-5 gap-1.5 p-1.5 rounded-lg bg-black/40 border border-white/5 font-studio-mono text-[9px]">
            {/* Rain Preamp & Mod */}
            <div className="flex flex-col gap-1 items-center text-center">
              <span className="text-sky-300 font-bold">RAIN PRE</span>
              <RotaryKnob
                size="sm"
                label="PREAMP"
                value={patch.biosphere.rainPreamp ?? 1.0}
                min={0.2}
                max={3.0}
                step={0.05}
                defaultValue={1.0}
                accentColor="#38BDF8"
                formatValue={(v) => `${v.toFixed(1)}x`}
                onChange={(val) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, rainPreamp: val },
                  }))
                }
              />
              <select
                aria-label="Rain Mod Rate"
                value={patch.biosphere.rainModRate ?? '4-bar'}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, rainModRate: e.target.value as BiosphereModRate },
                  }))
                }
                className="w-full h-5 rounded bg-black/70 border border-white/10 text-[8px] text-gray-300 cursor-pointer"
              >
                {(['free', '1/16', '1/8', '1/4', '1/2', '1-bar', '2-bar', '4-bar', '8-bar'] as BiosphereModRate[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Stream Preamp & Mod */}
            <div className="flex flex-col gap-1 items-center text-center">
              <span className="text-cyan-300 font-bold">STREAM PRE</span>
              <RotaryKnob
                size="sm"
                label="PREAMP"
                value={patch.biosphere.streamPreamp ?? 1.2}
                min={0.2}
                max={3.0}
                step={0.05}
                defaultValue={1.2}
                accentColor="#06B6D4"
                formatValue={(v) => `${v.toFixed(1)}x`}
                onChange={(val) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, streamPreamp: val },
                  }))
                }
              />
              <select
                aria-label="Stream Mod Rate"
                value={patch.biosphere.streamModRate ?? '2-bar'}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, streamModRate: e.target.value as BiosphereModRate },
                  }))
                }
                className="w-full h-5 rounded bg-black/70 border border-white/10 text-[8px] text-gray-300 cursor-pointer"
              >
                {(['free', '1/16', '1/8', '1/4', '1/2', '1-bar', '2-bar', '4-bar', '8-bar'] as BiosphereModRate[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Waves Preamp & Mod */}
            <div className="flex flex-col gap-1 items-center text-center">
              <span className="text-emerald-300 font-bold">WAVES PRE</span>
              <RotaryKnob
                size="sm"
                label="PREAMP"
                value={patch.biosphere.wavesPreamp ?? 1.1}
                min={0.2}
                max={3.0}
                step={0.05}
                defaultValue={1.1}
                accentColor="#10B981"
                formatValue={(v) => `${v.toFixed(1)}x`}
                onChange={(val) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, wavesPreamp: val },
                  }))
                }
              />
              <select
                aria-label="Waves Mod Rate"
                value={patch.biosphere.wavesModRate ?? '8-bar'}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, wavesModRate: e.target.value as BiosphereModRate },
                  }))
                }
                className="w-full h-5 rounded bg-black/70 border border-white/10 text-[8px] text-gray-300 cursor-pointer"
              >
                {(['free', '1/16', '1/8', '1/4', '1/2', '1-bar', '2-bar', '4-bar', '8-bar'] as BiosphereModRate[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Wind Preamp & Mod */}
            <div className="flex flex-col gap-1 items-center text-center">
              <span className="text-purple-300 font-bold">WIND PRE</span>
              <RotaryKnob
                size="sm"
                label="PREAMP"
                value={patch.biosphere.windPreamp ?? 1.0}
                min={0.2}
                max={3.0}
                step={0.05}
                defaultValue={1.0}
                accentColor="#A855F7"
                formatValue={(v) => `${v.toFixed(1)}x`}
                onChange={(val) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, windPreamp: val },
                  }))
                }
              />
              <select
                aria-label="Wind Mod Rate"
                value={patch.biosphere.windModRate ?? '4-bar'}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, windModRate: e.target.value as BiosphereModRate },
                  }))
                }
                className="w-full h-5 rounded bg-black/70 border border-white/10 text-[8px] text-gray-300 cursor-pointer"
              >
                {(['free', '1/16', '1/8', '1/4', '1/2', '1-bar', '2-bar', '4-bar', '8-bar'] as BiosphereModRate[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Thunder Preamp & Trigger Input Jack */}
            <div className="flex flex-col gap-1 items-center text-center">
              <span className="text-amber-300 font-bold">THUNDER PRE</span>
              <RotaryKnob
                size="sm"
                label="PREAMP"
                value={patch.biosphere.thunderPreamp ?? 1.2}
                min={0.2}
                max={3.0}
                step={0.05}
                defaultValue={1.2}
                accentColor="#F59E0B"
                formatValue={(v) => `${v.toFixed(1)}x`}
                onChange={(val) =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: { ...p.biosphere, thunderPreamp: val },
                  }))
                }
              />
              {/* THUNDER TRIG IN Jack */}
              <button
                type="button"
                data-riley-jack="bio-thunder-trig"
                onClick={(e) => handleJackClick('bio-thunder-trig', 'in', e)}
                title={
                  isJa
                    ? 'THUNDER TRIG IN 端子（シーケンサーのTRIG OUTから結線して雷発火）'
                    : 'THUNDER TRIG IN Jack (Patch from sequencer TRIG OUT)'
                }
                className={`h-5 px-1.5 rounded-full border flex items-center gap-0.5 cursor-pointer text-[8px] ${
                  activeSourceJack
                    ? 'bg-amber-500/30 border-amber-300 text-white animate-pulse'
                    : patch.cables.some((c) => c.to === 'bio-thunder-trig')
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : 'bg-black/60 border-white/20 text-gray-400 hover:border-amber-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>TRIG IN</span>
              </button>
            </div>
          </div>

          {/* Rain Droplet Sync, Soft/Heavy Rain Filter & Test Thunder Trigger */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-white/10 font-studio-mono text-[10px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: {
                      ...p.biosphere,
                      rainDropletSync: !p.biosphere.rainDropletSync,
                    },
                  }))
                }
                title={
                  isJa
                    ? '3拍・5拍ポリリズムの雨雫シンセ音（省電力モード時は自動オフ）'
                    : 'Polyrhythmic droplets on tick % 3 === 0 || tick % 5 === 0'
                }
                className={`px-2 py-1 rounded border font-bold cursor-pointer ${
                  patch.biosphere.rainDropletSync
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                💧 DROP SYNC: {patch.biosphere.rainDropletSync ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                onClick={() =>
                  setPatch((p) => ({
                    ...p,
                    biosphere: {
                      ...p.biosphere,
                      rainHeavy: !p.biosphere.rainHeavy,
                    },
                  }))
                }
                className={`px-2 py-1 rounded border font-bold cursor-pointer ${
                  patch.biosphere.rainHeavy
                    ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200'
                    : 'bg-white/5 border-white/10 text-gray-300'
                }`}
              >
                {patch.biosphere.rainHeavy
                  ? isJa
                    ? '🌧️ 豪雨 (2.1kHz)'
                    : '🌧️ HEAVY (2.1kHz)'
                  : isJa
                    ? '🌦️ 霧雨 (3.4kHz)'
                    : '🌦️ SOFT (3.4kHz)'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => engine.triggerThunder()}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 font-bold text-amber-200 cursor-pointer"
            >
              {t('riley.testThunder', '⚡ TEST THUNDER')}
            </button>
          </div>
        </section>
      </div>

      {/* ====================================================================
          SAVE AS MODAL DIALOG
          ==================================================================== */}
      {saveAsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setSaveAsModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-amber-500/40 bg-[#10141E] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-studio-mono text-sm font-bold text-amber-300">
              {isJa
                ? '💾 新規ユーザーパッチとして保存 (RileyRack800_DB)'
                : '💾 Save As New User Patch (RileyRack800_DB)'}
            </h3>
            <input
              type="text"
              value={saveAsNameInput}
              onChange={(e) => setSaveAsNameInput(e.target.value)}
              placeholder={isJa ? 'パッチ名を入力...' : 'Enter patch name...'}
              className="w-full h-9 px-3 rounded-lg bg-black/60 border border-white/20 font-studio-mono text-xs text-white"
              autoFocus
            />
            <div className="flex justify-end gap-2 font-studio-mono text-xs">
              <button
                type="button"
                onClick={() => setSaveAsModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15 cursor-pointer"
              >
                {isJa ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSaveAs()}
                className="px-4 py-1.5 rounded-lg bg-amber-400 text-black font-bold hover:bg-amber-300 cursor-pointer"
              >
                {isJa ? '保存する' : 'Save Patch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          ALERT / TOAST MODAL
          ==================================================================== */}
      <ConfirmModal
        open={Boolean(toastMessage)}
        title={toastMessage?.title ?? ''}
        message={toastMessage?.message ?? ''}
        variant={toastMessage?.variant ?? 'info'}
        alertOnly
        accentColor="#F59E0B"
        onConfirm={() => setToastMessage(null)}
      />
    </div>
  );
};

/**
 * Section 1.3: Public root export wrapped in `RackErrorBoundary`
 */
export const RileyRackInstrument: React.FC<
  Partial<InstrumentComponentProps>
> = (props) => {
  return (
    <RackErrorBoundary>
      <RileyRackContent {...props} />
    </RackErrorBoundary>
  );
};
