import React from 'react';
import type { GrooveboxAudioEngine } from '../../audio/GrooveboxAudioEngine';
import { PATTERN_BANK_IDS } from '../../presets/factoryPresets';
import type {
  CrossfadeCurveMode,
  GrooveboxProject,
  LaunchQuantize,
  PunchInFxType,
} from '../../types';

export interface PerformanceTabProps {
  project: GrooveboxProject;
  engine: GrooveboxAudioEngine;
  onLaunchTrackClip: (trackIndex: number, patternId: string) => void;
  onLaunchMasterScene: (patternId: string) => void;
  onUpdatePerformance: (
    updater: (
      prev: GrooveboxProject['performance']
    ) => GrooveboxProject['performance']
  ) => void;
  onCaptureCombinationToSong: () => void;
}

const PUNCH_IN_FX_PADS: { id: PunchInFxType; label: string; color: string }[] = [
  { id: 'tape-stop', label: '🛑 TAPE STOP', color: '#F43F5E' },
  { id: 'beat-repeat', label: '🔁 BEAT REPEAT', color: '#F59E0B' },
  { id: 'dub-wash', label: '🌊 DUB WASH OUT', color: '#38BDF8' },
  { id: 'sub-drop', label: '💣 808 SUB DROP', color: '#A855F7' },
  { id: 'hpf-riser', label: '🚀 HPF RISER', color: '#34D399' },
];

export const PerformanceTab: React.FC<PerformanceTabProps> = ({
  project,
  engine,
  onLaunchTrackClip,
  onLaunchMasterScene,
  onUpdatePerformance,
  onCaptureCombinationToSong,
}) => {
  const isPro = project.mode === 'pro';
  const perf = project.performance;
  const visibleRows = isPro
    ? PATTERN_BANK_IDS.slice(0, 8) // A1..B4
    : PATTERN_BANK_IDS.slice(0, 4); // A1..A4 in Beginner Remix Mode

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-y-auto">
      {/* Left/Center: Per-Track Clip Launch Matrix + Master Scene Launch Column */}
      <div className="lg:col-span-8 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-studio-mono text-[10px] font-bold uppercase text-rose-400">
            {isPro
              ? '8×8 PER-TRACK LIVE CLIP LAUNCH MATRIX'
              : 'LIVE REMIX BOARD (1-BAR QUANTIZED)'}
          </span>

          <div className="flex items-center gap-2 font-studio-mono text-[10px]">
            <label className="flex items-center gap-1">
              <span className="text-gray-400">QUANT:</span>
              <select
                value={perf.launchQuantize}
                onChange={(e) => {
                  const launchQuantize = e.target.value as LaunchQuantize;
                  onUpdatePerformance((prev) => ({ ...prev, launchQuantize }));
                }}
                className="bg-black/60 text-white rounded border border-white/15 px-1.5 py-0.5 cursor-pointer"
              >
                <option value="immediate" className="bg-[#12151E]">IMMEDIATE</option>
                <option value="1/16" className="bg-[#12151E]">1/16 STEP</option>
                <option value="1-beat" className="bg-[#12151E]">1 BEAT</option>
                <option value="1-bar" className="bg-[#12151E]">1 BAR</option>
                <option value="2-bars" className="bg-[#12151E]">2 BARS</option>
              </select>
            </label>

            {isPro && (
              <button
                type="button"
                onClick={() =>
                  onUpdatePerformance((prev) => ({
                    ...prev,
                    legatoPhaseLock: !prev.legatoPhaseLock,
                  }))
                }
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  perf.legatoPhaseLock
                    ? 'bg-emerald-400 text-black'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                LEGATO LOCK
              </button>
            )}
          </div>
        </div>

        {/* Clip Launch Grid: 8 Track Columns + 1 Master Scene Column */}
        <div className="flex-1 flex flex-col justify-between gap-1 overflow-y-auto">
          {visibleRows.map((patId) => (
            <div key={patId} className="grid grid-cols-9 gap-1 items-center">
              {project.tracks.map((trk) => {
                const isActive = perf.activeTrackPatterns[trk.index] === patId;
                const isQueued = perf.queuedTrackPatterns[trk.index] === patId;

                return (
                  <button
                    key={trk.index}
                    type="button"
                    onClick={() => onLaunchTrackClip(trk.index, patId)}
                    style={{
                      backgroundColor: isActive
                        ? trk.color
                        : isQueued
                          ? `${trk.color}55`
                          : 'rgba(255,255,255,0.05)',
                      borderColor: isActive
                        ? '#FFFFFF'
                        : `${trk.color}44`,
                    }}
                    className={`py-1 px-1 rounded border font-studio-mono text-[9px] font-bold truncate transition-all cursor-pointer ${
                      isActive
                        ? 'text-black shadow'
                        : isQueued
                          ? 'text-white animate-pulse'
                          : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {trk.name.slice(0, 4)} • {patId}
                  </button>
                );
              })}

              {/* Master Scene Launch Button */}
              <button
                type="button"
                onClick={() => onLaunchMasterScene(patId)}
                className="py-1 px-1.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-black border border-rose-500/40 font-studio-mono text-[9px] font-bold cursor-pointer transition-colors"
              >
                ▶ SCENE {patId}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Dual-Deck A/B Pattern Crossfader, Punch-In FX & Capture */}
      <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between space-y-2">
        {/* Dual-Deck A/B Pattern Crossfader */}
        <div className="bg-black/35 p-2 rounded-lg border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between font-studio-mono text-[10px]">
            <span className="text-sky-300 font-bold">
              DUAL-DECK A/B CROSSFADER
            </span>
            <select
              aria-label="Crossfade Curve Mode"
              value={perf.crossfadeMode}
              onChange={(e) => {
                const crossfadeMode = e.target.value as CrossfadeCurveMode;
                onUpdatePerformance((prev) => ({ ...prev, crossfadeMode }));
              }}
              className="bg-black/60 text-amber-300 rounded border border-white/15 px-1.5 py-0.5 text-[9px] cursor-pointer"
            >
              <option value="dj-eq-blend" className="bg-[#12151E]">
                DJ EQ / BASS SWAP
              </option>
              <option value="filter-morph" className="bg-[#12151E]">
                FILTER MORPH
              </option>
              <option value="step-probability-morph" className="bg-[#12151E]">
                STEP PROB MORPH
              </option>
            </select>
          </div>

          <div className="flex items-center gap-2 font-studio-mono text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
              DECK A (A1)
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={perf.crossfaderPosition}
              onDoubleClick={() =>
                onUpdatePerformance((prev) => ({
                  ...prev,
                  crossfaderPosition: 0,
                }))
              }
              onChange={(e) => {
                const crossfaderPosition = Number(e.target.value);
                onUpdatePerformance((prev) => ({
                  ...prev,
                  crossfaderPosition,
                }));
              }}
              className="flex-1 accent-rose-500 cursor-pointer"
            />
            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
              DECK B (A2)
            </span>
          </div>
        </div>

        {/* 5 Momentary Punch-In FX Pads */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 flex-1">
          {PUNCH_IN_FX_PADS.map((pad) => {
            const active = perf.activePunchInFx === pad.id;
            return (
              <button
                key={pad.id}
                type="button"
                onPointerDown={() => {
                  engine.setPunchInFx(pad.id);
                  onUpdatePerformance((prev) => ({
                    ...prev,
                    activePunchInFx: pad.id,
                  }));
                }}
                onPointerUp={() => {
                  engine.setPunchInFx('none');
                  onUpdatePerformance((prev) => ({
                    ...prev,
                    activePunchInFx: 'none',
                  }));
                }}
                onPointerLeave={() => {
                  if (active) {
                    engine.setPunchInFx('none');
                    onUpdatePerformance((prev) => ({
                      ...prev,
                      activePunchInFx: 'none',
                    }));
                  }
                }}
                style={{
                  borderColor: active ? pad.color : `${pad.color}55`,
                  backgroundColor: active ? pad.color : `${pad.color}18`,
                }}
                className={`rounded-lg border p-2 font-studio-mono text-[10px] font-bold transition-all cursor-pointer touch-none-control ${
                  active ? 'text-black scale-95 shadow-lg' : 'text-white'
                }`}
              >
                {pad.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onCaptureCombinationToSong}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/30 p-2 font-studio-mono text-[10px] font-bold text-emerald-200 cursor-pointer"
          >
            📸 CAPTURE TO SONG
          </button>
        </div>
      </div>
    </div>
  );
};
