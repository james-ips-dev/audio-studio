import React, { useRef, useState } from 'react';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import type { Aether8Telemetry } from '../audio/Aether8AudioEngine';
import {
  AETHER_TRACK_META,
  AETHER_TRACK_PRESET_BANKS,
  aetherMidiToNoteName,
  applyAetherTrackPreset,
  applyMacroToAetherVoice,
} from '../presets/factoryPatches';
import type {
  Aether8PatchV4,
  AetherFilterType,
  AetherOscWave,
  AetherVoiceMode,
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
  activeFromJack: {
    jackId: string;
    domain: SignalDomain;
    originalSourceJackId?: string;
  } | null;
  onSelectPatternBank: (bankId: PatternBankId) => void;
  onTogglePatternChain: () => void;
  onSetBarCount: (bars: 1 | 2 | 4) => void;
  onSelectVisibleBar: (barIdx: number) => void;
  onToggleAutoFollow: () => void;
  onCopyBar1ToAll: () => void;
  onGenerateStylePattern: (style: 'dub' | 'minimal' | 'clear') => void;
  onSetTrackPolyLength: (trackIdx: number, len: number) => void;
  onSetXoxStepDuration: (
    trackIdx: number,
    absStepIdx: number,
    durationSteps: number
  ) => void;
  onSetXoxStepNote: (
    trackIdx: number,
    absStepIdx: number,
    midiNote: number
  ) => void;
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
  onRemoveSingleCable?: (cableId: string) => void;
  onStartDaisyChain?: (
    fromEndpointJackId: string,
    originalSourceJackId: string,
    domain: SignalDomain
  ) => void;
}

const STUDIO_WAVES: AetherOscWave[] = [
  'sine',
  'triangle',
  'sawtooth',
  'square',
  'pwm',
  'supersaw',
];
const STUDIO_FILTERS: AetherFilterType[] = [
  'lp12',
  'lp24',
  'bp12',
  'hp12',
  'notch',
];
const STUDIO_VOICE_MODES: AetherVoiceMode[] = ['mono', 'poly', 'unison'];

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
  onSetXoxStepDuration,
  onSetXoxStepNote,
  onToggleXoxMute,
  onToggleXoxNormLink,
  onAuditionBeatVoice,
  onUpdateBeatVoice,
  onSelectJack,
  onRemoveJackCables,
  onRemoveSingleCable,
  onStartDaisyChain,
}) => {
  const [selectedVoice, setSelectedVoice] = useState<BeatVoiceKey>('kick');
  const [synthSubTab, setSynthSubTab] = useState<
    'macros' | 'osc' | 'filter' | 'env'
  >('macros');
  const [dragExtendMode, setDragExtendMode] = useState(true);
  const [inspectedStep, setInspectedStep] = useState<{
    trackIdx: number;
    absStepIdx: number;
  }>({ trackIdx: 0, absStepIdx: 0 });

  const dragOriginRef = useRef<{ trackIdx: number; absStepIdx: number } | null>(
    null
  );
  const paintIntentRef = useRef<number | null>(null);

  const bank = patch.xoxPatterns[patch.activePattern];
  const barOffset = visibleBar * 16;
  const vCfg = patch.beatVoices[selectedVoice] ?? patch.beatVoices.kick;
  const selectedTrackMeta =
    AETHER_TRACK_META.find((m) => m.key === selectedVoice) ??
    AETHER_TRACK_META[0];
  const presetBank = AETHER_TRACK_PRESET_BANKS[selectedVoice] ?? [];

  const handleCyclePreset = (dir: -1 | 1) => {
    if (presetBank.length === 0) return;
    const curIdx = presetBank.findIndex((p) => p.name === vCfg.presetName);
    const nextIdx = (curIdx + dir + presetBank.length) % presetBank.length;
    const chosen = presetBank[nextIdx];
    onUpdateBeatVoice(selectedVoice, (prev) =>
      applyAetherTrackPreset(prev, chosen)
    );
    onAuditionBeatVoice(selectedVoice);
  };

  const handleSelectPresetByName = (presetName: string) => {
    const chosen = presetBank.find((p) => p.name === presetName);
    if (!chosen) return;
    onUpdateBeatVoice(selectedVoice, (prev) =>
      applyAetherTrackPreset(prev, chosen)
    );
    onAuditionBeatVoice(selectedVoice);
  };

  const handleMutateVoice = () => {
    onUpdateBeatVoice(selectedVoice, (prev) => {
      const jitter = (base: number, span: number, min = 0, max = 1) =>
        Math.min(max, Math.max(min, base + (Math.random() * 2 - 1) * span));
      let next = { ...prev };
      next = applyMacroToAetherVoice(
        next,
        'cutoff',
        jitter(prev.macros.cutoff, 0.24)
      );
      next = applyMacroToAetherVoice(
        next,
        'resonance',
        jitter(prev.macros.resonance, 0.22)
      );
      next = applyMacroToAetherVoice(
        next,
        'fmDirt',
        jitter(prev.macros.fmDirt, 0.25)
      );
      next = applyMacroToAetherVoice(
        next,
        'ampDecay',
        jitter(prev.macros.ampDecay, 0.2, 0.06, 0.95)
      );
      next = applyMacroToAetherVoice(
        next,
        'detune',
        jitter(prev.macros.detune, 0.22)
      );
      return next;
    });
    onAuditionBeatVoice(selectedVoice);
  };

  const inspectedTrackMeta =
    AETHER_TRACK_META[inspectedStep.trackIdx] ?? AETHER_TRACK_META[0];
  const inspectedStepDur =
    bank.steps[inspectedStep.trackIdx]?.[inspectedStep.absStepIdx] ?? 0;
  const inspectedStepNote =
    bank.notes?.[inspectedStep.trackIdx]?.[inspectedStep.absStepIdx] ??
    inspectedTrackMeta.defaultMidiNote;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
      {/* ====================================================================
          MODULE 01 // 8-TRACK X0X UNDERTONE SEQUENCER (4-Pat x 4-Bar x 8-Track)
          ==================================================================== */}
      <div
        className="xl:col-span-7 rounded-xl border border-sky-500/20 bg-[#11161F] p-3 flex flex-col justify-between"
        onPointerUp={() => {
          dragOriginRef.current = null;
          paintIntentRef.current = null;
        }}
        onPointerLeave={() => {
          dragOriginRef.current = null;
          paintIntentRef.current = null;
        }}
      >
        {/* Module Header & Multi-Pattern / Multi-Bar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-studio-mono text-[10px] font-bold text-rose-400">
              01 // 8-TRACK X0X SEQUENCER
            </span>
            <button
              type="button"
              onClick={() => setDragExtendMode((v) => !v)}
              className={`px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold border transition-colors cursor-pointer ${
                dragExtendMode
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                  : 'bg-white/5 text-gray-300 border-white/10'
              }`}
              title="Toggle Drag-to-Extend Multi-Beat Notes vs Drag-to-Paint Individual Steps"
            >
              {dragExtendMode ? '↔ DRAG: EXTEND TIE' : '✏️ DRAG: PAINT'}
            </button>
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

        {/* 8 Polyrhythmic X0X Step Lanes */}
        <div className="space-y-1 my-1.5">
          {AETHER_TRACK_META.map((tMeta, tIdx) => {
            const polyLen = bank.trackLengths[tIdx] || 16;
            const muted = patch.xoxMuted[tIdx];
            const linked = patch.xoxNormLink[tIdx];
            const isSelectedVoice = selectedVoice === tMeta.key;

            return (
              <div
                key={tMeta.key}
                className={`grid grid-cols-[185px_1fr] gap-2 items-center px-2 py-0.5 rounded-lg border transition-colors ${
                  isSelectedVoice
                    ? 'bg-[#171E2B] border-white/15'
                    : 'bg-black/35 border-white/5'
                }`}
              >
                {/* Track Header: Audition, Polyrhythmic Length (4-16), Mute & Normalled Link */}
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoice(tMeta.key);
                      onAuditionBeatVoice(tMeta.key);
                    }}
                    style={{ color: isSelectedVoice ? '#FFF' : tMeta.color }}
                    className="font-studio-mono text-[10px] font-bold truncate text-left cursor-pointer hover:underline"
                    title="Click to Audition & Edit Full Studio Synth in Module 02"
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
                      className={`px-1 py-0.5 rounded font-bold cursor-pointer ${
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

                {/* 16 Step Buttons with Multi-Beat Extendable Tie Bars */}
                <div className="grid grid-cols-16 gap-1 h-5">
                  {Array.from({ length: 16 }, (_, sIdx) => {
                    const disabledByPoly = sIdx >= polyLen;
                    const absIdx = barOffset + sIdx;
                    const stepVal = bank.steps[tIdx]?.[absIdx] ?? 0;
                    const active = stepVal >= 1;

                    // Check if covered by an earlier active step's multi-beat tie
                    let tieSourceAbsIdx: number | null = null;
                    let isTieEnd = false;
                    if (!active && !disabledByPoly) {
                      for (
                        let prevIdx = absIdx - 1;
                        prevIdx >= Math.max(barOffset, absIdx - 15);
                        prevIdx--
                      ) {
                        const prevVal = bank.steps[tIdx]?.[prevIdx] ?? 0;
                        if (prevVal >= 1) {
                          if (prevIdx + prevVal > absIdx) {
                            tieSourceAbsIdx = prevIdx;
                            isTieEnd = prevIdx + prevVal - 1 === absIdx;
                          }
                          break;
                        }
                      }
                    }

                    const isTiedContinuation = tieSourceAbsIdx !== null;
                    const isPlayhead = telemetry.xoxTrackSteps[tIdx] === absIdx;
                    const isInspected =
                      inspectedStep.trackIdx === tIdx &&
                      (inspectedStep.absStepIdx === absIdx ||
                        (tieSourceAbsIdx !== null &&
                          inspectedStep.absStepIdx === tieSourceAbsIdx));
                    const midiNote =
                      bank.notes?.[tIdx]?.[absIdx] ?? tMeta.defaultMidiNote;

                    return (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={disabledByPoly}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          if (disabledByPoly) return;
                          setSelectedVoice(tMeta.key);

                          // Shift+Click extends the nearest preceding active step up to this step
                          if (e.shiftKey) {
                            for (let pIdx = absIdx - 1; pIdx >= barOffset; pIdx--) {
                              if ((bank.steps[tIdx]?.[pIdx] ?? 0) >= 1) {
                                const newDur = Math.min(16, absIdx - pIdx + 1);
                                onSetXoxStepDuration(tIdx, pIdx, newDur);
                                setInspectedStep({
                                  trackIdx: tIdx,
                                  absStepIdx: pIdx,
                                });
                                return;
                              }
                            }
                          }

                          if (tieSourceAbsIdx !== null) {
                            const newDur = Math.max(
                              1,
                              absIdx - tieSourceAbsIdx
                            );
                            onSetXoxStepDuration(tIdx, tieSourceAbsIdx, newDur);
                            setInspectedStep({
                              trackIdx: tIdx,
                              absStepIdx: tieSourceAbsIdx,
                            });
                            return;
                          }

                          const nextVal = active ? 0 : 1;
                          onSetXoxStepDuration(tIdx, absIdx, nextVal);
                          setInspectedStep({
                            trackIdx: tIdx,
                            absStepIdx: absIdx,
                          });

                          if (dragExtendMode) {
                            dragOriginRef.current =
                              nextVal >= 1
                                ? { trackIdx: tIdx, absStepIdx: absIdx }
                                : null;
                          } else {
                            paintIntentRef.current = nextVal;
                          }
                        }}
                        onPointerEnter={() => {
                          if (disabledByPoly) return;
                          if (
                            dragExtendMode &&
                            dragOriginRef.current &&
                            dragOriginRef.current.trackIdx === tIdx
                          ) {
                            const orig = dragOriginRef.current.absStepIdx;
                            if (absIdx >= orig) {
                              onSetXoxStepDuration(
                                tIdx,
                                orig,
                                Math.min(16, absIdx - orig + 1)
                              );
                            }
                            return;
                          }
                          if (paintIntentRef.current !== null) {
                            onSetXoxStepDuration(
                              tIdx,
                              absIdx,
                              paintIntentRef.current
                            );
                          }
                        }}
                        style={{
                          backgroundColor: disabledByPoly
                            ? 'rgba(0,0,0,0.2)'
                            : active
                              ? tMeta.color
                              : isTiedContinuation
                                ? `${tMeta.color}55`
                                : sIdx % 4 === 0
                                  ? 'rgba(255,255,255,0.1)'
                                  : 'rgba(255,255,255,0.04)',
                          borderColor: isInspected
                            ? '#FBBF24'
                            : isPlayhead
                              ? '#FFFFFF'
                              : isTiedContinuation
                                ? tMeta.color
                                : 'rgba(255,255,255,0.08)',
                        }}
                        className={`rounded border transition-all flex items-center justify-center cursor-pointer touch-none-control ${
                          disabledByPoly ? 'opacity-20 cursor-not-allowed' : ''
                        }`}
                      >
                        {active && (
                          <span className="font-studio-mono text-[7px] font-bold text-black leading-none truncate">
                            {!tMeta.isDrum
                              ? aetherMidiToNoteName(midiNote)
                              : stepVal > 1
                                ? `═${stepVal}`
                                : ''}
                          </span>
                        )}
                        {isTiedContinuation && (
                          <span className="font-studio-mono text-[8px] font-bold text-white leading-none select-none">
                            {isTieEnd ? '═►' : '══'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Step Note Tie Length & Pitch Bar (Extendable Multi-Beat Notes Without Retriggering) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 py-1 px-2 rounded bg-black/45 border border-white/10 font-studio-mono text-[9px]">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="px-1.5 py-0.5 rounded font-bold text-black"
              style={{ backgroundColor: inspectedTrackMeta.color }}
            >
              {inspectedTrackMeta.shortLabel} • STEP {(inspectedStep.absStepIdx % 16) + 1}
            </span>
            <span className="text-amber-300 font-bold ml-1">↔ TIE LEN:</span>
            {[
              { steps: 1, label: '1S' },
              { steps: 2, label: '2S' },
              { steps: 4, label: '1 BEAT (4S)' },
              { steps: 8, label: '2 BEATS (8S)' },
              { steps: 12, label: '3 BEATS (12S)' },
              { steps: 16, label: '1 BAR (16S)' },
            ].map((item) => (
              <button
                key={item.steps}
                type="button"
                onClick={() =>
                  onSetXoxStepDuration(
                    inspectedStep.trackIdx,
                    inspectedStep.absStepIdx,
                    item.steps
                  )
                }
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  inspectedStepDur === item.steps
                    ? 'bg-amber-400 text-black'
                    : 'bg-white/5 text-gray-300 hover:bg-white/15'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">NOTE PITCH:</span>
            <select
              aria-label="Step MIDI Note"
              value={inspectedStepNote}
              onChange={(e) =>
                onSetXoxStepNote(
                  inspectedStep.trackIdx,
                  inspectedStep.absStepIdx,
                  Number(e.target.value)
                )
              }
              className="bg-black/60 rounded border border-white/15 px-1 py-0.5 text-sky-300 font-bold cursor-pointer"
            >
              {Array.from({ length: 49 }, (_, i) => i + 24).map((midi) => (
                <option key={midi} value={midi} className="bg-[#11161F]">
                  {aetherMidiToNoteName(midi)} ({midi})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onCopyBar1ToAll}
              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-gray-300 cursor-pointer"
            >
              B1→ALL
            </button>
            <button
              type="button"
              onClick={() => onGenerateStylePattern('dub')}
              className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-500/40 text-sky-200 font-bold cursor-pointer"
            >
              DUB
            </button>
            <button
              type="button"
              onClick={() => onGenerateStylePattern('minimal')}
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-200 cursor-pointer"
            >
              MIN
            </button>
            <button
              type="button"
              onClick={() => onGenerateStylePattern('clear')}
              className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
            >
              CLR
            </button>
          </div>
        </div>

        {/* 8 Trigger Outputs + 8 CV Outputs + Clock/Bar Patch Jacks */}
        <div className="pt-1.5 mt-1 border-t border-white/10 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            {AETHER_TRACK_META.map((m) => (
              <PatchJackButton
                key={m.trigOutId}
                jackId={m.trigOutId}
                label={`T${m.index + 1} TRG`}
                direction="out"
                domain="trig"
                cables={patch.cables}
                activeFromJack={activeFromJack}
                onSelectJack={onSelectJack}
                onRemoveJackCables={onRemoveJackCables}
                onRemoveSingleCable={onRemoveSingleCable}
                onStartDaisyChain={onStartDaisyChain}
              />
            ))}
            <PatchJackButton
              jackId="xox:stepClk"
              label="STEP CLK"
              direction="out"
              domain="trig"
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
            <PatchJackButton
              jackId="xox:barTrig"
              label="BAR 1 TRG"
              direction="out"
              domain="trig"
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            {AETHER_TRACK_META.map((m) => (
              <PatchJackButton
                key={m.cvOutId}
                jackId={m.cvOutId}
                label={`T${m.index + 1} CV`}
                direction="out"
                domain="cv"
                cables={patch.cables}
                activeFromJack={activeFromJack}
                onSelectJack={onSelectJack}
                onRemoveJackCables={onRemoveJackCables}
                onRemoveSingleCable={onRemoveSingleCable}
                onStartDaisyChain={onStartDaisyChain}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODULE 02 // 8-TRACK STUDIO SYNTH & BEAT ENGINE (20 Presets x 8 Tracks)
          ==================================================================== */}
      <div className="xl:col-span-5 rounded-xl border border-sky-500/20 bg-[#11161F] p-3 flex flex-col justify-between">
        {/* Top Row: Title + 20-Preset Browser + Audition Hit & Mutate */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="font-studio-mono text-[10px] font-bold text-amber-400">
              02 // 8-TRACK STUDIO SYNTH
            </span>
            <div className="flex items-center bg-black/55 rounded border border-white/15">
              <button
                type="button"
                onClick={() => handleCyclePreset(-1)}
                className="px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white cursor-pointer"
              >
                ◀
              </button>
              <select
                aria-label="Track Synth Engine Preset"
                value={vCfg.presetName}
                onChange={(e) => handleSelectPresetByName(e.target.value)}
                className="bg-transparent px-1 py-0.5 font-studio-mono text-[10px] font-bold text-white max-w-[148px] truncate cursor-pointer"
              >
                <optgroup
                  label="☁️ 10 Soft Silk Presets"
                  className="bg-[#11161F] text-sky-300"
                >
                  {presetBank
                    .filter((p) => p.modeTag === 'soft')
                    .map((p) => (
                      <option
                        key={p.name}
                        value={p.name}
                        className="bg-[#11161F] text-white"
                      >
                        {p.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup
                  label="⚡ 10 Harsh Presets"
                  className="bg-[#11161F] text-amber-300"
                >
                  {presetBank
                    .filter((p) => p.modeTag === 'harsh')
                    .map((p) => (
                      <option
                        key={p.name}
                        value={p.name}
                        className="bg-[#11161F] text-white"
                      >
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              </select>
              <button
                type="button"
                onClick={() => handleCyclePreset(1)}
                className="px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white cursor-pointer"
              >
                ▶
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAuditionBeatVoice(selectedVoice)}
              style={{ backgroundColor: selectedTrackMeta.color }}
              className="px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold text-black cursor-pointer shadow"
            >
              🔊 HIT
            </button>
            <button
              type="button"
              onClick={handleMutateVoice}
              className="px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/40 font-studio-mono text-[9px] font-bold text-amber-300 cursor-pointer"
            >
              🎲 MUTATE
            </button>
          </div>
        </div>

        {/* 8-Track Selector Pills */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 my-1">
          {AETHER_TRACK_META.map((v) => (
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
              className="py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer truncate"
            >
              {v.index + 1}.{v.shortLabel}
            </button>
          ))}
        </div>

        {/* Full Studio Synth Engine Page Switcher (MACROS / OSC & SUB / FILTER & DRIVE / ENV & VOICE) */}
        <div className="flex items-center justify-between gap-1 bg-black/45 p-0.5 rounded-lg border border-white/10 font-studio-mono text-[9px] my-1">
          {(
            [
              { id: 'macros', label: '🎛️ 6 MACROS' },
              { id: 'osc', label: '〰️ 4-OSC & NOISE' },
              { id: 'filter', label: '🎚️ ZDF FILTER' },
              { id: 'env', label: '📈 ADSR & UNISON' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSynthSubTab(tab.id)}
              className={`flex-1 py-1 rounded font-bold transition-colors cursor-pointer ${
                synthSubTab === tab.id
                  ? 'bg-sky-400 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-Tab 1: 6 Studio Synth Macros */}
        {synthSubTab === 'macros' && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 place-items-center py-2 bg-black/30 rounded-lg border border-white/5">
            <RotaryKnob
              label="CUTOFF"
              size="sm"
              value={vCfg.macros.cutoff}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.5}
              accentColor={selectedTrackMeta.color}
              formatValue={() => `${Math.round(vCfg.filter.cutoff)}Hz`}
              onChange={(val) =>
                onUpdateBeatVoice(selectedVoice, (p) =>
                  applyMacroToAetherVoice(p, 'cutoff', val)
                )
              }
            />
            <RotaryKnob
              label="RESO"
              size="sm"
              value={vCfg.macros.resonance}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.25}
              accentColor={selectedTrackMeta.color}
              formatValue={() => `${vCfg.filter.resonance.toFixed(1)}Q`}
              onChange={(val) =>
                onUpdateBeatVoice(selectedVoice, (p) =>
                  applyMacroToAetherVoice(p, 'resonance', val)
                )
              }
            />
            <RotaryKnob
              label="FM DIRT"
              size="sm"
              value={vCfg.macros.fmDirt}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.2}
              accentColor="#F59E0B"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                onUpdateBeatVoice(selectedVoice, (p) =>
                  applyMacroToAetherVoice(p, 'fmDirt', val)
                )
              }
            />
            <RotaryKnob
              label="DECAY"
              size="sm"
              value={vCfg.macros.ampDecay}
              min={0.03}
              max={1}
              step={0.01}
              defaultValue={0.35}
              accentColor="#34D399"
              formatValue={() => `${Math.round(vCfg.ampEnv.decay * 1000)}ms`}
              onChange={(val) =>
                onUpdateBeatVoice(selectedVoice, (p) =>
                  applyMacroToAetherVoice(p, 'ampDecay', val)
                )
              }
            />
            <RotaryKnob
              label="PITCH ENV"
              size="sm"
              value={vCfg.macros.pitchEnv}
              min={-1}
              max={1}
              step={0.01}
              defaultValue={0.4}
              bipolar
              accentColor="#38BDF8"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) =>
                onUpdateBeatVoice(selectedVoice, (p) =>
                  applyMacroToAetherVoice(p, 'pitchEnv', val)
                )
              }
            />
            <RotaryKnob
              label="DETUNE"
              size="sm"
              value={vCfg.macros.detune}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.15}
              accentColor="#A855F7"
              formatValue={() => `${vCfg.voice.unisonDetune}ct`}
              onChange={(val) =>
                onUpdateBeatVoice(selectedVoice, (p) =>
                  applyMacroToAetherVoice(p, 'detune', val)
                )
              }
            />
          </div>
        )}

        {/* Sub-Tab 2: 4-Oscillator (OSC1, OSC2 + Cross-FM, SUB1, SUB2) + Noise Mixer */}
        {synthSubTab === 'osc' && (
          <div className="space-y-1.5 py-1 bg-black/30 rounded-lg border border-white/5 px-2">
            <div className="grid grid-cols-2 gap-2 font-studio-mono text-[9px]">
              <div className="flex items-center justify-between bg-black/40 px-2 py-0.5 rounded border border-white/10">
                <span className="text-gray-400">OSC 1:</span>
                <select
                  aria-label="Oscillator 1 Wave"
                  value={vCfg.osc1.wave}
                  onChange={(e) => {
                    const wave = e.target.value as AetherOscWave;
                    onUpdateBeatVoice(selectedVoice, (prev) => ({
                      ...prev,
                      osc1: { ...prev.osc1, wave },
                    }));
                  }}
                  className="bg-transparent text-sky-300 font-bold cursor-pointer"
                >
                  {STUDIO_WAVES.map((w) => (
                    <option key={w} value={w} className="bg-[#11161F]">
                      {w.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between bg-black/40 px-2 py-0.5 rounded border border-white/10">
                <span className="text-gray-400">OSC 2:</span>
                <select
                  aria-label="Oscillator 2 Wave"
                  value={vCfg.osc2.wave}
                  onChange={(e) => {
                    const wave = e.target.value as AetherOscWave;
                    onUpdateBeatVoice(selectedVoice, (prev) => ({
                      ...prev,
                      osc2: { ...prev.osc2, wave },
                    }));
                  }}
                  className="bg-transparent text-amber-300 font-bold cursor-pointer"
                >
                  {STUDIO_WAVES.map((w) => (
                    <option key={w} value={w} className="bg-[#11161F]">
                      {w.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1 place-items-center">
              <RotaryKnob
                label="OSC 1"
                size="sm"
                value={vCfg.osc1.level}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.85}
                accentColor={selectedTrackMeta.color}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(level) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    osc1: { ...p.osc1, level },
                  }))
                }
              />
              <RotaryKnob
                label="OSC 2"
                size="sm"
                value={vCfg.osc2.level}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.5}
                accentColor={selectedTrackMeta.color}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(level) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    osc2: { ...p.osc2, level },
                  }))
                }
              />
              <RotaryKnob
                label="OSC2→1 FM"
                size="sm"
                value={vCfg.osc2.fmDepth}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.2}
                accentColor="#F59E0B"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(fmDepth) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    osc2: { ...p.osc2, fmDepth },
                  }))
                }
              />
              <RotaryKnob
                label="SUB 1"
                size="sm"
                value={vCfg.sub1.level}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.6}
                accentColor="#00E5FF"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(level) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    sub1: { ...p.sub1, level },
                  }))
                }
              />
              <RotaryKnob
                label="SUB 2"
                size="sm"
                value={vCfg.sub2.level}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.3}
                accentColor="#38BDF8"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(level) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    sub2: { ...p.sub2, level },
                  }))
                }
              />
              <RotaryKnob
                label="NOISE"
                size="sm"
                value={vCfg.noise.level}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.1}
                accentColor="#EC4899"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(level) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    noiseMix: level,
                    noise: { ...p.noise, level },
                  }))
                }
              />
            </div>
          </div>
        )}

        {/* Sub-Tab 3: Multi-Mode ZDF Filter & Tube Drive */}
        {synthSubTab === 'filter' && (
          <div className="space-y-1.5 py-1 bg-black/30 rounded-lg border border-white/5 px-2">
            <div className="flex items-center justify-between font-studio-mono text-[9px]">
              <span className="text-gray-400">FILTER TOPOLOGY:</span>
              <div className="flex items-center gap-1">
                {STUDIO_FILTERS.map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() =>
                      onUpdateBeatVoice(selectedVoice, (p) => ({
                        ...p,
                        filter: { ...p.filter, type: ft },
                      }))
                    }
                    className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                      vCfg.filter.type === ft
                        ? 'bg-sky-400 text-black font-bold'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {ft}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1 place-items-center">
              <RotaryKnob
                label="CUTOFF"
                size="sm"
                value={vCfg.filter.cutoff}
                min={40}
                max={18000}
                step={15}
                defaultValue={1800}
                accentColor="#38BDF8"
                formatValue={(v) => `${Math.round(v)}Hz`}
                onChange={(cutoff) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    cutoff,
                    filter: { ...p.filter, cutoff },
                  }))
                }
              />
              <RotaryKnob
                label="RESO"
                size="sm"
                value={vCfg.filter.resonance}
                min={0.5}
                max={18}
                step={0.1}
                defaultValue={2.5}
                accentColor="#38BDF8"
                formatValue={(v) => `${v.toFixed(1)}Q`}
                onChange={(resonance) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    res: resonance,
                    filter: { ...p.filter, resonance },
                  }))
                }
              />
              <RotaryKnob
                label="DRIVE"
                size="sm"
                value={vCfg.filter.drive}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.28}
                accentColor="#F43F5E"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(drive) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    drive,
                    filter: { ...p.filter, drive },
                  }))
                }
              />
              <RotaryKnob
                label="ENV AMT"
                size="sm"
                value={vCfg.filter.envDepth}
                min={-1}
                max={1}
                step={0.01}
                defaultValue={0.45}
                bipolar
                accentColor="#F59E0B"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(envDepth) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    filtEnv: Math.round(envDepth * 3500),
                    filter: { ...p.filter, envDepth },
                  }))
                }
              />
              <RotaryKnob
                label="F-DECAY"
                size="sm"
                value={vCfg.filterEnv.decay}
                min={0.02}
                max={1.5}
                step={0.01}
                defaultValue={0.3}
                accentColor="#34D399"
                formatValue={(v) => `${Math.round(v * 1000)}ms`}
                onChange={(decay) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    filterEnv: { ...p.filterEnv, decay },
                  }))
                }
              />
              <RotaryKnob
                label="BASE HZ"
                size="sm"
                value={vCfg.freq}
                min={28}
                max={900}
                step={1}
                defaultValue={selectedTrackMeta.defaultFreq}
                accentColor={selectedTrackMeta.color}
                formatValue={(v) => `${Math.round(v)}Hz`}
                onChange={(freq) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({ ...p, freq }))
                }
              />
            </div>
          </div>
        )}

        {/* Sub-Tab 4: ADSR Envelope + Unison / Glide Voice Architecture */}
        {synthSubTab === 'env' && (
          <div className="space-y-1.5 py-1 bg-black/30 rounded-lg border border-white/5 px-2">
            <div className="flex items-center justify-between font-studio-mono text-[9px]">
              <span className="text-gray-400">VOICE TOPOLOGY:</span>
              <div className="flex items-center gap-1">
                {STUDIO_VOICE_MODES.map((vm) => (
                  <button
                    key={vm}
                    type="button"
                    onClick={() =>
                      onUpdateBeatVoice(selectedVoice, (p) => ({
                        ...p,
                        voice: { ...p.voice, mode: vm },
                      }))
                    }
                    className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                      vCfg.voice.mode === vm
                        ? 'bg-amber-400 text-black font-bold'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {vm}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1 place-items-center">
              <RotaryKnob
                label="ATTACK"
                size="sm"
                value={vCfg.ampEnv.attack}
                min={0.001}
                max={0.5}
                step={0.005}
                defaultValue={0.003}
                accentColor="#34D399"
                formatValue={(v) => `${Math.round(v * 1000)}ms`}
                onChange={(attack) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    attack,
                    ampEnv: { ...p.ampEnv, attack },
                  }))
                }
              />
              <RotaryKnob
                label="DECAY"
                size="sm"
                value={vCfg.ampEnv.decay}
                min={0.02}
                max={1.5}
                step={0.01}
                defaultValue={0.35}
                accentColor="#34D399"
                formatValue={(v) => `${Math.round(v * 1000)}ms`}
                onChange={(decay) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    decay,
                    ampEnv: { ...p.ampEnv, decay },
                  }))
                }
              />
              <RotaryKnob
                label="SUSTAIN"
                size="sm"
                value={vCfg.ampEnv.sustain}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.65}
                accentColor="#34D399"
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={(sustain) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    sustain,
                    ampEnv: { ...p.ampEnv, sustain },
                  }))
                }
              />
              <RotaryKnob
                label="RELEASE"
                size="sm"
                value={vCfg.ampEnv.release}
                min={0.02}
                max={2.0}
                step={0.01}
                defaultValue={0.2}
                accentColor="#34D399"
                formatValue={(v) => `${Math.round(v * 1000)}ms`}
                onChange={(release) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    release,
                    ampEnv: { ...p.ampEnv, release },
                  }))
                }
              />
              <RotaryKnob
                label="GLIDE"
                size="sm"
                value={vCfg.voice.glideTime}
                min={0}
                max={400}
                step={5}
                defaultValue={35}
                accentColor="#38BDF8"
                formatValue={(v) => `${Math.round(v)}ms`}
                onChange={(glideTime) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    voice: { ...p.voice, glideTime },
                  }))
                }
              />
              <RotaryKnob
                label="UNISON"
                size="sm"
                value={vCfg.voice.unisonDetune}
                min={0}
                max={65}
                step={1}
                defaultValue={14}
                accentColor="#A855F7"
                formatValue={(v) => `${Math.round(v)}ct`}
                onChange={(unisonDetune) =>
                  onUpdateBeatVoice(selectedVoice, (p) => ({
                    ...p,
                    voice: { ...p.voice, unisonDetune },
                  }))
                }
              />
            </div>
          </div>
        )}

        {/* Module 02 Patch Bay: 8 Trigger Ins + 2 CV Ins + 8 Dedicated Track Audio Outs + Mix Out + Env CV */}
        <div className="pt-1.5 mt-1 border-t border-white/10 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            {AETHER_TRACK_META.map((m) => (
              <PatchJackButton
                key={m.trigInId}
                jackId={m.trigInId}
                label={`T${m.index + 1} IN`}
                direction="in"
                domain="trig"
                cables={patch.cables}
                activeFromJack={activeFromJack}
                onSelectJack={onSelectJack}
                onRemoveJackCables={onRemoveJackCables}
                onRemoveSingleCable={onRemoveSingleCable}
                onStartDaisyChain={onStartDaisyChain}
              />
            ))}
            <PatchJackButton
              jackId="beats:ptchCv"
              label="PTCH CV"
              direction="in"
              domain="cv"
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
            <PatchJackButton
              jackId="beats:filtCv"
              label="FILT CV"
              direction="in"
              domain="cv"
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1">
            {AETHER_TRACK_META.map((m) => (
              <PatchJackButton
                key={m.audioOutId}
                jackId={m.audioOutId}
                label={`T${m.index + 1} OUT`}
                direction="out"
                domain="audio"
                cables={patch.cables}
                activeFromJack={activeFromJack}
                onSelectJack={onSelectJack}
                onRemoveJackCables={onRemoveJackCables}
                onRemoveSingleCable={onRemoveSingleCable}
                onStartDaisyChain={onStartDaisyChain}
              />
            ))}
            <PatchJackButton
              jackId="beats:mixOut"
              label="MIX OUT"
              direction="out"
              domain="audio"
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
            <PatchJackButton
              jackId="beats:envOut"
              label="ENV CV"
              direction="out"
              domain="cv"
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
