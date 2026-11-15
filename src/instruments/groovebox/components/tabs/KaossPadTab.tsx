import React, { useEffect, useRef, useState } from 'react';
import type { GrooveboxAudioEngine } from '../../audio/GrooveboxAudioEngine';
import { getScaleNotes } from '../../presets/factoryPresets';
import type { GrooveboxProject } from '../../types';

export interface KaossPadTabProps {
  project: GrooveboxProject;
  focusedTrackIndex: number;
  engine: GrooveboxAudioEngine;
  onTriggerKaossNote: (
    trackIndex: number,
    midiNote: number,
    velocity: number
  ) => void;
}

type KaossMode = 'synth' | 'fx';

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

export const KaossPadTab: React.FC<KaossPadTabProps> = ({
  project,
  focusedTrackIndex,
  engine,
  onTriggerKaossNote,
}) => {
  const [kaossMode, setKaossMode] = useState<KaossMode>('fx');
  const [selectedTargets, setSelectedTargets] = useState<number[]>([
    focusedTrackIndex,
  ]);
  const [routeMaster, setRouteMaster] = useState<boolean>(true);
  const [holdFreeze, setHoldFreeze] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });

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

  const applyKaossGesture = (normX: number, normY: number) => {
    setCoords({ x: normX, y: normY });
    trailRef.current.push({ x: normX, y: normY, alpha: 1.0 });
    if (trailRef.current.length > 32) {
      trailRef.current.shift();
    }

    engine.setKaossWarp(normX, normY, selectedTargets, routeMaster);

    if (kaossMode === 'synth') {
      const now = performance.now();
      const gateMs = (60 / Math.max(40, project.bpm) / 4) * 1000;
      if (now - lastSynthTrigRef.current >= gateMs * 0.85) {
        lastSynthTrigRef.current = now;
        const scalePool = getScaleNotes(
          project.rootNote,
          project.scaleName,
          3,
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

  const handlePointerEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y =
      1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    applyKaossGesture(x, y);
  };

  const toggleTarget = (trkIdx: number) => {
    setSelectedTargets((prev) =>
      prev.includes(trkIdx)
        ? prev.filter((i) => i !== trkIdx)
        : [...prev, trkIdx]
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full">
      {/* Left: 9-Target Routing Bar + Dual Kaoss Modes + Stutter Ribbons */}
      <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-studio-mono text-[10px] font-bold uppercase text-rose-400">
              9-TARGET KAOSS ROUTING BAR
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !holdFreeze;
                setHoldFreeze(next);
                if (!next) {
                  engine.setKaossWarp(null, null, [], false);
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

        {/* Dual Kaoss Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setKaossMode('fx')}
            className={`flex-1 py-1.5 rounded font-studio-mono text-[10px] font-bold cursor-pointer ${
              kaossMode === 'fx'
                ? 'bg-rose-500 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🌀 FX WARP (KAOSS PAD)
          </button>
          <button
            type="button"
            onClick={() => setKaossMode('synth')}
            className={`flex-1 py-1.5 rounded font-studio-mono text-[10px] font-bold cursor-pointer ${
              kaossMode === 'synth'
                ? 'bg-sky-400 text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ⚡ SYNTH PLAY (KAOSSILATOR)
          </button>
        </div>

        {/* Momentary Stutter Ribbons (`1/8`, `1/16`, `1/32`) */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['1/8', '1/16', '1/32'] as const).map((rate) => (
            <button
              key={rate}
              type="button"
              onPointerDown={() => engine.setPunchInFx('beat-repeat')}
              onPointerUp={() => engine.setPunchInFx('none')}
              onPointerLeave={() => engine.setPunchInFx('none')}
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
            handlePointerEvent(e);
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
              engine.setKaossWarp(null, null, [], false);
            }
          }}
          className="w-full h-full cursor-crosshair touch-none-control"
        />

        <div className="pointer-events-none absolute top-2 left-3 right-3 flex items-center justify-between font-studio-mono text-[10px] text-gray-400">
          <span>
            {kaossMode === 'fx'
              ? 'X: CUTOFF FREQ × Y: RESONANCE / DUB FEEDBACK'
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
