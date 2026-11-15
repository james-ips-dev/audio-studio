import React, { useEffect, useState } from 'react';
import { RotaryKnob } from '../../../../shared-ui/RotaryKnob';
import type { GrooveboxAudioEngine } from '../../audio/GrooveboxAudioEngine';
import type { GrooveboxProject, InsertFxType, TrackConfig } from '../../types';

export interface MixerFxTabProps {
  project: GrooveboxProject;
  focusedTrackIndex: number;
  engine: GrooveboxAudioEngine;
  onSelectTrack: (trackIndex: number) => void;
  onUpdateTrackMixer: (
    trackIndex: number,
    updater: (prev: TrackConfig['mixer']) => TrackConfig['mixer']
  ) => void;
  onToggleInsertFx: (trackIndex: number, fxType: InsertFxType) => void;
  onUpdateGlobalFx: (
    updater: (prev: GrooveboxProject['globalFx']) => GrooveboxProject['globalFx']
  ) => void;
}

const INSERT_FX_LABELS: { type: InsertFxType; label: string }[] = [
  { type: 'drive', label: '1. ANALOG DRIVE / WAVEFOLDER' },
  { type: 'transientShaper', label: '2. TRANSIENT SHAPER' },
  { type: 'bitcrusher', label: '3. LO-FI BITCRUSHER' },
  { type: 'chorusTape', label: '4. CHORUS & TAPE WOW/FLUTTER' },
  { type: 'eq4', label: '5. 4-BAND PARAMETRIC EQ' },
  { type: 'sidechainComp', label: '6. KICK SIDECHAIN DUCKER' },
];

export const MixerFxTab: React.FC<MixerFxTabProps> = ({
  project,
  focusedTrackIndex,
  engine,
  onSelectTrack,
  onUpdateTrackMixer,
  onToggleInsertFx,
  onUpdateGlobalFx,
}) => {
  const [vuLevels, setVuLevels] = useState<number[]>(Array(8).fill(0));

  useEffect(() => {
    const buf = new Float32Array(8);
    const interval = window.setInterval(
      () => {
        engine.getTrackLevels(buf);
        setVuLevels(Array.from(buf));
      },
      project.ecoMode ? 80 : 45
    );
    return () => window.clearInterval(interval);
  }, [engine, project.ecoMode]);

  const focusedTrack = project.tracks[focusedTrackIndex];
  const isPro = project.mode === 'pro';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-y-auto">
      {/* Left: 8 Multi-Touch Channel Strips */}
      <div className="lg:col-span-8 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="grid grid-cols-8 gap-1.5 h-full">
          {project.tracks.map((trk, idx) => {
            const isSelected = focusedTrackIndex === idx;
            const vu = vuLevels[idx] || 0;

            return (
              <div
                key={trk.index}
                onClick={() => onSelectTrack(idx)}
                className={`rounded-lg p-1.5 flex flex-col items-center justify-between border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#1C2130] border-white/25'
                    : 'bg-black/35 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="w-full text-center">
                  <div
                    className="font-studio-mono text-[10px] font-bold truncate"
                    style={{ color: trk.color }}
                  >
                    {idx + 1}.{trk.name}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrackMixer(idx, (m) => ({
                          ...m,
                          mute: !m.mute,
                        }));
                      }}
                      className={`w-5 h-4 rounded text-[9px] font-studio-mono font-bold cursor-pointer ${
                        trk.mixer.mute
                          ? 'bg-rose-500 text-black'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrackMixer(idx, (m) => ({
                          ...m,
                          solo: !m.solo,
                        }));
                      }}
                      className={`w-5 h-4 rounded text-[9px] font-studio-mono font-bold cursor-pointer ${
                        trk.mixer.solo
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>

                {/* Pan & Reverb/Delay Sends */}
                <div className="w-full space-y-1 my-1 font-studio-mono text-[8px] text-gray-400">
                  <div className="flex justify-between">
                    <span>PAN</span>
                    <span className="text-white">
                      {trk.mixer.pan === 0
                        ? 'C'
                        : trk.mixer.pan < 0
                          ? `L${Math.round(Math.abs(trk.mixer.pan) * 100)}`
                          : `R${Math.round(trk.mixer.pan * 100)}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={trk.mixer.pan}
                    onDoubleClick={() =>
                      onUpdateTrackMixer(idx, (m) => ({ ...m, pan: 0 }))
                    }
                    onChange={(e) =>
                      onUpdateTrackMixer(idx, (m) => ({
                        ...m,
                        pan: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />

                  <div className="flex justify-between">
                    <span>REV</span>
                    <span>{Math.round(trk.mixer.reverbSend * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={trk.mixer.reverbSend}
                    onChange={(e) =>
                      onUpdateTrackMixer(idx, (m) => ({
                        ...m,
                        reverbSend: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>

                {/* Vertical Volume Bar & Live LED VU Meter */}
                <div className="w-full flex items-center gap-1.5 pt-1 border-t border-white/5">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={trk.mixer.volume}
                    onChange={(e) =>
                      onUpdateTrackMixer(idx, (m) => ({
                        ...m,
                        volume: Number(e.target.value),
                      }))
                    }
                    style={{ accentColor: trk.color }}
                    className="w-full cursor-pointer"
                  />
                  <div className="w-2 h-5 bg-black/60 rounded overflow-hidden flex flex-col justify-end border border-white/10 shrink-0">
                    <div
                      style={{
                        height: `${Math.min(100, Math.round(vu * 100))}%`,
                        backgroundColor: vu > 0.85 ? '#F43F5E' : trk.color,
                      }}
                      className="w-full transition-all duration-75"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Per-Channel 6-Unit Insert FX Rack & 3-Stage Master Bus Strip */}
      <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1.5">
            <span
              className="font-studio-mono text-[10px] font-bold uppercase"
              style={{ color: focusedTrack.color }}
            >
              {isPro
                ? `${focusedTrack.name} // 6-UNIT INSERT FX RACK`
                : 'GLOBAL SPACE & MASTER BUS'}
            </span>
            <span className="font-studio-mono text-[9px] text-emerald-400">
              -0.3 dBFS LIMITER
            </span>
          </div>

          {isPro && (
            <div className="grid grid-cols-2 gap-1 mb-2">
              {INSERT_FX_LABELS.map((item) => {
                const unit = focusedTrack.insertFx.find(
                  (u) => u.type === item.type
                );
                const enabled = Boolean(unit?.enabled);
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() =>
                      onToggleInsertFx(focusedTrackIndex, item.type)
                    }
                    className={`px-2 py-1 rounded text-left font-studio-mono text-[9px] font-bold border transition-all cursor-pointer truncate ${
                      enabled
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                        : 'bg-black/35 border-white/5 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {enabled ? '● ' : '○ '}
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3-Stage Master Bus Mastering Strip Knobs */}
        <div className="grid grid-cols-4 gap-2 place-items-center bg-black/30 rounded-lg p-2 border border-white/5">
          <RotaryKnob
            label="SPACE REV"
            size="sm"
            value={project.globalFx.reverbReturn}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.28}
            accentColor="#A855F7"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(reverbReturn) =>
              onUpdateGlobalFx((prev) => ({ ...prev, reverbReturn }))
            }
          />
          <RotaryKnob
            label="DUB DELAY"
            size="sm"
            value={project.globalFx.delayReturn}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.24}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(delayReturn) =>
              onUpdateGlobalFx((prev) => ({ ...prev, delayReturn }))
            }
          />
          <RotaryKnob
            label="GLUE COMP"
            size="sm"
            value={project.globalFx.masterCompressorRatio}
            min={1}
            max={12}
            step={0.2}
            defaultValue={3.2}
            accentColor="#F59E0B"
            formatValue={(v) => `${v.toFixed(1)}:1`}
            onChange={(masterCompressorRatio) =>
              onUpdateGlobalFx((prev) => ({ ...prev, masterCompressorRatio }))
            }
          />
          <RotaryKnob
            label="TILT EQ"
            size="sm"
            value={project.globalFx.masterTiltEq}
            min={-1}
            max={1}
            step={0.05}
            defaultValue={0.1}
            bipolar
            accentColor="#34D399"
            formatValue={(v) =>
              `${v >= 0 ? '+' : ''}${Math.round(v * 6)}dB`
            }
            onChange={(masterTiltEq) =>
              onUpdateGlobalFx((prev) => ({ ...prev, masterTiltEq }))
            }
          />
        </div>
      </div>
    </div>
  );
};
