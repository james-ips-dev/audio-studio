import React, { useState } from 'react';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import { DIRECT_OUTPUT_CHANNELS } from '../presets/factoryPatches';
import type {
  Aether8PatchV4,
  AetherModDest,
  AetherModSource,
  DirectOutputChannelKey,
  ModMatrixSlot,
  OutputChannelFxConfig,
} from '../types';

export interface OutputConsoleDrawerProps {
  patch: Aether8PatchV4;
  mixerOpen: boolean;
  modMatrixOpen: boolean;
  onUpdateOutputChannel: (
    channelKey: DirectOutputChannelKey,
    updater: (prev: OutputChannelFxConfig) => OutputChannelFxConfig
  ) => void;
  onUpdateModMatrixSlot: (
    slotIdx: number,
    updater: (prev: ModMatrixSlot) => ModMatrixSlot
  ) => void;
  onCloseDrawers: () => void;
}

const MOD_SOURCES: AetherModSource[] = ['lfo1', 'lfo2', 'chaos', 'sh'];
const MOD_DESTS: AetherModDest[] = [
  'filter.cutoff',
  'drone.detune',
  'drone.morph',
  'noise.formant',
  'delay.time',
  'pulse.decay',
];

export const OutputConsoleDrawer: React.FC<OutputConsoleDrawerProps> = ({
  patch,
  mixerOpen,
  modMatrixOpen,
  onUpdateOutputChannel,
  onUpdateModMatrixSlot,
  onCloseDrawers,
}) => {
  const [selectedCh, setSelectedCh] = useState<DirectOutputChannelKey>('drone');

  if (!mixerOpen && !modMatrixOpen) return null;

  const chCfg = patch.outputMixer[selectedCh];
  const chMeta =
    DIRECT_OUTPUT_CHANNELS.find((c) => c.key === selectedCh) ??
    DIRECT_OUTPUT_CHANNELS[0];

  return (
    <section className="shrink-0 border-t border-sky-500/30 bg-[#0D121B] px-3 py-2.5 z-30 shadow-2xl space-y-2">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="font-studio-mono text-[11px] font-bold text-sky-300 uppercase">
          {mixerOpen
            ? '🎚️ 10-CHANNEL DIRECT OUTPUT CONSOLE & PER-OUTPUT 4-STAGE GRANULAR FX RACK'
            : '🎛️ 6-SLOT MODULATION MATRIX'}
        </span>
        <button
          type="button"
          onClick={onCloseDrawers}
          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 font-studio-mono text-[10px] text-gray-200 cursor-pointer"
        >
          ✕ CLOSE DRAWER
        </button>
      </div>

      {mixerOpen && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          {/* Left: 10 Direct Output Channel Strips */}
          <div className="xl:col-span-7 grid grid-cols-5 sm:grid-cols-10 gap-1">
            {DIRECT_OUTPUT_CHANNELS.map((c) => {
              const cfg = patch.outputMixer[c.key];
              const isSelected = selectedCh === c.key;

              return (
                <div
                  key={c.key}
                  onClick={() => setSelectedCh(c.key)}
                  className={`rounded-lg p-1.5 flex flex-col items-center justify-between border cursor-pointer ${
                    isSelected
                      ? 'bg-[#172030] border-sky-400/60'
                      : 'bg-black/40 border-white/5 hover:border-white/15'
                  }`}
                >
                  <span
                    style={{ color: c.color }}
                    className="font-studio-mono text-[8px] font-bold truncate w-full text-center"
                  >
                    {c.code}.{c.label}
                  </span>

                  <div className="flex items-center gap-0.5 my-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateOutputChannel(c.key, (prev) => ({
                          ...prev,
                          mute: !prev.mute,
                        }));
                      }}
                      className={`px-1 py-0.2 rounded font-studio-mono text-[8px] font-bold cursor-pointer ${
                        cfg.mute
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
                        onUpdateOutputChannel(c.key, (prev) => ({
                          ...prev,
                          solo: !prev.solo,
                        }));
                      }}
                      className={`px-1 py-0.2 rounded font-studio-mono text-[8px] font-bold cursor-pointer ${
                        cfg.solo
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      S
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={cfg.level}
                    onChange={(e) =>
                      onUpdateOutputChannel(c.key, (prev) => ({
                        ...prev,
                        level: Number(e.target.value),
                      }))
                    }
                    style={{ accentColor: c.color }}
                    className="w-full cursor-pointer"
                    title={`${c.label} Level`}
                  />

                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={cfg.pan}
                    onChange={(e) =>
                      onUpdateOutputChannel(c.key, (prev) => ({
                        ...prev,
                        pan: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-sky-400 cursor-pointer mt-1"
                    title={`${c.label} Pan`}
                  />
                </div>
              );
            })}
          </div>

          {/* Right: Dedicated 4-Stage Granular FX Rack for Selected Output Channel */}
          <div className="xl:col-span-5 rounded-lg border border-white/10 bg-black/40 p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span
                style={{ color: chMeta.color }}
                className="font-studio-mono text-[10px] font-bold"
              >
                {chMeta.code} // {chMeta.label} — 4-STAGE GRANULAR FX RACK
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateOutputChannel(selectedCh, (prev) => ({
                    ...prev,
                    fxBypass: !prev.fxBypass,
                  }))
                }
                className={`px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer ${
                  !chCfg.fxBypass
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                {!chCfg.fxBypass ? '● FX ACTIVE' : '○ FX BYPASSED'}
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1.5 place-items-center">
              <RotaryKnob
                label="TUBE SAT"
                size="sm"
                value={chCfg.fx.satDrive}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.22}
                accentColor={chMeta.color}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(satDrive) =>
                  onUpdateOutputChannel(selectedCh, (p) => ({
                    ...p,
                    fx: { ...p.fx, satDrive },
                  }))
                }
              />
              <RotaryKnob
                label="LO-FI BIT"
                size="sm"
                value={chCfg.fx.crushAmt}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0}
                accentColor={chMeta.color}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(crushAmt) =>
                  onUpdateOutputChannel(selectedCh, (p) => ({
                    ...p,
                    fx: { ...p.fx, crushAmt },
                  }))
                }
              />
              <RotaryKnob
                label="CHOR MIX"
                size="sm"
                value={chCfg.fx.chorusMix}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.18}
                accentColor="#38BDF8"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(chorusMix) =>
                  onUpdateOutputChannel(selectedCh, (p) => ({
                    ...p,
                    fx: { ...p.fx, chorusMix },
                  }))
                }
              />
              <RotaryKnob
                label="HPF CUT"
                size="sm"
                value={chCfg.fx.hpFreq}
                min={20}
                max={2000}
                step={10}
                defaultValue={30}
                accentColor="#F59E0B"
                formatValue={(v) => `${Math.round(v)}Hz`}
                onChange={(hpFreq) =>
                  onUpdateOutputChannel(selectedCh, (p) => ({
                    ...p,
                    fx: { ...p.fx, hpFreq },
                  }))
                }
              />
              <RotaryKnob
                label="LPF TONE"
                size="sm"
                value={chCfg.fx.lpFreq}
                min={200}
                max={16000}
                step={50}
                defaultValue={14000}
                accentColor="#F59E0B"
                formatValue={(v) => `${Math.round(v)}Hz`}
                onChange={(lpFreq) =>
                  onUpdateOutputChannel(selectedCh, (p) => ({
                    ...p,
                    fx: { ...p.fx, lpFreq },
                  }))
                }
              />
              <RotaryKnob
                label="SPACE SEND"
                size="sm"
                value={chCfg.fx.revSend}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.25}
                accentColor="#A855F7"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(revSend) =>
                  onUpdateOutputChannel(selectedCh, (p) => ({
                    ...p,
                    fx: { ...p.fx, revSend },
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {modMatrixOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {patch.matrixSlots.map((slot, idx) => (
            <div
              key={idx}
              className="p-2 rounded-lg bg-black/45 border border-white/10 font-studio-mono text-[10px] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold">SLOT 0{idx + 1}</span>
                <input
                  type="checkbox"
                  checked={slot.enabled}
                  onChange={(e) =>
                    onUpdateModMatrixSlot(idx, (prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className="accent-amber-400 cursor-pointer"
                />
              </div>

              <select
                value={slot.source}
                onChange={(e) =>
                  onUpdateModMatrixSlot(idx, (prev) => ({
                    ...prev,
                    source: e.target.value as AetherModSource,
                  }))
                }
                className="w-full bg-black/60 text-sky-300 rounded px-1 py-0.5 border border-white/10 cursor-pointer"
              >
                {MOD_SOURCES.map((s) => (
                  <option key={s} value={s} className="bg-[#11161F]">
                    SRC: {s.toUpperCase()}
                  </option>
                ))}
              </select>

              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={slot.depth}
                onChange={(e) =>
                  onUpdateModMatrixSlot(idx, (prev) => ({
                    ...prev,
                    depth: Number(e.target.value),
                  }))
                }
                className="w-full accent-amber-400 cursor-pointer"
              />

              <select
                value={slot.dest}
                onChange={(e) =>
                  onUpdateModMatrixSlot(idx, (prev) => ({
                    ...prev,
                    dest: e.target.value as AetherModDest,
                  }))
                }
                className="w-full bg-black/60 text-amber-300 rounded px-1 py-0.5 border border-white/10 cursor-pointer"
              >
                {MOD_DESTS.map((d) => (
                  <option key={d} value={d} className="bg-[#11161F]">
                    → {d}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
