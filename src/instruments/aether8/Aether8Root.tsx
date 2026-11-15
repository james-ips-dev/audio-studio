import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createInstrumentStorage,
  IncompatiblePatchError,
} from '../../core/storageFactory';
import type {
  InstrumentComponentProps,
  StoredPatchRecord,
} from '../../core/types';
import { ConfirmModal } from '../../shared-ui/ConfirmModal';
import { LiveStereoWavRecorder } from '../../shared-ui/WavExporter';
import {
  Aether8AudioEngine,
  type Aether8Telemetry,
} from './audio/Aether8AudioEngine';
import { Aether8HeaderBar } from './components/Aether8HeaderBar';
import { OutputConsoleDrawer } from './components/OutputConsoleDrawer';
import { PatchCableOverlay } from './components/PatchCableOverlay';
import { Row1BeatAndSynth } from './components/Row1BeatAndSynth';
import { Row2DroneNoiseFilter } from './components/Row2DroneNoiseFilter';
import { Row3PulseModFxMixer } from './components/Row3PulseModFxMixer';
import { Row4BiosphereLab } from './components/Row4BiosphereLab';
import {
  AETHER8_FACTORY_PATCHES,
  createXoxPatternFromStyle,
} from './presets/factoryPatches';
import type {
  Aether8PatchV4,
  BeatVoiceKey,
  BeatVoiceSynthConfig,
  ChordVoicingType,
  DirectOutputChannelKey,
  ModMatrixSlot,
  NoiseSpectrumColor,
  OutputChannelFxConfig,
  PatchCable,
  PatternBankId,
  SignalDomain,
  TimbreCharacter,
  ZdfFilterMode,
} from './types';

function clonePatch(p: Aether8PatchV4): Aether8PatchV4 {
  return JSON.parse(JSON.stringify(p)) as Aether8PatchV4;
}

const INITIAL_TELEMETRY: Aether8Telemetry = {
  globalStep: 0,
  xoxTrackSteps: [0, 0, 0, 0],
  euclidStep: 0,
  lfo1Val: 0,
  lfo2Val: 0,
  chaosVal: 0,
  shVal: 0,
  beatEnvFollower: 0,
  activePattern: 'A',
};

export const Aether8Root: React.FC<InstrumentComponentProps> = ({
  storageNamespace,
  registerHandle,
}) => {
  const storage = useMemo(
    () =>
      createInstrumentStorage<Aether8PatchV4>(
        storageNamespace,
        'aether8',
        'v4.0'
      ),
    [storageNamespace]
  );

  const [patch, setPatch] = useState<Aether8PatchV4>(() =>
    clonePatch(AETHER8_FACTORY_PATCHES[0].patch)
  );
  const [engine] = useState<Aether8AudioEngine>(
    () => new Aether8AudioEngine(clonePatch(AETHER8_FACTORY_PATCHES[0].patch))
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [telemetry, setTelemetry] =
    useState<Aether8Telemetry>(INITIAL_TELEMETRY);
  const [visibleBar, setVisibleBar] = useState<number>(0);

  // Drawers
  const [mixerDrawerOpen, setMixerDrawerOpen] = useState(false);
  const [modMatrixOpen, setModMatrixOpen] = useState(false);

  // Interactive Patching State
  const chassisRef = useRef<HTMLDivElement | null>(null);
  const [activeFromJack, setActiveFromJack] = useState<{
    jackId: string;
    domain: SignalDomain;
  } | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(
    null
  );

  // WAV Recorder
  const wavRecorderRef = useRef<LiveStereoWavRecorder | null>(null);
  const [isWavRecording, setIsWavRecording] = useState(false);

  // Vault / IndexedDB State
  const [savedPatches, setSavedPatches] = useState<
    StoredPatchRecord<Aether8PatchV4>[]
  >([]);
  const [errorModalMsg, setErrorModalMsg] = useState<string | null>(null);
  const [confirmUnplugOpen, setConfirmUnplugOpen] = useState(false);

  // Sync patch into AudioEngine & Autosave
  useEffect(() => {
    engine.updatePatch(patch);
    void storage.saveAutosave(patch);
  }, [engine, patch, storage]);

  // Subscribe to 30fps Engine Telemetry
  useEffect(() => {
    const unsub = engine.onTelemetry((nextTel: Aether8Telemetry) => {
      setTelemetry(nextTel);
    });
    return unsub;
  }, [engine]);

  // Auto-follow visible bar during playback
  const currentAutoFollowBar = patch.xoxAutoFollow
    ? Math.floor(
        telemetry.globalStep / 16
      ) % patch.xoxPatterns[telemetry.activePattern].barCount
    : visibleBar;

  // Load Vault & Autosave on Mount
  useEffect(() => {
    let active = true;
    void (async () => {
      const list = await storage.listPatches();
      const auto = await storage.loadAutosave();
      if (!active) return;
      setSavedPatches(list);
      if (auto && auto.xoxPatterns) {
        setPatch(auto);
      }
    })();
    return () => {
      active = false;
    };
  }, [storage]);

  // Register Lifecycle Handle with Studio Suite Host Shell
  useEffect(() => {
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
  }, [engine, registerHandle]);

  // Escape key cancels active dangling cable
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeFromJack) {
        setActiveFromJack(null);
        setPointerPos(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeFromJack]);

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

  // Live Stereo WAV Recorder
  const handleToggleWavRecord = useCallback(() => {
    const ctx = engine.ensureInitialized();
    const tap = engine.getMasterGain();
    if (!ctx || !tap) return;

    if (isWavRecording && wavRecorderRef.current) {
      const safeName = (patch.name ?? 'patch')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-');
      wavRecorderRef.current.stopAndExport(`aether8-${safeName}`);
      setIsWavRecording(false);
    } else {
      const rec = new LiveStereoWavRecorder(ctx, tap);
      wavRecorderRef.current = rec;
      rec.start();
      setIsWavRecording(true);
    }
  }, [engine, isWavRecording, patch.name]);

  // Patching Handlers
  const handleSelectJack = useCallback(
    (jackId: string, direction: 'in' | 'out', domain: SignalDomain) => {
      if (direction === 'out') {
        if (activeFromJack?.jackId === jackId) {
          setActiveFromJack(null);
          setPointerPos(null);
        } else {
          setActiveFromJack({ jackId, domain });
        }
        return;
      }

      // Clicking an INPUT jack while holding an active OUTPUT jack creates a cable
      if (direction === 'in' && activeFromJack) {
        const fromId = activeFromJack.jackId;
        const cableType = activeFromJack.domain;
        setPatch((prev) => {
          const exists = prev.cables.some(
            (c) => c.from === fromId && c.to === jackId
          );
          if (exists) return prev;
          const nextCable: PatchCable = {
            id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            from: fromId,
            to: jackId,
            type: cableType,
            attenuation: 1.0,
          };
          return {
            ...prev,
            cables: [...prev.cables, nextCable],
          };
        });
        setActiveFromJack(null);
        setPointerPos(null);
      }
    },
    [activeFromJack]
  );

  const handleRemoveJackCables = useCallback((jackId: string) => {
    setPatch((prev) => ({
      ...prev,
      cables: prev.cables.filter((c) => c.from !== jackId && c.to !== jackId),
    }));
  }, []);

  const handleChassisPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activeFromJack || !chassisRef.current) return;
      const rect = chassisRef.current.getBoundingClientRect();
      setPointerPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [activeFromJack]
  );

  // Module Parameter Updaters
  const handleUpdateModuleParam = useCallback(
    (moduleKey: string, paramKey: string, val: number) => {
      setPatch((prev) => ({
        ...prev,
        params: {
          ...prev.params,
          [moduleKey]: {
            ...(prev.params[moduleKey] ?? {}),
            [paramKey]: val,
          },
        },
      }));
    },
    []
  );

  // Vault Operations
  const handleSaveToVault = useCallback(async () => {
    const patchName = patch.name ?? 'AETHER-8 Patch';
    const patchId = `patch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await storage.savePatch(patchId, patchName, patch);
    const updated = await storage.listPatches();
    setSavedPatches(updated);
  }, [patch, storage]);

  const handleDeleteSavedPatch = useCallback(
    async (id: string) => {
      await storage.deletePatch(id);
      const updated = await storage.listPatches();
      setSavedPatches(updated);
    },
    [storage]
  );

  const handleImportJsonFile = useCallback(
    async (file: File) => {
      try {
        const envelope = await storage.importPatchFromFile(file);
        setPatch(envelope.data);
      } catch (err) {
        if (err instanceof IncompatiblePatchError) {
          setErrorModalMsg(err.message);
        } else {
          setErrorModalMsg(
            err instanceof Error ? err.message : 'Failed to import JSON patch.'
          );
        }
      }
    },
    [storage]
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#0A0D12] text-[#E2E8F0] select-none overflow-hidden">
      {/* Top Instrument Header */}
      <Aether8HeaderBar
        patch={patch}
        engine={engine}
        isPlaying={isPlaying}
        isWavRecording={isWavRecording}
        mixerDrawerOpen={mixerDrawerOpen}
        modMatrixOpen={modMatrixOpen}
        savedPatches={savedPatches}
        dbName={storage.dbName}
        onTogglePlay={handleTogglePlay}
        onToggleWavRecord={handleToggleWavRecord}
        onBpmChange={(bpm) => setPatch((p) => ({ ...p, bpm }))}
        onMasterVolChange={(masterVol) =>
          setPatch((p) => ({ ...p, masterVol }))
        }
        onToggleEco={() =>
          setPatch((p) => ({ ...p, ecoMode: !p.ecoMode }))
        }
        onTimbreToggle={(timbreMode: TimbreCharacter) =>
          setPatch((p) => ({ ...p, timbreMode }))
        }
        onLoadFactoryPatch={(factoryId) => {
          const found = AETHER8_FACTORY_PATCHES.find(
            (f) => f.id === factoryId
          );
          if (found) {
            setPatch(clonePatch(found.patch));
          }
        }}
        onToggleMixerDrawer={() => setMixerDrawerOpen((o) => !o)}
        onToggleModMatrixDrawer={() => setModMatrixOpen((o) => !o)}
        onClearCables={() => setConfirmUnplugOpen(true)}
        onSaveToVault={handleSaveToVault}
        onLoadSavedPatch={(rec) => setPatch(clonePatch(rec.payload))}
        onDeleteSavedPatch={handleDeleteSavedPatch}
        onExportJson={() => {
          const safeName = (patch.name ?? 'aether8-patch')
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, '-');
          storage.exportPatchToJsonFile(
            `aether8-${safeName}.json`,
            patch,
            patch.name ?? 'AETHER-8 Patch'
          );
        }}
        onImportJsonFile={handleImportJsonFile}
      />

      {/* Collapsible 10-Ch Direct Output Console & 6-Slot Mod Matrix Drawer */}
      <OutputConsoleDrawer
        patch={patch}
        mixerOpen={mixerDrawerOpen}
        modMatrixOpen={modMatrixOpen}
        onUpdateOutputChannel={(
          channelKey: DirectOutputChannelKey,
          updater: (prev: OutputChannelFxConfig) => OutputChannelFxConfig
        ) => {
          setPatch((prev) => ({
            ...prev,
            outputMixer: {
              ...prev.outputMixer,
              [channelKey]: updater(prev.outputMixer[channelKey]),
            },
          }));
        }}
        onUpdateModMatrixSlot={(
          slotIdx: number,
          updater: (prev: ModMatrixSlot) => ModMatrixSlot
        ) => {
          setPatch((prev) => ({
            ...prev,
            matrixSlots: prev.matrixSlots.map((s, i) =>
              i === slotIdx ? updater(s) : s
            ),
          }));
        }}
        onCloseDrawers={() => {
          setMixerDrawerOpen(false);
          setModMatrixOpen(false);
        }}
      />

      {/* Active Dangling Cable Banner */}
      {activeFromJack && (
        <div className="bg-amber-500/15 border-b border-amber-400/40 px-4 py-1 flex items-center justify-between font-studio-mono text-[10px] text-amber-300 shrink-0">
          <span>
            🔌 PATCHING ACTIVE FROM{' '}
            <strong className="text-white">{activeFromJack.jackId}</strong> (
            {activeFromJack.domain.toUpperCase()}) — Click any highlighted{' '}
            <strong className="text-amber-200">IN</strong> jack to connect, or
            press <kbd className="px-1 py-0.5 bg-black/50 rounded">ESC</kbd> to
            cancel.
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveFromJack(null);
              setPointerPos(null);
            }}
            className="px-2 py-0.5 rounded bg-black/40 border border-amber-400/40 text-amber-200 hover:bg-black/70 cursor-pointer"
          >
            CANCEL CABLE
          </button>
        </div>
      )}

      {/* Main Scrollable 12-Module Eurorack Chassis with Scoped Bezier Cable Overlay */}
      <div className="flex-1 overflow-y-auto p-3">
        <div
          ref={chassisRef}
          onPointerMove={handleChassisPointerMove}
          className="relative max-w-[1680px] mx-auto flex flex-col gap-3 pb-6"
        >
          {/* Scoped Bezier Patch Cable Canvas Overlay */}
          <PatchCableOverlay
            chassisRef={chassisRef}
            cables={patch.cables}
            activeFromJack={activeFromJack}
            pointerPos={pointerPos}
          />

          {/* ROW 1: 01 // X0X STEP SEQUENCER & 02 // ANALOG BEAT SYNTH */}
          <Row1BeatAndSynth
            patch={patch}
            telemetry={telemetry}
            visibleBar={currentAutoFollowBar}
            activeFromJack={activeFromJack}
            onSelectPatternBank={(bankId: PatternBankId) =>
              setPatch((p) => ({ ...p, activePattern: bankId }))
            }
            onTogglePatternChain={() =>
              setPatch((p) => ({
                ...p,
                patternChainEnabled: !p.patternChainEnabled,
              }))
            }
            onSetBarCount={(barCount: 1 | 2 | 4) =>
              setPatch((p) => ({
                ...p,
                xoxPatterns: {
                  ...p.xoxPatterns,
                  [p.activePattern]: {
                    ...p.xoxPatterns[p.activePattern],
                    barCount,
                  },
                },
              }))
            }
            onSelectVisibleBar={(barIdx) => {
              setVisibleBar(barIdx);
              setPatch((p) => ({ ...p, xoxAutoFollow: false }));
            }}
            onToggleAutoFollow={() =>
              setPatch((p) => ({ ...p, xoxAutoFollow: !p.xoxAutoFollow }))
            }
            onCopyBar1ToAll={() =>
              setPatch((p) => {
                const pat = p.xoxPatterns[p.activePattern];
                const nextSteps = pat.steps.map((tr) => {
                  const bar1 = tr.slice(0, 16);
                  return [...bar1, ...bar1, ...bar1, ...bar1];
                });
                return {
                  ...p,
                  xoxPatterns: {
                    ...p.xoxPatterns,
                    [p.activePattern]: {
                      ...pat,
                      steps: nextSteps,
                    },
                  },
                };
              })
            }
            onGenerateStylePattern={(style) =>
              setPatch((p) => ({
                ...p,
                xoxPatterns: {
                  ...p.xoxPatterns,
                  [p.activePattern]: createXoxPatternFromStyle(
                    style,
                    p.xoxPatterns[p.activePattern].barCount,
                    p.xoxPatterns[p.activePattern].trackLengths
                  ),
                },
              }))
            }
            onSetTrackPolyLength={(trackIdx, len) =>
              setPatch((p) => {
                const pat = p.xoxPatterns[p.activePattern];
                const nextLens: [number, number, number, number] = [
                  ...pat.trackLengths,
                ];
                nextLens[trackIdx] = len;
                return {
                  ...p,
                  xoxPatterns: {
                    ...p.xoxPatterns,
                    [p.activePattern]: {
                      ...pat,
                      trackLengths: nextLens,
                    },
                  },
                };
              })
            }
            onToggleXoxStep={(trackIdx, absStepIdx) =>
              setPatch((p) => {
                const pat = p.xoxPatterns[p.activePattern];
                const nextSteps = pat.steps.map((tr, idx) =>
                  idx === trackIdx
                    ? tr.map((v, sIdx) =>
                        sIdx === absStepIdx ? (v ? 0 : 1) : v
                      )
                    : tr
                );
                return {
                  ...p,
                  xoxPatterns: {
                    ...p.xoxPatterns,
                    [p.activePattern]: {
                      ...pat,
                      steps: nextSteps,
                    },
                  },
                };
              })
            }
            onToggleXoxMute={(trackIdx) =>
              setPatch((p) => {
                const nextMuted: [boolean, boolean, boolean, boolean] = [
                  p.xoxMuted[0],
                  p.xoxMuted[1],
                  p.xoxMuted[2],
                  p.xoxMuted[3],
                ];
                nextMuted[trackIdx] = !nextMuted[trackIdx];
                return { ...p, xoxMuted: nextMuted };
              })
            }
            onToggleXoxNormLink={(trackIdx) =>
              setPatch((p) => {
                const nextNorm: [boolean, boolean, boolean, boolean] = [
                  p.xoxNormLink[0],
                  p.xoxNormLink[1],
                  p.xoxNormLink[2],
                  p.xoxNormLink[3],
                ];
                nextNorm[trackIdx] = !nextNorm[trackIdx];
                return { ...p, xoxNormLink: nextNorm };
              })
            }
            onAuditionBeatVoice={(voiceKey: BeatVoiceKey) => {
              engine.triggerBeatSynthVoice(voiceKey);
            }}
            onUpdateBeatVoice={(
              voiceKey: BeatVoiceKey,
              updater: (prev: BeatVoiceSynthConfig) => BeatVoiceSynthConfig
            ) =>
              setPatch((p) => ({
                ...p,
                beatVoices: {
                  ...p.beatVoices,
                  [voiceKey]: updater(p.beatVoices[voiceKey]),
                },
              }))
            }
            onSelectJack={handleSelectJack}
            onRemoveJackCables={handleRemoveJackCables}
          />

          {/* ROW 2: 03 // MASTER CLOCK, 04 // DRONE SWARM, 05 // NOISE LAB, 06 // ZDF LADDER FILTER */}
          <Row2DroneNoiseFilter
            patch={patch}
            telemetry={telemetry}
            activeFromJack={activeFromJack}
            onToggleClockExtMode={() =>
              setPatch((p) => ({
                ...p,
                clockExtStepMode: !p.clockExtStepMode,
              }))
            }
            onSetChordVoicing={(chordType: ChordVoicingType) =>
              setPatch((p) => ({ ...p, chordType }))
            }
            onSetNoiseColor={(noiseColor: NoiseSpectrumColor) =>
              setPatch((p) => ({ ...p, noiseColor }))
            }
            onSetFilterMode={(filterMode: ZdfFilterMode) =>
              setPatch((p) => ({ ...p, filterMode }))
            }
            onUpdateModuleParam={handleUpdateModuleParam}
            onSelectJack={handleSelectJack}
            onRemoveJackCables={handleRemoveJackCables}
          />

          {/* ROW 3: 07 // VACTROL PULSE, 08 // MODULATION, 09 // LO-FI FX, 10 // DUB DELAY, 11 // MASTER MIXER */}
          <Row3PulseModFxMixer
            patch={patch}
            telemetry={telemetry}
            activeFromJack={activeFromJack}
            onPingVactrol={() => {
              engine.triggerVactrolPing();
            }}
            onUpdateModuleParam={handleUpdateModuleParam}
            onSelectJack={handleSelectJack}
            onRemoveJackCables={handleRemoveJackCables}
          />

          {/* ROW 4: 12 // 5-ENGINE BIOSPHERE & WEATHER SYNTHESIS LAB */}
          <Row4BiosphereLab
            patch={patch}
            activeFromJack={activeFromJack}
            onTriggerThunder={() => {
              engine.triggerThunderStrike();
            }}
            onApplyBioScene={(scene) => {
              if (scene === 'calm-shore') {
                setPatch((p) => ({
                  ...p,
                  params: {
                    ...p.params,
                    biosphere: {
                      ...p.params.biosphere,
                      rainLvl: 0.15,
                      rainSize: 0.35,
                      waterFlow: 0.45,
                      wavesLvl: 0.72,
                      wavePace: 0.22,
                      windGust: 0.25,
                      stormProb: 0.0,
                      bioMaster: 0.78,
                    },
                  },
                }));
              } else {
                setPatch((p) => ({
                  ...p,
                  params: {
                    ...p.params,
                    biosphere: {
                      ...p.params.biosphere,
                      rainLvl: 0.85,
                      rainSize: 0.78,
                      waterFlow: 0.62,
                      wavesLvl: 0.58,
                      wavePace: 0.55,
                      windGust: 0.82,
                      stormProb: 0.65,
                      thunderDecay: 0.85,
                      bioMaster: 0.86,
                    },
                  },
                }));
              }
            }}
            onUpdateModuleParam={handleUpdateModuleParam}
            onSelectJack={handleSelectJack}
            onRemoveJackCables={handleRemoveJackCables}
          />
        </div>
      </div>

      {/* Confirm Unplug All Cables Modal */}
      <ConfirmModal
        open={confirmUnplugOpen}
        title="Unplug All Patch Cables?"
        message="This will remove all active virtual Eurorack patch cables from the AETHER-8 chassis. Internal normalized links (NORM LINK) will remain active."
        confirmLabel="Unplug All Cables"
        variant="danger"
        onConfirm={() => {
          setPatch((p) => ({ ...p, cables: [] }));
          setActiveFromJack(null);
          setConfirmUnplugOpen(false);
        }}
        onCancel={() => setConfirmUnplugOpen(false)}
      />

      {/* Cross-Instrument Patch Import Guard Modal */}
      <ConfirmModal
        open={errorModalMsg !== null}
        title="Incompatible Patch File"
        message={errorModalMsg ?? ''}
        confirmLabel="Understood"
        variant="danger"
        alertOnly
        onConfirm={() => setErrorModalMsg(null)}
        onCancel={() => setErrorModalMsg(null)}
      />
    </div>
  );
};
