import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GrooveboxAudioEngine } from '../../audio/GrooveboxAudioEngine';
import { getScaleNotes, midiToNoteName } from '../../presets/factoryPresets';
import type {
  ArpRateDivision,
  GrooveboxProject,
  KaossAxisDest,
} from '../../types';

const ARP_SYNC_RATES: ArpRateDivision[] = [
  '1/4',
  '1/8',
  '1/8T',
  '1/16',
  '1/16T',
  '1/32',
];

export interface KaossPadTabProps {
  project: GrooveboxProject;
  focusedTrackIndex: number;
  isPlaying?: boolean;
  engine: GrooveboxAudioEngine;
  arpLatchedMidis?: number[];
  onSetArpLatchedMidis?: (notes: number[]) => void;
  onSelectTrack?: (trackIndex: number) => void;
  onTriggerKaossNote: (
    trackIndex: number,
    midiNote: number,
    velocity: number
  ) => void;
  onUpdatePerformance?: (
    updater: (
      prev: GrooveboxProject['performance']
    ) => GrooveboxProject['performance']
  ) => void;
}

type KaossMode = 'synth' | 'fx' | 'arp';

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

const KAOSS_DEST_OPTIONS: { id: KaossAxisDest; label: string }[] = [
  { id: 'cutoff', label: 'Filter Cutoff' },
  { id: 'resonance', label: 'Filter Resonance' },
  { id: 'fmDepth', label: 'OSC 2 → 1 FM Grit' },
  { id: 'delaySend', label: 'Dub Delay Send / FB' },
  { id: 'reverbSend', label: 'Space Reverb Wash' },
  { id: 'pan', label: 'Stereo Pan Sweep' },
  { id: 'pitch', label: 'Pitch Transpose (±12st)' },
  { id: 'decay', label: 'Amp Envelope Decay' },
  { id: 'arpRate', label: 'Arp Sync Speed (1/4 → 1/32)' },
  { id: 'arpPitch', label: 'Arp Pitch / Octave (±18st)' },
];

export const KaossPadTab: React.FC<KaossPadTabProps> = ({
  project,
  focusedTrackIndex,
  isPlaying = false,
  engine,
  arpLatchedMidis = [],
  onSetArpLatchedMidis,
  onSelectTrack,
  onTriggerKaossNote,
  onUpdatePerformance,
}) => {
  const [kaossMode, setKaossMode] = useState<KaossMode>('fx');
  const [customFxTargets, setCustomFxTargets] = useState<number[] | null>(null);
  const selectedTargets = useMemo(
    () =>
      kaossMode === 'fx' && customFxTargets !== null
        ? customFxTargets
        : [focusedTrackIndex],
    [kaossMode, customFxTargets, focusedTrackIndex]
  );
  const [routeMaster, setRouteMaster] = useState<boolean>(true);
  const [holdFreeze, setHoldFreeze] = useState<boolean>(false);
  const [hasFrozenGesture, setHasFrozenGesture] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });

  const xDest: KaossAxisDest = project.performance.kaossXDest ?? 'cutoff';
  const yDest: KaossAxisDest = project.performance.kaossYDest ?? 'resonance';
  const isPro = project.mode === 'pro';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const trailRef = useRef<TrailPoint[]>([]);
  const lastSynthTrigRef = useRef<number>(0);

  // Canvas X/Y Glowing Trail Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const render = () => {
      rafId = requestAnimationFrame(render);
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#090B10';
      ctx.fillRect(0, 0, w, h);

      // Subtle X/Y crosshair grid
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo((w * i) / 4, 0);
        ctx.lineTo((w * i) / 4, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, (h * i) / 4);
        ctx.lineTo(w, (h * i) / 4);
        ctx.stroke();
      }

      // Draw decaying trail
      const pts = trailRef.current;
      for (let i = pts.length - 1; i >= 0; i--) {
        const pt = pts[i];
        ctx.beginPath();
        ctx.arc(pt.x * w, (1 - pt.y) * h, 6 + pt.alpha * 10, 0, Math.PI * 2);
        ctx.fillStyle =
          kaossMode === 'fx'
            ? `rgba(244, 63, 94, ${pt.alpha * 0.45})`
            : kaossMode === 'arp'
              ? `rgba(168, 85, 247, ${pt.alpha * 0.45})`
              : `rgba(56, 189, 248, ${pt.alpha * 0.45})`;
        ctx.fill();
        if (!holdFreeze) {
          pt.alpha -= 0.04;
          if (pt.alpha <= 0) pts.splice(i, 1);
        }
      }
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [holdFreeze, kaossMode]);

  const kaossSpawnedArpRef = useRef<boolean>(false);
  const lastArpTriadRef = useRef<number[]>([]);
  const lastFxPreviewRef = useRef<number>(0);

  const releaseKaossHold = () => {
    setHasFrozenGesture(false);
    engine.setKaossWarp(null, null, [], false);
    if (kaossSpawnedArpRef.current) {
      kaossSpawnedArpRef.current = false;
      lastArpTriadRef.current = [];
      if (!project.performance.arpLatch) {
        onSetArpLatchedMidis?.([]);
      }
    }
    if (project.performance.arpPitchSemis) {
      onUpdatePerformance?.((prev) => ({
        ...prev,
        arpPitchSemis: 0,
      }));
    }
  };

  // Hold / Freeze continuous preview loop for Synth Play and FX Warp (when stopped)
  useEffect(() => {
    if (!holdFreeze || !hasFrozenGesture) return;
    if (kaossMode === 'arp') return; // Arp mode already runs on GrooveboxRoot's synced clock
    if (kaossMode === 'fx' && isPlaying) return; // Live sequencer audio is already playing through the frozen FX

    const stepMs =
      kaossMode === 'synth'
        ? Math.max(45, (60 / Math.max(40, project.bpm) / 4) * 1000)
        : Math.max(120, (60 / Math.max(40, project.bpm)) * 1000);

    const timer = window.setInterval(() => {
      if (isPointerDownRef.current) return;
      const activeXDest = isPro ? xDest : 'cutoff';
      const activeYDest = isPro ? yDest : 'resonance';
      engine.setKaossWarp(
        coords.x,
        coords.y,
        selectedTargets,
        routeMaster,
        activeXDest,
        activeYDest
      );

      if (kaossMode === 'synth') {
        const scalePool = getScaleNotes(
          project.rootNote,
          project.scaleName,
          focusedTrackIndex === 4 ? 2 : 3,
          16
        );
        const noteIdx = Math.min(
          scalePool.length - 1,
          Math.floor(coords.x * scalePool.length)
        );
        const targetTrk = selectedTargets[0] ?? focusedTrackIndex;
        onTriggerKaossNote(
          targetTrk,
          scalePool[noteIdx],
          0.55 + coords.y * 0.45
        );
      } else if (kaossMode === 'fx' && !isPlaying) {
        const targetsToPreview =
          selectedTargets.length > 0 ? selectedTargets : [focusedTrackIndex];
        for (const trkIdx of targetsToPreview) {
          const trk = project.tracks[trkIdx];
          const previewMidi = trk?.isDrum
            ? 36
            : (trkIdx === 4 ? 36 : 60) + project.rootNote;
          onTriggerKaossNote(trkIdx, previewMidi, 0.85);
        }
      }
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [
    holdFreeze,
    hasFrozenGesture,
    kaossMode,
    isPlaying,
    project.bpm,
    project.rootNote,
    project.scaleName,
    project.tracks,
    coords.x,
    coords.y,
    selectedTargets,
    routeMaster,
    isPro,
    xDest,
    yDest,
    focusedTrackIndex,
    engine,
    onTriggerKaossNote,
  ]);

  const applyKaossGesture = (
    normX: number,
    normY: number,
    isInitialPress: boolean = false
  ) => {
    setCoords({ x: normX, y: normY });
    trailRef.current.push({ x: normX, y: normY, alpha: 1.0 });
    if (trailRef.current.length > 32) {
      trailRef.current.shift();
    }

    const activeXDest = isPro ? xDest : 'cutoff';
    const activeYDest = isPro ? yDest : 'resonance';
    engine.setKaossWarp(
      normX,
      normY,
      selectedTargets,
      routeMaster,
      activeXDest,
      activeYDest
    );

    // Handle configurable Studio X/Y Arp Speed or Arp Pitch destinations
    if (
      isPro &&
      kaossMode === 'fx' &&
      (activeXDest === 'arpRate' ||
        activeYDest === 'arpRate' ||
        activeXDest === 'arpPitch' ||
        activeYDest === 'arpPitch')
    ) {
      onUpdatePerformance?.((prev) => {
        let nextRate = prev.arpRate ?? '1/16';
        let nextPitch = prev.arpPitchSemis ?? 0;
        if (activeXDest === 'arpRate') {
          const rIdx = Math.min(
            ARP_SYNC_RATES.length - 1,
            Math.floor(normX * ARP_SYNC_RATES.length)
          );
          nextRate = ARP_SYNC_RATES[rIdx];
        } else if (activeXDest === 'arpPitch') {
          nextPitch = Math.round((normX - 0.5) * 36);
        }
        if (activeYDest === 'arpRate') {
          const rIdx = Math.min(
            ARP_SYNC_RATES.length - 1,
            Math.floor(normY * ARP_SYNC_RATES.length)
          );
          nextRate = ARP_SYNC_RATES[rIdx];
        } else if (activeYDest === 'arpPitch') {
          nextPitch = Math.round((normY - 0.5) * 36);
        }
        if (
          nextRate === prev.arpRate &&
          nextPitch === prev.arpPitchSemis
        ) {
          return prev;
        }
        return {
          ...prev,
          arpRate: nextRate,
          arpPitchSemis: nextPitch,
        };
      });
    }

    // In FX Warp mode when sequencer is stopped, audition/preview the selected instrument(s) so you hear the FX warp
    if (kaossMode === 'fx' && !isPlaying) {
      const now = performance.now();
      const quarterMs = (60 / Math.max(40, project.bpm)) * 1000;
      if (isInitialPress || now - lastFxPreviewRef.current >= quarterMs) {
        lastFxPreviewRef.current = now;
        const targetsToPreview =
          selectedTargets.length > 0 ? selectedTargets : [focusedTrackIndex];
        for (const trkIdx of targetsToPreview) {
          const trk = project.tracks[trkIdx];
          const previewMidi = trk?.isDrum
            ? 36
            : (trkIdx === 4 ? 36 : 60) + project.rootNote;
          onTriggerKaossNote(trkIdx, previewMidi, 0.85);
        }
      }
      return;
    }

    if (kaossMode === 'arp') {
      const rateIdx = Math.min(
        ARP_SYNC_RATES.length - 1,
        Math.floor(normX * ARP_SYNC_RATES.length)
      );
      const syncedRate = ARP_SYNC_RATES[rateIdx];
      const scalePool = getScaleNotes(
        project.rootNote,
        project.scaleName,
        focusedTrackIndex === 4 ? 2 : 3,
        22
      );
      const degIdx = Math.min(
        scalePool.length - 5,
        Math.max(0, Math.floor(normY * (scalePool.length - 4)))
      );
      const baseRoot = scalePool[degIdx] ?? 60;
      const third = scalePool[degIdx + 2] ?? baseRoot + 4;
      const fifth = scalePool[degIdx + 4] ?? baseRoot + 7;

      const pitchSemis = Math.round((normY - 0.35) * 24);
      if (arpLatchedMidis.length === 0 || kaossSpawnedArpRef.current) {
        kaossSpawnedArpRef.current = true;
        const nextTriad = [baseRoot, third, fifth];
        const prevTriad = lastArpTriadRef.current;
        if (
          prevTriad.length !== nextTriad.length ||
          prevTriad.some((n, i) => n !== nextTriad[i])
        ) {
          lastArpTriadRef.current = nextTriad;
          onSetArpLatchedMidis?.(nextTriad);
        }
      }
      const nextPitchSemis = kaossSpawnedArpRef.current ? 0 : pitchSemis;
      if (
        !project.performance.arpEnabled ||
        project.performance.arpRate !== syncedRate ||
        project.performance.arpPitchSemis !== nextPitchSemis
      ) {
        onUpdatePerformance?.((prev) => ({
          ...prev,
          arpEnabled: true,
          arpRate: syncedRate,
          arpPitchSemis: nextPitchSemis,
        }));
      }
      return;
    }

    if (kaossMode === 'synth') {
      const now = performance.now();
      const gateMs = (60 / Math.max(40, project.bpm) / 4) * 1000;
      if (isInitialPress || now - lastSynthTrigRef.current >= gateMs * 0.85) {
        lastSynthTrigRef.current = now;
        const scalePool = getScaleNotes(
          project.rootNote,
          project.scaleName,
          focusedTrackIndex === 4 ? 2 : 3,
          16
        );
        const noteIdx = Math.min(
          scalePool.length - 1,
          Math.floor(normX * scalePool.length)
        );
        const targetTrk = selectedTargets[0] ?? focusedTrackIndex;
        onTriggerKaossNote(
          targetTrk,
          scalePool[noteIdx],
          0.55 + normY * 0.45
        );
      }
    }
  };

  const handlePointerEvent = (
    e: React.PointerEvent<HTMLCanvasElement>,
    isInitialPress: boolean = false
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y =
      1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    applyKaossGesture(x, y, isInitialPress);
  };

  const toggleTarget = (trkIdx: number) => {
    if (kaossMode === 'synth' || kaossMode === 'arp') {
      // Single-instrument selection in Synth / Arp modes so the clicked track plays immediately
      setCustomFxTargets(null);
      onSelectTrack?.(trkIdx);
      return;
    }
    const base = customFxTargets ?? [focusedTrackIndex];
    const exists = base.includes(trkIdx);
    const next = exists ? base.filter((i) => i !== trkIdx) : [...base, trkIdx];
    setCustomFxTargets(next);
    if (!exists) {
      onSelectTrack?.(trkIdx);
    }
  };

  const xLabel =
    KAOSS_DEST_OPTIONS.find((o) => o.id === (isPro ? xDest : 'cutoff'))?.label.toUpperCase() ??
    'CUTOFF FREQ';
  const yLabel =
    KAOSS_DEST_OPTIONS.find((o) => o.id === (isPro ? yDest : 'resonance'))?.label.toUpperCase() ??
    'RESONANCE';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full">
      {/* Left: 9-Target Routing Bar + Studio X/Y Destination Selectors + Dual Kaoss Modes + Stutter Ribbons */}
      <div className="studio-module-fx lg:col-span-5 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between gap-1.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-studio-mono text-[10px] font-bold uppercase text-rose-400">
              9-TARGET KAOSS ROUTING BAR
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !holdFreeze;
                setHoldFreeze(next);
                if (!next) {
                  releaseKaossHold();
                }
              }}
              className={`px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold border cursor-pointer ${
                holdFreeze
                  ? 'bg-amber-400 text-black border-amber-300'
                  : 'bg-white/5 text-gray-300 border-white/10'
              }`}
            >
              ❄️ HOLD / FREEZE
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {project.tracks.map((trk) => {
              const active = selectedTargets.includes(trk.index);
              return (
                <button
                  key={trk.index}
                  type="button"
                  onClick={() => toggleTarget(trk.index)}
                  style={{
                    borderColor: active ? trk.color : 'rgba(255,255,255,0.08)',
                    backgroundColor: active
                      ? `${trk.color}28`
                      : 'rgba(0,0,0,0.35)',
                  }}
                  className="py-1 px-1.5 rounded border font-studio-mono text-[10px] font-bold text-left truncate cursor-pointer"
                >
                  {trk.index + 1}:{trk.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setRouteMaster((v) => !v)}
              className={`py-1 px-1.5 rounded border font-studio-mono text-[10px] font-bold cursor-pointer ${
                routeMaster
                  ? 'bg-rose-500 text-black border-rose-400'
                  : 'bg-black/35 text-gray-400 border-white/10'
              }`}
            >
              ★ MASTER
            </button>
          </div>
        </div>

        {/* Studio Mode Configurable X & Y Axis Destination Dropdowns */}
        {isPro && (
          <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-1.5 rounded-lg border border-white/10 font-studio-mono text-[9.5px]">
            <label className="flex flex-col gap-0.5">
              <span className="text-sky-300 font-bold">X-AXIS PARAMETER:</span>
              <select
                aria-label="Kaoss X-Axis Destination"
                value={xDest}
                onChange={(e) => {
                  const nextX = e.target.value as KaossAxisDest;
                  onUpdatePerformance?.((prev) => ({
                    ...prev,
                    kaossXDest: nextX,
                  }));
                }}
                className="h-6 rounded bg-black/70 border border-white/15 px-1.5 text-white cursor-pointer"
              >
                {KAOSS_DEST_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                    {opt.id === 'cutoff' ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-rose-300 font-bold">Y-AXIS PARAMETER:</span>
              <select
                aria-label="Kaoss Y-Axis Destination"
                value={yDest}
                onChange={(e) => {
                  const nextY = e.target.value as KaossAxisDest;
                  onUpdatePerformance?.((prev) => ({
                    ...prev,
                    kaossYDest: nextY,
                  }));
                }}
                className="h-6 rounded bg-black/70 border border-white/15 px-1.5 text-white cursor-pointer"
              >
                {KAOSS_DEST_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                    {opt.id === 'resonance' ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Tri-Mode Kaoss Switcher: FX Warp, Synth Play & Arp Speed × Pitch */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setKaossMode('fx')}
            className={`flex-1 py-1 rounded font-studio-mono text-[9.5px] font-bold cursor-pointer ${
              kaossMode === 'fx'
                ? 'bg-rose-500 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🌀 FX WARP
          </button>
          <button
            type="button"
            onClick={() => setKaossMode('synth')}
            className={`flex-1 py-1 rounded font-studio-mono text-[9.5px] font-bold cursor-pointer ${
              kaossMode === 'synth'
                ? 'bg-sky-400 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ⚡ SYNTH PLAY
          </button>
          <button
            type="button"
            onClick={() => setKaossMode('arp')}
            title="Control BPM-Synced Arp Speed on X-Axis and Scale Pitch / Octave on Y-Axis"
            className={`flex-1 py-1 rounded font-studio-mono text-[9.5px] font-bold cursor-pointer ${
              kaossMode === 'arp'
                ? 'bg-purple-400 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🎹 ARP (SPEED×PITCH)
          </button>
        </div>

        {/* Momentary Stutter Ribbons (`1/8`, `1/16`, `1/32`) */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['1/8', '1/16', '1/32'] as const).map((rate) => (
            <button
              key={rate}
              type="button"
              onPointerDown={() => {
                engine.setPunchInFx('beat-repeat', rate);
                onUpdatePerformance?.((prev) => ({
                  ...prev,
                  activePunchInFx: 'beat-repeat',
                }));
              }}
              onPointerUp={() => {
                engine.setPunchInFx('none');
                onUpdatePerformance?.((prev) => ({
                  ...prev,
                  activePunchInFx: 'none',
                }));
              }}
              onPointerLeave={() => {
                if (project.performance.activePunchInFx === 'beat-repeat') {
                  engine.setPunchInFx('none');
                  onUpdatePerformance?.((prev) => ({
                    ...prev,
                    activePunchInFx: 'none',
                  }));
                }
              }}
              className="py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 active:bg-amber-400 active:text-black border border-amber-500/35 font-studio-mono text-[10px] font-bold text-amber-300 cursor-pointer touch-none-control"
            >
              STUTTER {rate}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Interactive X/Y Kaoss Performance Surface */}
      <div className="lg:col-span-7 rounded-xl border border-white/15 bg-[#090B10] relative overflow-hidden flex flex-col">
        <canvas
          ref={canvasRef}
          width={520}
          height={200}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            isPointerDownRef.current = true;
            setHasFrozenGesture(true);
            handlePointerEvent(e, true);
          }}
          onPointerMove={(e) => {
            if (!isPointerDownRef.current) return;
            handlePointerEvent(e);
          }}
          onPointerUp={(e) => {
            isPointerDownRef.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // Ignore
            }
            if (!holdFreeze) {
              releaseKaossHold();
            }
          }}
          className="w-full h-full cursor-crosshair touch-none-control"
        />

        <div className="pointer-events-none absolute top-2 left-3 right-3 flex items-center justify-between font-studio-mono text-[10px] text-gray-300">
          <span>
            {kaossMode === 'fx'
              ? `X: ${xLabel} × Y: ${yLabel}`
              : kaossMode === 'arp'
                ? `X: ARP SYNC SPEED [${project.performance.arpRate ?? '1/16'}] × Y: ARP PITCH (${arpLatchedMidis[0] ? midiToNoteName(arpLatchedMidis[0] + (project.performance.arpPitchSemis ?? 0)) : '3-OCT SCALE'})`
                : 'X: SCALE NOTE PITCH × Y: TIMBRE BRIGHTNESS'}
          </span>
          <span className="text-white font-bold">
            X:{Math.round(coords.x * 100)}% • Y:{Math.round(coords.y * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
