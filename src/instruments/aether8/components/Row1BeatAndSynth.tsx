import React, { useState } from 'react';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import type { Aether8Telemetry } from '../audio/Aether8AudioEngine';
import type {
  Aether8PatchV4,
  BeatVoiceKey,
  BeatVoiceSynthConfig,
  PatternBankId,
  SignalDomain,
} from '../types';
import { PatchJackButton } from './PatchJackButton';

export interface Row1BeatAndSynthProps {
  patch: Aether8PatchV4;
  telemetry: Aether8Telemetry;
  visibleBar: number;
  activeFromJack: { jackId: string; domain: SignalDomain } | null;
  onSelectPatternBank: (bankId: PatternBankId) => void;
  onTogglePatternChain: () => void;
  onSetBarCount: (bars: 1 | 2 | 4) => void;
  onSelectVisibleBar: (barIdx: number) => void;
  onToggleAutoFollow: () => void;
  onCopyBar1ToAll: () => void;
  onGenerateStylePattern: (style: 'dub' | 'minimal' | 'clear') => void;
  onSetTrackPolyLength: (trackIdx: number, len: number) => void;
  onToggleXoxStep: (trackIdx: number, absStepIdx: number) => void;
  onToggleXoxMute: (trackIdx: number) => void;
  onToggleXoxNormLink: (trackIdx: number) => void;
  onAuditionBeatVoice: (voiceKey: BeatVoiceKey) => void;
  onUpdateBeatVoice: (
    voiceKey: BeatVoiceKey,
    updater: (prev: BeatVoiceSynthConfig) => BeatVoiceSynthConfig
  ) => void;
  onSelectJack: (
    jackId: string,
    direction: 'in' | 'out',
    domain: SignalDomain
  ) => void;
  onRemoveJackCables: (jackId: string) => void;
}

const TRACK_LABELS: { key: BeatVoiceKey; name: string; color: string; trigId: string }[] = [
  { key: 'kick', name: '01 SUB KICK', color: '#F43F5E', trigId: 'xox:trig1' },
  { key: 'rim', name: '02 DUB RIM', color: '#F59E0B', trigId: 'xox:trig2' },
  { key: 'hat', name: '03 DUST HAT', color: '#38BDF8', trigId: 'xox:trig3' },
  { key: 'tom', name: '04 WOOD TOM', color: '#34D399', trigId: 'xox:trig4' },
];

export const Row1BeatAndSynth: React.FC<Row1BeatAndSynthProps> = ({
  patch,
  telemetry,
  visibleBar,
  activeFromJack,
  onSelectPatternBank,
  onTogglePatternChain,
  onSetBarCount,
  onSelectVisibleBar,
  onToggleAutoFollow,
  onCopyBar1ToAll,
  onGenerateStylePattern,
  onSetTrackPolyLength,
  onToggleXoxStep,
  onToggleXoxMute,
  onToggleXoxNormLink,
  onAuditionBeatVoice,
  onUpdateBeatVoice,
  onSelectJack,
  onRemoveJackCables,
}) => {
  const [selectedVoice, setSelectedVoice] = useState<BeatVoiceKey>('kick');

  const bank = patch.xoxPatterns[patch.activePattern];
  const barOffset = visibleBar * 16;
  const vCfg = patch.beatVoices[selectedVoice];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
      {/* ====================================================================
          MODULE 01 // X0X UNDERTONE SEQUENCER (4-Pattern x 4-Bar x 4-Track)
          ==================================================================== */}
      <div className="xl:col-span-7 rounded-xl border border-sky-500/20 bg-[#11161F] p-3 flex flex-col justify-between">
        {/* Module Header & Multi-Pattern / Multi-Bar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div>
            <span className="font-studio-mono text-[10px] font-bold text-rose-400">
              01 // X0X UNDERTONE SEQUENCER
            </span>
            <span className="text-[10px] font-studio-mono text-gray-500 ml-2">
              4-PAT × 4-BAR POLYRHYTHMIC PULSE
            </span>
          </div>

          {/* 4 Pattern Banks + CHAIN */}
          <div className="flex items-center gap-1 bg-black/45 p-0.5 rounded-lg border border-white/10">
            {(['A', 'B', 'C', 'D'] as PatternBankId[]).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => onSelectPatternBank(pid)}
                className={`px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold cursor-pointer ${
                  patch.activePattern === pid
                    ? 'bg-rose-500 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                PAT {pid}
              </button>
            ))}
            <button
              type="button"
              onClick={onTogglePatternChain}
              className={`px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer ${
                patch.patternChainEnabled
                  ? 'bg-amber-400 text-black'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Automatically chain PAT A -> B -> C -> D"
            >
              CHAIN
            </button>
          </div>

          {/* Bar Count (1/2/4) & Bar Page Selector (B1..B4) */}
          <div className="flex items-center gap-1 bg-black/45 p-0.5 rounded-lg border border-white/10 font-studio-mono text-[10px]">
            {([1, 2, 4] as const).map((bc) => (
              <button
                key={bc}
                type="button"
                onClick={() => onSetBarCount(bc)}
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  bank.barCount === bc
                    ? 'bg-sky-400 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {bc}B
              </button>
            ))}
            <span className="text-gray-600">|</span>
            {Array.from({ length: bank.barCount }, (_, bIdx) => (
              <button
                key={bIdx}
                type="button"
                onClick={() => onSelectVisibleBar(bIdx)}
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  visibleBar === bIdx
                    ? 'bg-white/20 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                B{bIdx + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={onToggleAutoFollow}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                patch.xoxAutoFollow
                  ? 'bg-emerald-500/25 text-emerald-300'
                  : 'text-gray-500'
              }`}
            >
              FOLLOW
            </button>
          </div>
        </div>

        {/* 4 Polyrhythmic X0X Step Lanes */}
        <div className="space-y-1.5 my-2">
          {TRACK_LABELS.map((tMeta, tIdx) => {
            const polyLen = bank.trackLengths[tIdx] || 16;
            const muted = patch.xoxMuted[tIdx];
            const linked = patch.xoxNormLink[tIdx];

            return (
              <div
                key={tMeta.key}
                className="grid grid-cols-[190px_1fr] gap-2 items-center bg-black/35 px-2 py-1 rounded-lg border border-white/5"
              >
                {/* Track Header: Audition, Polyrhythmic Length (4-16), Mute & Normalled Link */}
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoice(tMeta.key);
                      onAuditionBeatVoice(tMeta.key);
                    }}
                    style={{ color: tMeta.color }}
                    className="font-studio-mono text-[10px] font-bold truncate text-left cursor-pointer hover:underline"
                    title="Click to Audition & Select Voice in Module 02"
                  >
                    {tMeta.name}
                  </button>

                  <div className="flex items-center gap-1 shrink-0 font-studio-mono text-[9px]">
                    <select
                      aria-label={`${tMeta.name} Step Length`}
                      value={polyLen}
                      onChange={(e) =>
                        onSetTrackPolyLength(tIdx, Number(e.target.value))
                      }
                      className="bg-black/60 text-gray-200 rounded border border-white/10 px-1 py-0.2 cursor-pointer"
                      title="Polyrhythmic Step Length (4..16 steps)"
                    >
                      {Array.from({ length: 13 }, (_, i) => i + 4).map((l) => (
                        <option key={l} value={l} className="bg-[#11161F]">
                          L:{l}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => onToggleXoxMute(tIdx)}
                      className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                        muted
                          ? 'bg-rose-500 text-black'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      M
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleXoxNormLink(tIdx)}
                      className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                        linked
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : 'bg-white/5 text-gray-500'
                      }`}
                      title="Normalled internal trigger connection to Module 02"
                    >
                      LNK
                    </button>
                  </div>
                </div>

                {/* 16 Step Buttons */}
                <div className="grid grid-cols-16 gap-1 h-6">
                  {Array.from({ length: 16 }, (_, sIdx) => {
                    const disabledByPoly = sIdx >= polyLen;
                    const absIdx = barOffset + sIdx;
                    const active = bank.steps[tIdx]?.[absIdx] === 1;
                    const isPlayhead =
                      telemetry.xoxTrackSteps[tIdx] === absIdx;

                    return (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={disabledByPoly}
                        onClick={() => onToggleXoxStep(tIdx, absIdx)}
                        style={{
                          backgroundColor: disabledByPoly
                            ? 'rgba(0,0,0,0.2)'
                            : active
                              ? tMeta.color
                              : sIdx % 4 === 0
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(255,255,255,0.04)',
                          borderColor: isPlayhead
                            ? '#FFFFFF'
                            : 'rgba(255,255,255,0.08)',
                        }}
                        className={`rounded border transition-all cursor-pointer ${
                          disabledByPoly ? 'opacity-20 cursor-not-allowed' : ''
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Generator Strip & 6 Trigger Patch Outputs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10">
          <div className="flex items-center gap-1.5 font-studio-mono text-[9px]">
            <button
              type="button"
              onClick={onCopyBar1ToAll}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-gray-300 cursor-pointer"
            >
              COPY B1→ALL
            </button>
            <button
              type="button"
              onClick={() => onGenerateStylePattern('dub')}
              className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-500/40 text-sky-200 font-bold cursor-pointer"
            >
              DUB GROOVE
            </button>
            <button
              type="button"
              onClick={() => onGenerateStylePattern('minimal')}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-200 cursor-pointer"
            >
              MINIMAL
            </button>
            <button
              type="button"
              onClick={() => onGenerateStylePattern('clear')}
              className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
            >
              CLEAR
            </button>
          </div>

          <div className="flex items-center gap-1">
            {[
              { id: 'xox:trig1', label: 'TRK 1 TRG' },
              { id: 'xox:trig2', label: 'TRK 2 TRG' },
              { id: 'xox:trig3', label: 'TRK 3 TRG' },
              { id: 'xox:trig4', label: 'TRK 4 TRG' },
              { id: 'xox:stepClk', label: 'STEP CLK' },
              { id: 'xox:barTrig', label: 'BAR 1 TRG' },
            ].map((j) => (
              <PatchJackButton
                key={j.id}
                jackId={j.id}
                label={j.label}
                direction="out"
                domain="trig"
                cables={patch.cables}
                activeFromJack={activeFromJack}
                onSelectJack={onSelectJack}
                onRemoveJackCables={onRemoveJackCables}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODULE 02 // ANALOG BEAT SYNTH (4-Voice Full-Synth Percussion Engine)
          ==================================================================== */}
      <div className="xl:col-span-5 rounded-xl border border-sky-500/20 bg-[#11161F] p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-amber-400">
            02 // ANALOG BEAT SYNTH (4-VOICE)
          </span>

          {/* 4-Voice Tabs + Audition */}
          <div className="flex items-center gap-1">
            {TRACK_LABELS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => {
                  setSelectedVoice(v.key);
                  onAuditionBeatVoice(v.key);
                }}
                style={{
                  backgroundColor:
                    selectedVoice === v.key ? v.color : 'rgba(255,255,255,0.06)',
                  color: selectedVoice === v.key ? '#000' : '#E2E8F0',
                }}
                className="px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer"
              >
                {v.key.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Waveform & Filter Topology Selectors */}
        <div className="flex items-center justify-between gap-2 my-1 font-studio-mono text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">WAVE:</span>
            {(['sine', 'triangle', 'sawtooth', 'square'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() =>
                  onUpdateBeatVoice(selectedVoice, (prev) => ({
                    ...prev,
                    wave: w,
                  }))
                }
                className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                  vCfg.wave === w
                    ? 'bg-amber-400 text-black font-bold'
                    : 'bg-white/5 text-gray-400'
                }`}
              >
                {w.slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-400">FILT:</span>
            {(['lowpass', 'bandpass', 'highpass'] as const).map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() =>
                  onUpdateBeatVoice(selectedVoice, (prev) => ({
                    ...prev,
                    filterType: ft,
                  }))
                }
                className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                  vCfg.filterType === ft
                    ? 'bg-sky-400 text-black font-bold'
                    : 'bg-white/5 text-gray-400'
                }`}
              >
                {ft === 'lowpass' ? 'LP' : ft === 'bandpass' ? 'BP' : 'HP'}
              </button>
            ))}
          </div>
        </div>

        {/* 8 Granular Beat Synth Knobs */}
        <div className="grid grid-cols-4 gap-2 place-items-center py-1 bg-black/30 rounded-lg border border-white/5">
          <RotaryKnob
            label="OSC FREQ"
            size="sm"
            value={vCfg.freq}
            min={28}
            max={900}
            step={1}
            defaultValue={55}
            accentColor="#F43F5E"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(freq) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, freq }))
            }
          />
          <RotaryKnob
            label="P-ENV/FM"
            size="sm"
            value={vCfg.pEnvAmt}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.6}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(pEnvAmt) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, pEnvAmt }))
            }
          />
          <RotaryKnob
            label="NOISE MIX"
            size="sm"
            value={vCfg.noiseMix}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.1}
            accentColor="#A855F7"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(noiseMix) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, noiseMix }))
            }
          />
          <RotaryKnob
            label="FILT CUT"
            size="sm"
            value={vCfg.cutoff}
            min={45}
            max={14000}
            step={15}
            defaultValue={1200}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(cutoff) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, cutoff }))
            }
          />
          <RotaryKnob
            label="FILT RES"
            size="sm"
            value={vCfg.res}
            min={0.5}
            max={16}
            step={0.1}
            defaultValue={2.5}
            accentColor="#38BDF8"
            formatValue={(v) => `${v.toFixed(1)}Q`}
            onChange={(res) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, res }))
            }
          />
          <RotaryKnob
            label="SAT DRIVE"
            size="sm"
            value={vCfg.drive}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.3}
            accentColor="#F43F5E"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(drive) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, drive }))
            }
          />
          <RotaryKnob
            label="DECAY"
            size="sm"
            value={vCfg.decay}
            min={0.02}
            max={0.95}
            step={0.01}
            defaultValue={0.32}
            accentColor="#34D399"
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(decay) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, decay }))
            }
          />
          <RotaryKnob
            label="RELEASE"
            size="sm"
            value={vCfg.release}
            min={0.02}
            max={1.4}
            step={0.01}
            defaultValue={0.15}
            accentColor="#34D399"
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(release) =>
              onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, release }))
            }
          />
        </div>

        {/* Patch Jacks */}
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-white/10">
          {[
            { id: 'beats:kickIn', label: 'KICK IN', dir: 'in' as const, dom: 'trig' as const },
            { id: 'beats:rimIn', label: 'RIM IN', dir: 'in' as const, dom: 'trig' as const },
            { id: 'beats:hatIn', label: 'HAT IN', dir: 'in' as const, dom: 'trig' as const },
            { id: 'beats:tomIn', label: 'TOM IN', dir: 'in' as const, dom: 'trig' as const },
            { id: 'beats:filtCv', label: 'FILT CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'beats:mixOut', label: 'MIX OUT', dir: 'out' as const, dom: 'audio' as const },
            { id: 'beats:envOut', label: 'ENV CV', dir: 'out' as const, dom: 'cv' as const },
          ].map((j) => (
            <PatchJackButton
              key={j.id}
              jackId={j.id}
              label={j.label}
              direction={j.dir}
              domain={j.dom}
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
