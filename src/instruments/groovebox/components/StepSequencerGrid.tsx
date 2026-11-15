import React, { useRef, useState } from 'react';
import {
  computeEuclideanSteps,
  midiToNoteName,
} from '../presets/factoryPresets';
import type {
  GrooveboxProject,
  RatchetCurve,
  StepData,
  TrigCondition,
} from '../types';

export interface StepSequencerGridProps {
  project: GrooveboxProject;
  focusedTrackIndex: number;
  visibleBar: number; // 0..3
  autoFollowBar: boolean;
  currentGlobalStep: number;
  isPlaying: boolean;
  pLockLatch: boolean;
  selectedStep: { trackIndex: number; stepIndex: number } | null;
  onSelectTrack: (trackIndex: number) => void;
  onSelectBar: (barIndex: number) => void;
  onToggleAutoFollow: () => void;
  onSetPatternBars: (bars: 1 | 2 | 3 | 4) => void;
  onToggleStep: (
    trackIndex: number,
    stepIndex: number,
    forceState?: boolean
  ) => void;
  onSelectPLockStep: (trackIndex: number, stepIndex: number) => void;
  onUpdateStepData: (
    trackIndex: number,
    stepIndex: number,
    updater: (prev: StepData) => StepData
  ) => void;
  onSetTrackLength: (trackIndex: number, lengthSteps: number) => void;
  onApplyEuclidean: (
    trackIndex: number,
    steps: number,
    pulses: number,
    rotation: number
  ) => void;
  onToggleMute: (trackIndex: number) => void;
  onToggleSolo: (trackIndex: number) => void;
  onTrackVolumeChange: (trackIndex: number, volume: number) => void;
  onAnswerMeCoPlay: (trackIndex: number) => void;
  onDuplicateBar1ToAll: () => void;
  onClearTrackSteps: (trackIndex: number) => void;
}

const CONDITIONS: TrigCondition[] = [
  'ALWAYS',
  '1:2',
  '2:2',
  '1:4',
  '2:4',
  '3:4',
  '4:4',
  'FILL',
  'PRE',
  '!PRE',
];

const RATCHET_VALUES: (1 | 2 | 3 | 4 | 6)[] = [1, 2, 3, 4, 6];
const RATCHET_CURVES: RatchetCurve[] = [
  'flat',
  'fade-out',
  'swell',
  'bouncing-ball',
];

export const StepSequencerGrid: React.FC<StepSequencerGridProps> = ({
  project,
  focusedTrackIndex,
  visibleBar,
  autoFollowBar,
  currentGlobalStep,
  isPlaying,
  pLockLatch,
  selectedStep,
  onSelectTrack,
  onSelectBar,
  onToggleAutoFollow,
  onSetPatternBars,
  onToggleStep,
  onSelectPLockStep,
  onUpdateStepData,
  onSetTrackLength,
  onApplyEuclidean,
  onToggleMute,
  onToggleSolo,
  onTrackVolumeChange,
  onAnswerMeCoPlay,
  onDuplicateBar1ToAll,
  onClearTrackSteps,
}) => {
  const [euclidOpen, setEuclidOpen] = useState(false);
  const [euclidPulses, setEuclidPulses] = useState(5);
  const [euclidRotation, setEuclidRotation] = useState(0);

  // First-Cell Intent Lock Swipe State
  const swipePaintIntentRef = useRef<boolean | null>(null);

  const activePattern =
    project.patterns[project.activePatternId] ??
    Object.values(project.patterns)[0];
  const barOffset = visibleBar * 16;
  const isPro = project.mode === 'pro';

  const focusedSeq = activePattern.tracks[focusedTrackIndex];
  const focusedTrack = project.tracks[focusedTrackIndex];

  const inspectedStepPos = selectedStep ?? {
    trackIndex: focusedTrackIndex,
    stepIndex: barOffset,
  };
  const inspectedStepData =
    activePattern.tracks[inspectedStepPos.trackIndex]?.steps[
      inspectedStepPos.stepIndex
    ];

  return (
    <section className="flex flex-col h-full bg-[#0E1015] border-b border-white/10 px-2.5 py-1.5 select-none overflow-hidden">
      {/* Top Sequencer Utility Strip */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/[0.07] shrink-0">
        {/* Left: Active Pattern Loop Bars ([1B]..[4B]) & Bar Page Tabs ([BAR 1]..[BAR 4]) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10">
            <span className="text-[9px] font-studio-mono text-gray-400 px-1.5">
              LEN:
            </span>
            {([1, 2, 3, 4] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onSetPatternBars(b)}
                className={`px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold transition-colors cursor-pointer ${
                  activePattern.bars === b
                    ? 'bg-rose-500 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {b}B
              </button>
            ))}
          </div>

          <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10">
            {Array.from({ length: activePattern.bars }, (_, bIdx) => (
              <button
                key={bIdx}
                type="button"
                onClick={() => onSelectBar(bIdx)}
                className={`px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold transition-colors cursor-pointer ${
                  visibleBar === bIdx
                    ? 'bg-white/20 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                BAR {bIdx + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={onToggleAutoFollow}
              className={`ml-1 px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer ${
                autoFollowBar
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              FOLLOW
            </button>
          </div>

          <button
            type="button"
            onClick={onDuplicateBar1ToAll}
            className="hidden lg:inline-flex px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-studio-mono text-[10px] text-gray-300 cursor-pointer"
            title="Duplicate Bar 1 steps across Bars 2-4"
          >
            COPY B1→ALL
          </button>
        </div>

        {/* Center/Right: Polymeter Step Length, Answer Me Co-Play & Euclidean Generator */}
        <div className="flex items-center gap-2">
          {!focusedTrack.isDrum && (
            <button
              type="button"
              onClick={() => onAnswerMeCoPlay(focusedTrackIndex)}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-500/25 to-fuchsia-500/25 hover:from-violet-500/40 hover:to-fuchsia-500/40 border border-violet-400/40 font-studio-mono text-[10px] font-bold text-violet-200 cursor-pointer"
              title="Analyze Bar 1 Call melody and generate a resolved Bar 2 Response melody"
            >
              🪄 ANSWER ME ({focusedTrack.name})
            </button>
          )}

          {isPro && focusedSeq && (
            <div className="hidden sm:flex items-center gap-1.5 bg-black/45 px-2 py-0.5 rounded-lg border border-white/10 font-studio-mono text-[10px]">
              <span style={{ color: focusedTrack.color }} className="font-bold">
                {focusedTrack.name} STEPS:
              </span>
              <input
                type="number"
                min={4}
                max={64}
                value={focusedSeq.lengthSteps}
                onChange={(e) =>
                  onSetTrackLength(
                    focusedTrackIndex,
                    Math.min(64, Math.max(4, Number(e.target.value) || 16))
                  )
                }
                className="w-10 bg-black/60 text-white text-center rounded border border-white/10 py-0.5"
              />
            </div>
          )}

          {/* Euclidean Generator Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setEuclidOpen((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 font-studio-mono text-[10px] font-bold text-sky-300 cursor-pointer"
            >
              ◎ EUCLIDEAN
            </button>

            {euclidOpen && focusedSeq && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-white/15 bg-[#151821] p-3 shadow-2xl z-50 space-y-2">
                <div className="flex items-center justify-between font-studio-mono text-[10px]">
                  <span
                    className="font-bold"
                    style={{ color: focusedTrack.color }}
                  >
                    EUCLIDEAN // {focusedTrack.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEuclidOpen(false)}
                    className="text-gray-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5 font-studio-mono text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">PULSES (HITS)</span>
                    <span className="text-sky-300 font-bold">{euclidPulses}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={16}
                    value={euclidPulses}
                    onChange={(e) => setEuclidPulses(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />

                  <div className="flex justify-between">
                    <span className="text-gray-400">ROTATION</span>
                    <span className="text-sky-300 font-bold">
                      {euclidRotation}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={15}
                    value={euclidRotation}
                    onChange={(e) => setEuclidRotation(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>

                {/* Live Mini Preview Dots */}
                <div className="flex items-center justify-between gap-0.5 py-1">
                  {computeEuclideanSteps(16, euclidPulses, euclidRotation).map(
                    (hit, idx) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: hit
                            ? focusedTrack.color
                            : 'rgba(255,255,255,0.1)',
                        }}
                        className="w-2.5 h-2.5 rounded-full"
                      />
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onApplyEuclidean(
                      focusedTrackIndex,
                      16,
                      euclidPulses,
                      euclidRotation
                    );
                    setEuclidOpen(false);
                  }}
                  style={{ backgroundColor: focusedTrack.color }}
                  className="w-full py-1.5 rounded-lg font-studio-mono text-xs font-bold text-black cursor-pointer"
                >
                  APPLY TO {focusedTrack.name}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Beat Ruler Row */}
      <div className="grid grid-cols-[190px_1fr] sm:grid-cols-[230px_1fr] gap-2 items-center pt-1 pb-0.5 text-[9px] font-studio-mono text-gray-500 shrink-0">
        <div className="px-2 uppercase tracking-wider flex items-center justify-between">
          <span>8-TRACK MATRIX</span>
          <span>M / S / VOL</span>
        </div>
        <div className="grid grid-cols-16 gap-1">
          {Array.from({ length: 16 }, (_, i) => {
            const absStep = barOffset + i;
            const isBeatAnchor = i % 4 === 0;
            const isPlayhead = isPlaying && currentGlobalStep === absStep;
            return (
              <div
                key={i}
                className={`text-center rounded-xs py-0.2 ${
                  isPlayhead
                    ? 'bg-rose-500 text-black font-bold'
                    : isBeatAnchor
                      ? 'text-gray-200 font-bold'
                      : 'text-gray-600'
                }`}
              >
                {isBeatAnchor ? `${visibleBar * 4 + i / 4 + 1}` : '·'}
              </div>
            );
          })}
        </div>
      </div>

      {/* 8 Horizontal Track Sequencer Rows */}
      <div
        className="flex-1 min-h-0 flex flex-col justify-between gap-1 overflow-y-auto py-0.5"
        onPointerUp={() => {
          swipePaintIntentRef.current = null;
        }}
        onPointerLeave={() => {
          swipePaintIntentRef.current = null;
        }}
      >
        {project.tracks.map((trk) => {
          const seq = activePattern.tracks[trk.index];
          const isFocused = focusedTrackIndex === trk.index;

          return (
            <div
              key={trk.index}
              className={`grid grid-cols-[190px_1fr] sm:grid-cols-[230px_1fr] gap-2 items-center rounded-lg px-1.5 py-0.5 transition-colors border ${
                isFocused
                  ? 'bg-[#171B26] border-white/15'
                  : 'bg-[#12151E]/80 border-transparent hover:border-white/5'
              }`}
            >
              {/* Left Inline Track Header */}
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectTrack(trk.index)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      backgroundColor: isFocused
                        ? trk.color
                        : `${trk.color}25`,
                      color: isFocused ? '#000' : trk.color,
                    }}
                  >
                    {trk.icon}
                  </span>
                  <span
                    className="font-studio-mono text-[11px] font-bold truncate"
                    style={{ color: isFocused ? '#FFF' : trk.color }}
                  >
                    {trk.index + 1}.{trk.name}
                  </span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleMute(trk.index)}
                    className={`w-5 h-5 rounded font-studio-mono text-[9px] font-bold cursor-pointer ${
                      trk.mixer.mute
                        ? 'bg-rose-500 text-black'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                    title="Mute Track (Shortcut: M)"
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSolo(trk.index)}
                    className={`w-5 h-5 rounded font-studio-mono text-[9px] font-bold cursor-pointer ${
                      trk.mixer.solo
                        ? 'bg-amber-400 text-black'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                    title="Solo Track (Shortcut: S)"
                  >
                    S
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={trk.mixer.volume}
                    onChange={(e) =>
                      onTrackVolumeChange(trk.index, Number(e.target.value))
                    }
                    style={{ accentColor: trk.color }}
                    className="hidden sm:block w-12 cursor-pointer"
                    title={`${trk.name} Volume`}
                  />
                  {!project.safeLockEnabled && (
                    <button
                      type="button"
                      onClick={() => onClearTrackSteps(trk.index)}
                      title={`Clear ${trk.name} steps`}
                      className="w-4 h-5 rounded text-[9px] text-gray-500 hover:text-rose-400 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Right 16-Step Grid Row */}
              <div className="grid grid-cols-16 gap-1 h-7">
                {Array.from({ length: 16 }, (_, cellIdx) => {
                  const stepIdx = (barOffset + cellIdx) % (seq?.lengthSteps || 16);
                  const step = seq?.steps[stepIdx];
                  const active = Boolean(step?.active);
                  const isPlayhead =
                    isPlaying &&
                    currentGlobalStep % (seq?.lengthSteps || 16) === stepIdx &&
                    Math.floor(currentGlobalStep / 16) === visibleBar;
                  const isPLockSelected =
                    selectedStep?.trackIndex === trk.index &&
                    selectedStep?.stepIndex === stepIdx;
                  const hasPLocks =
                    step && Object.keys(step.pLocks).length > 0;
                  const durationSteps = step?.notes[0]?.durationSteps ?? 1;

                  return (
                    <button
                      key={cellIdx}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        onSelectTrack(trk.index);
                        if (pLockLatch || e.altKey) {
                          onSelectPLockStep(trk.index, stepIdx);
                          return;
                        }
                        const targetState = !active;
                        swipePaintIntentRef.current = targetState;
                        onToggleStep(trk.index, stepIdx, targetState);
                        onSelectPLockStep(trk.index, stepIdx);
                      }}
                      onPointerEnter={() => {
                        if (swipePaintIntentRef.current !== null && !pLockLatch) {
                          onToggleStep(
                            trk.index,
                            stepIdx,
                            swipePaintIntentRef.current
                          );
                        }
                      }}
                      style={{
                        backgroundColor: active
                          ? trk.color
                          : cellIdx % 4 === 0
                            ? 'rgba(255,255,255,0.09)'
                            : 'rgba(255,255,255,0.04)',
                        boxShadow: isPlayhead
                          ? `0 0 10px #FFFFFF`
                          : active
                            ? `0 0 8px ${trk.color}66`
                            : 'none',
                        borderColor: isPLockSelected
                          ? '#FBBF24'
                          : isPlayhead
                            ? '#FFFFFF'
                            : 'rgba(255,255,255,0.08)',
                      }}
                      className={`relative rounded transition-all flex items-center justify-center border cursor-pointer touch-none-control ${
                        isPLockSelected ? 'ring-2 ring-amber-400' : ''
                      }`}
                    >
                      {/* Note Name or Extendable Multi-Step Tie Badge */}
                      {active && !trk.isDrum && step?.notes[0] && (
                        <span className="font-studio-mono text-[8px] font-bold text-black leading-none truncate">
                          {midiToNoteName(step.notes[0].midiNote)}
                          {durationSteps > 1 ? `═${durationSteps}` : ''}
                        </span>
                      )}

                      {/* Ratchet or Condition micro badge */}
                      {active && step && (step.ratchet > 1 || step.condition !== 'ALWAYS') && (
                        <span className="absolute top-0 right-0.5 text-[7px] font-studio-mono font-bold text-black/80">
                          {step.ratchet > 1 ? `×${step.ratchet}` : step.condition}
                        </span>
                      )}

                      {/* Parameter Lock Ghost Dot */}
                      {hasPLocks && (
                        <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-amber-300 border border-black" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pro Step Inspector Footer (Extendable Gate Length, Ratchets, Probability & Conditions) */}
      {isPro && inspectedStepData && (
        <div className="pt-1 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-studio-mono text-gray-300 shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
              STEP INSPECTOR: TRK {inspectedStepPos.trackIndex + 1} • STEP{' '}
              {inspectedStepPos.stepIndex + 1}
            </span>

            {/* Extendable Gate Duration (1..8 steps) */}
            <label className="flex items-center gap-1">
              <span className="text-gray-400">TIE LEN:</span>
              <select
                value={inspectedStepData.notes[0]?.durationSteps ?? 1}
                onChange={(e) => {
                  const dur = Number(e.target.value);
                  onUpdateStepData(
                    inspectedStepPos.trackIndex,
                    inspectedStepPos.stepIndex,
                    (prev) => ({
                      ...prev,
                      active: true,
                      notes: prev.notes.map((n) => ({
                        ...n,
                        durationSteps: dur,
                      })),
                    })
                  );
                }}
                className="bg-black/60 rounded border border-white/15 px-1 py-0.5 text-white cursor-pointer"
              >
                {[1, 2, 3, 4, 6, 8, 16].map((d) => (
                  <option key={d} value={d} className="bg-[#12151E]">
                    {d} {d === 1 ? 'Step' : 'Steps [●══]'}
                  </option>
                ))}
              </select>
            </label>

            {/* Ratchet Subdivisions */}
            <label className="flex items-center gap-1">
              <span className="text-gray-400">RATCHET:</span>
              <select
                value={inspectedStepData.ratchet}
                onChange={(e) => {
                  const r = Number(e.target.value) as 1 | 2 | 3 | 4 | 6;
                  onUpdateStepData(
                    inspectedStepPos.trackIndex,
                    inspectedStepPos.stepIndex,
                    (prev) => ({ ...prev, ratchet: r })
                  );
                }}
                className="bg-black/60 rounded border border-white/15 px-1 py-0.5 text-white cursor-pointer"
              >
                {RATCHET_VALUES.map((r) => (
                  <option key={r} value={r} className="bg-[#12151E]">
                    ×{r}
                  </option>
                ))}
              </select>
            </label>

            {/* Ratchet Curve */}
            <select
              aria-label="Ratchet Curve"
              value={inspectedStepData.ratchetCurve}
              onChange={(e) => {
                const curve = e.target.value as RatchetCurve;
                onUpdateStepData(
                  inspectedStepPos.trackIndex,
                  inspectedStepPos.stepIndex,
                  (prev) => ({ ...prev, ratchetCurve: curve })
                );
              }}
              className="bg-black/60 rounded border border-white/15 px-1 py-0.5 text-white cursor-pointer"
            >
              {RATCHET_CURVES.map((c) => (
                <option key={c} value={c} className="bg-[#12151E]">
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Trigger Probability */}
            <label className="flex items-center gap-1">
              <span className="text-gray-400">PROB:</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={inspectedStepData.probability}
                onChange={(e) => {
                  const prob = Number(e.target.value);
                  onUpdateStepData(
                    inspectedStepPos.trackIndex,
                    inspectedStepPos.stepIndex,
                    (prev) => ({ ...prev, probability: prob })
                  );
                }}
                className="w-16 accent-amber-400 cursor-pointer"
              />
              <span className="w-8 text-amber-300 font-bold">
                {Math.round(inspectedStepData.probability * 100)}%
              </span>
            </label>

            {/* Elektron Trig Condition */}
            <label className="flex items-center gap-1">
              <span className="text-gray-400">COND:</span>
              <select
                value={inspectedStepData.condition}
                onChange={(e) => {
                  const cond = e.target.value as TrigCondition;
                  onUpdateStepData(
                    inspectedStepPos.trackIndex,
                    inspectedStepPos.stepIndex,
                    (prev) => ({ ...prev, condition: cond })
                  );
                }}
                className="bg-black/60 rounded border border-white/15 px-1 py-0.5 text-sky-300 font-bold cursor-pointer"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c} className="bg-[#12151E]">
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  );
};
