import React, { useEffect, useRef, useState } from 'react';
import {
  getNoteGravity,
  getScaleNotes,
  midiToNoteName,
} from '../../presets/factoryPresets';
import type { GrooveboxProject, StepData, TrackConfig } from '../../types';

export interface PianoRollSongTabProps {
  project: GrooveboxProject;
  focusedTrack: TrackConfig;
  visibleBar: number;
  currentGlobalStep: number;
  isPlaying: boolean;
  dragExtendMode: boolean;
  onToggleDragExtendMode: () => void;
  onUpdateStepData: (
    trackIndex: number,
    stepIndex: number,
    updater: (prev: StepData) => StepData
  ) => void;
  onAnswerMeCoPlay: (trackIndex: number) => void;
  onApplyVelocityTool: (
    tool: 'accent' | 'up' | 'down' | 'alternate' | 'humanize'
  ) => void;
  onSelectPatternFromSong: (patternId: string) => void;
  onExportMasterWav: () => void;
  onExportStemsWav: () => void;
  onExportMidi: () => void;
}

export const PianoRollSongTab: React.FC<PianoRollSongTabProps> = ({
  project,
  focusedTrack,
  visibleBar,
  currentGlobalStep,
  isPlaying,
  dragExtendMode,
  onToggleDragExtendMode,
  onUpdateStepData,
  onAnswerMeCoPlay,
  onApplyVelocityTool,
  onSelectPatternFromSong,
  onExportMasterWav,
  onExportStemsWav,
  onExportMidi,
}) => {
  const activePattern =
    project.patterns[project.activePatternId] ??
    Object.values(project.patterns)[0];
  const seq = activePattern.tracks[focusedTrack.index];
  const barOffset = visibleBar * 16;

  // Piano Roll Drag-Extend Tie & Paint State
  const dragTieOriginRef = useRef<{
    stepIdx: number;
    midi: number;
  } | null>(null);
  const paintNoteIntentRef = useRef<boolean | null>(null);

  // Velocity Bar Drag & Fine Control State
  const velDragRef = useRef<{
    stepIdx: number;
    lastY: number;
    accumVel: number;
  } | null>(null);
  const [activeVelStep, setActiveVelStep] = useState<number | null>(null);
  const [velFineMode, setVelFineMode] = useState<boolean>(false);
  const [focusedOctaveShift, setFocusedOctaveShift] = useState<-1 | 0 | 1>(0);
  const pianoRollScrollRef = useRef<HTMLDivElement | null>(null);
  const normalOctaveTopRowRef = useRef<HTMLDivElement | null>(null);

  // 3-Octave Folded Scale Grid (Low Octave, Normal Octave, High Octave — 22 in-key pitches from high to low)
  const normalBaseOctave = focusedTrack.index === 4 ? 2 : 4;
  const lowBaseOctave = Math.max(1, normalBaseOctave - 1);
  const scalePitches = getScaleNotes(
    project.rootNote,
    project.scaleName,
    lowBaseOctave,
    22
  ).reverse();

  // Normal scale pitches (middle octave) for visual highlighting & initial focus
  const normalScaleSet = new Set(
    getScaleNotes(project.rootNote, project.scaleName, normalBaseOctave, 8)
  );

  const scrollToOctaveZone = (shift: -1 | 0 | 1) => {
    setFocusedOctaveShift(shift);
    const container = pianoRollScrollRef.current;
    if (!container) return;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    if (shift === 1) {
      container.scrollTop = 0;
    } else if (shift === -1) {
      container.scrollTop = maxScroll;
    } else {
      // Center on the Normal Scale (middle octave, rows 7..14 of 22)
      if (normalOctaveTopRowRef.current) {
        container.scrollTop = Math.max(
          0,
          normalOctaveTopRowRef.current.offsetTop - 4
        );
      } else {
        container.scrollTop = Math.round(maxScroll * 0.5);
      }
    }
  };

  // Always start focused on the Normal Scale octave when opening Piano Roll or switching tracks
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollToOctaveZone(0);
    });
    return () => cancelAnimationFrame(raf);
  }, [focusedTrack.index, project.rootNote, project.scaleName]);

  const applyStepVelocity = (stepIdx: number, nextVel: number) => {
    const clamped = Number(Math.max(0.05, Math.min(1, nextVel)).toFixed(4));
    onUpdateStepData(focusedTrack.index, stepIdx, (prev) => ({
      ...prev,
      active: true,
      velocity: clamped,
      notes: prev.notes.map((n) => ({
        ...n,
        velocity: clamped,
      })),
    }));
  };

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-y-auto"
      onPointerUp={() => {
        dragTieOriginRef.current = null;
        paintNoteIntentRef.current = null;
      }}
      onPointerLeave={() => {
        dragTieOriginRef.current = null;
        paintNoteIntentRef.current = null;
      }}
    >
      {/* Left: Folded Scale Piano Roll + Docked Visual Velocity Lane */}
      <div className="studio-module-synth lg:col-span-8 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className="px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold text-black"
              style={{ backgroundColor: focusedTrack.color }}
            >
              FOLDED SCALE PIANO ROLL // {focusedTrack.name}
            </span>
            <button
              type="button"
              onClick={onToggleDragExtendMode}
              className={`px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold border transition-colors cursor-pointer ${
                dragExtendMode
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
              }`}
              title="Synced with Sequencer DRAG button: Toggle between dragging multi-step sustaining note ties vs painting 1-step notes"
            >
              {dragExtendMode
                ? '↔ DRAG: EXTEND TIE'
                : '✏️ DRAG: PAINT STEPS'}
            </button>
            <button
              type="button"
              onClick={() => onAnswerMeCoPlay(focusedTrack.index)}
              className="px-2 py-0.5 rounded bg-violet-500/25 hover:bg-violet-500/40 text-violet-200 border border-violet-400/40 font-studio-mono text-[10px] font-bold cursor-pointer"
            >
              🪄 ANSWER ME
            </button>

            {/* 3-Octave Range Quick Focus Switcher (Always starts focused on Normal Scale) */}
            <div className="flex items-center gap-0.5 bg-black/50 p-0.5 rounded border border-white/10 font-studio-mono text-[9px]">
              <button
                type="button"
                onClick={() => scrollToOctaveZone(1)}
                title="Scroll to High Octave (+1 Oct)"
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  focusedOctaveShift === 1
                    ? 'bg-sky-400 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ▲ +1 OCT
              </button>
              <button
                type="button"
                onClick={() => scrollToOctaveZone(0)}
                title="Focus Normal Scale Octave (Default)"
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  focusedOctaveShift === 0
                    ? 'bg-emerald-400 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ● NORMAL (OCT {normalBaseOctave})
              </button>
              <button
                type="button"
                onClick={() => scrollToOctaveZone(-1)}
                title="Scroll to Low Octave (-1 Oct)"
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  focusedOctaveShift === -1
                    ? 'bg-sky-400 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ▼ -1 OCT
              </button>
            </div>
          </div>

          {/* One-Tap Velocity Sculpting Tools */}
          <div className="flex items-center gap-1 font-studio-mono text-[9px]">
            <button
              type="button"
              onClick={() => onApplyVelocityTool('accent')}
              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300 cursor-pointer"
            >
              ACCENT 1/4
            </button>
            <button
              type="button"
              onClick={() => onApplyVelocityTool('up')}
              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300 cursor-pointer"
            >
              ↗ UP
            </button>
            <button
              type="button"
              onClick={() => onApplyVelocityTool('down')}
              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300 cursor-pointer"
            >
              ↘ DOWN
            </button>
            <button
              type="button"
              onClick={() => onApplyVelocityTool('humanize')}
              className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 cursor-pointer"
            >
              HUMANIZE
            </button>
          </div>
        </div>

        {/* 3-Octave Folded Scale Grid (Scrollable, auto-focused on Normal Scale octave) */}
        <div
          ref={pianoRollScrollRef}
          className="flex-1 min-h-[148px] max-h-[220px] overflow-y-auto flex flex-col gap-0.5 my-1 pr-1 relative"
        >
          {scalePitches.map((midi, rowIdx) => {
            const gravity = getNoteGravity(midi, project.rootNote);
            const isNormalOctave = normalScaleSet.has(midi);
            const isTopOfNormalOctave = rowIdx === 7;
            return (
              <div
                key={midi}
                ref={isTopOfNormalOctave ? normalOctaveTopRowRef : undefined}
                className={`grid grid-cols-[62px_1fr] gap-1 items-center h-[18px] shrink-0 ${
                  isNormalOctave ? 'bg-white/[0.02]' : 'opacity-85'
                }`}
              >
                <span
                  className={`font-studio-mono text-[9px] font-bold px-1 rounded truncate flex items-center justify-between ${
                    gravity === 'home'
                      ? 'text-emerald-300 bg-emerald-500/15'
                      : gravity === 'color'
                        ? 'text-sky-300 bg-sky-500/15'
                        : 'text-gray-400 bg-white/5'
                  } ${isNormalOctave ? 'border-l-2 border-emerald-400' : ''}`}
                >
                  <span>{midiToNoteName(midi)}</span>
                  {isNormalOctave && gravity === 'home' && (
                    <span className="text-[7px] text-emerald-300">★</span>
                  )}
                </span>

                <div className="grid grid-cols-16 gap-0.5 h-full">
                  {Array.from({ length: 16 }, (_, cIdx) => {
                    const patBars = Math.max(1, activePattern?.bars || 1);
                    const polyLen =
                      !seq?.lengthSteps || seq.lengthSteps === 16
                        ? patBars * 16
                        : seq.lengthSteps;
                    const stepIdx = (barOffset + cIdx) % polyLen;
                    const step = seq?.steps[stepIdx];
                    const hasNote =
                      Boolean(step?.active) &&
                      Boolean(step?.notes.some((n) => n.midiNote === midi));

                    // Check if covered by an earlier active step's multi-beat tie on this pitch row
                    let tieSourceStepIdx: number | null = null;
                    let isTieEnd = false;
                    if (!hasNote && seq) {
                      for (
                        let prevIdx = stepIdx - 1;
                        prevIdx >= Math.max(0, stepIdx - 15);
                        prevIdx--
                      ) {
                        const prevStep = seq.steps[prevIdx];
                        if (prevStep?.active) {
                          const matchingNote = prevStep.notes.find(
                            (n) => n.midiNote === midi
                          );
                          if (matchingNote) {
                            const dur = matchingNote.durationSteps || 1;
                            if (prevIdx + dur > stepIdx) {
                              tieSourceStepIdx = prevIdx;
                              isTieEnd = prevIdx + dur - 1 === stepIdx;
                            }
                          }
                          break;
                        }
                      }
                    }

                    const isTiedContinuation = tieSourceStepIdx !== null;
                    const noteDuration =
                      step?.notes.find((n) => n.midiNote === midi)
                        ?.durationSteps ?? 1;
                    const isPlayhead =
                      isPlaying && currentGlobalStep % polyLen === stepIdx;

                    return (
                      <button
                        key={cIdx}
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();

                          // Shift+Click extends the nearest preceding active note on this row up to this step
                          if (e.shiftKey && seq) {
                            for (let pIdx = stepIdx - 1; pIdx >= 0; pIdx--) {
                              const pStep = seq.steps[pIdx];
                              if (
                                pStep?.active &&
                                pStep.notes.some((n) => n.midiNote === midi)
                              ) {
                                const newDur = Math.min(
                                  16,
                                  stepIdx - pIdx + 1
                                );
                                onUpdateStepData(
                                  focusedTrack.index,
                                  pIdx,
                                  (prev) => ({
                                    ...prev,
                                    active: true,
                                    notes: prev.notes.map((n) => ({
                                      ...n,
                                      durationSteps: newDur,
                                    })),
                                  })
                                );
                                return;
                              }
                            }
                          }

                          // Clicking a tied continuation cell truncates the tie length
                          if (tieSourceStepIdx !== null) {
                            const srcIdx = tieSourceStepIdx;
                            onUpdateStepData(
                              focusedTrack.index,
                              srcIdx,
                              (prev) => ({
                                ...prev,
                                notes: prev.notes.map((n) => ({
                                  ...n,
                                  durationSteps: Math.max(1, stepIdx - srcIdx),
                                })),
                              })
                            );
                            return;
                          }

                          const nextActive = !hasNote;
                          if (dragExtendMode) {
                            if (nextActive) {
                              onUpdateStepData(
                                focusedTrack.index,
                                stepIdx,
                                (prev) => ({
                                  ...prev,
                                  active: true,
                                  notes: [
                                    {
                                      midiNote: midi,
                                      velocity: prev.velocity || 0.85,
                                      durationSteps: 1,
                                      glide: false,
                                    },
                                  ],
                                })
                              );
                              dragTieOriginRef.current = { stepIdx, midi };
                            } else {
                              onUpdateStepData(
                                focusedTrack.index,
                                stepIdx,
                                (prev) => ({
                                  ...prev,
                                  active: false,
                                  notes: prev.notes.map((n) => ({
                                    ...n,
                                    durationSteps: 1,
                                  })),
                                })
                              );
                              dragTieOriginRef.current = null;
                            }
                          } else {
                            paintNoteIntentRef.current = nextActive;
                            onUpdateStepData(
                              focusedTrack.index,
                              stepIdx,
                              (prev) => ({
                                ...prev,
                                active: nextActive,
                                notes: nextActive
                                  ? [
                                      {
                                        midiNote: midi,
                                        velocity: prev.velocity || 0.85,
                                        durationSteps: 1,
                                        glide: false,
                                      },
                                    ]
                                  : prev.notes,
                              })
                            );
                          }
                        }}
                        onPointerEnter={() => {
                          if (
                            dragExtendMode &&
                            dragTieOriginRef.current &&
                            dragTieOriginRef.current.midi === midi
                          ) {
                            const origIdx = dragTieOriginRef.current.stepIdx;
                            if (stepIdx >= origIdx) {
                              const newDur = Math.min(
                                16,
                                stepIdx - origIdx + 1
                              );
                              onUpdateStepData(
                                focusedTrack.index,
                                origIdx,
                                (prev) => ({
                                  ...prev,
                                  active: true,
                                  notes: prev.notes.map((n) => ({
                                    ...n,
                                    durationSteps: newDur,
                                  })),
                                })
                              );
                            }
                            return;
                          }

                          if (
                            !dragExtendMode &&
                            paintNoteIntentRef.current !== null
                          ) {
                            const shouldPaint = paintNoteIntentRef.current;
                            onUpdateStepData(
                              focusedTrack.index,
                              stepIdx,
                              (prev) => ({
                                ...prev,
                                active: shouldPaint,
                                notes: shouldPaint
                                  ? [
                                      {
                                        midiNote: midi,
                                        velocity: prev.velocity || 0.85,
                                        durationSteps: 1,
                                        glide: false,
                                      },
                                    ]
                                  : prev.notes,
                              })
                            );
                          }
                        }}
                        style={{
                          backgroundColor: hasNote
                            ? focusedTrack.color
                            : isTiedContinuation
                              ? `${focusedTrack.color}60`
                              : isPlayhead
                                ? 'rgba(255,255,255,0.22)'
                                : 'rgba(255,255,255,0.04)',
                          borderColor: isPlayhead
                            ? '#FFFFFF'
                            : isTiedContinuation
                              ? focusedTrack.color
                              : 'rgba(255,255,255,0.06)',
                        }}
                        className="rounded-xs border transition-none flex items-center justify-center cursor-pointer touch-none-control overflow-hidden"
                      >
                        {hasNote && noteDuration > 1 && (
                          <span className="font-studio-mono text-[7px] font-bold text-black leading-none">
                            ═{noteDuration}
                          </span>
                        )}
                        {isTiedContinuation && (
                          <span className="font-studio-mono text-[7px] font-bold text-white leading-none">
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

        {/* Docked Bottom Per-Note Visual Velocity Lane (With Shift+Drag & Shift+Scroll Fine Control) */}
        <div className="grid grid-cols-[62px_1fr] gap-1 items-end pt-1 border-t border-white/10 h-11 relative">
          <div className="flex flex-col justify-between h-full py-0.5">
            <span className="font-studio-mono text-[8.5px] font-bold text-gray-400">
              VELOCITY
            </span>
            {velFineMode && (
              <span className="px-1 py-0.2 rounded bg-amber-500 text-black font-studio-mono text-[7px] font-bold uppercase w-fit">
                10× FINE
              </span>
            )}
          </div>
          <div className="grid grid-cols-16 gap-0.5 h-full items-end">
            {Array.from({ length: 16 }, (_, cIdx) => {
              const patBars = Math.max(1, activePattern?.bars || 1);
              const polyLen =
                !seq?.lengthSteps || seq.lengthSteps === 16
                  ? patBars * 16
                  : seq.lengthSteps;
              const stepIdx = (barOffset + cIdx) % polyLen;
              const step = seq?.steps[stepIdx];
              const vel = step?.active ? step.velocity : 0.15;
              const isEditingThis = activeVelStep === stepIdx;

              return (
                <div
                  key={cIdx}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const fine = e.shiftKey;
                    setActiveVelStep(stepIdx);
                    setVelFineMode(fine);

                    let startVel = step?.active ? step.velocity : 0.75;
                    if (!fine) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relY =
                        1 -
                        Math.max(
                          0,
                          Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))
                        );
                      startVel = Math.max(0.05, Math.min(1, relY));
                      applyStepVelocity(stepIdx, startVel);
                    }

                    velDragRef.current = {
                      stepIdx,
                      lastY: e.clientY,
                      accumVel: startVel,
                    };
                  }}
                  onPointerMove={(e) => {
                    if (
                      !velDragRef.current ||
                      velDragRef.current.stepIdx !== stepIdx
                    ) {
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    const fine = e.shiftKey;
                    setVelFineMode(fine);

                    const dy = velDragRef.current.lastY - e.clientY;
                    velDragRef.current.lastY = e.clientY;

                    const sensitivity = fine ? 480 : 48;
                    const nextVel = Math.max(
                      0.05,
                      Math.min(1, velDragRef.current.accumVel + dy / sensitivity)
                    );
                    velDragRef.current.accumVel = nextVel;
                    applyStepVelocity(stepIdx, nextVel);
                  }}
                  onPointerUp={(e) => {
                    velDragRef.current = null;
                    setActiveVelStep(null);
                    setVelFineMode(false);
                    try {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      // Ignore
                    }
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const fine = e.shiftKey;
                    setVelFineMode(fine);
                    const dir = e.deltaY < 0 ? 1 : -1;
                    const stepDelta = fine ? 1 / 127 : 0.05;
                    const baseVel = step?.active ? step.velocity : 0.5;
                    applyStepVelocity(stepIdx, baseVel + dir * stepDelta);
                    window.setTimeout(() => setVelFineMode(false), 500);
                  }}
                  title={`Step ${stepIdx + 1} Velocity: ${Math.round(vel * 127)} / 127 (${Math.round(vel * 100)}%) — Drag vertically or Scroll • Hold Shift for 10× Fine`}
                  className="h-full bg-black/50 rounded-xs flex flex-col justify-end p-0.2 cursor-ns-resize border border-white/5 relative touch-none-control"
                >
                  {isEditingThis && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-1 rounded bg-black/90 text-white font-studio-mono text-[7.5px] font-bold z-20 pointer-events-none">
                      {Math.round(vel * 127)}
                    </span>
                  )}
                  <div
                    style={{
                      height: `${Math.round(vel * 100)}%`,
                      backgroundColor: step?.active
                        ? focusedTrack.color
                        : 'rgba(255,255,255,0.15)',
                    }}
                    className="w-full rounded-xs transition-none pointer-events-none"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Linear Song Arranger & Multi-Format Export Suite */}
      <div className="studio-module-mod lg:col-span-4 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div>
          <span className="font-studio-mono text-[10px] font-bold uppercase text-amber-400">
            LINEAR SONG ARRANGER TIMELINE
          </span>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-28 overflow-y-auto">
            {project.songTimeline.map((blk, idx) => (
              <button
                key={blk.id}
                type="button"
                onClick={() => onSelectPatternFromSong(blk.patternId)}
                className={`p-2 rounded-lg border text-left font-studio-mono text-[10px] cursor-pointer ${
                  project.activePatternId === blk.patternId
                    ? 'bg-rose-500/20 border-rose-400 text-white'
                    : 'bg-black/35 border-white/10 text-gray-300 hover:bg-white/5'
                }`}
              >
                <div className="font-bold">
                  {idx + 1}. PATTERN {blk.patternId} ×{blk.repeats}
                </div>
                <div className="text-[9px] text-gray-400">
                  {blk.mutedTracks.length > 0
                    ? `Muted: T${blk.mutedTracks.map((t) => t + 1).join(',')}`
                    : 'Full 8-Track Drop'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Format Studio Export Buttons */}
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <div className="font-studio-mono text-[9px] text-gray-400 uppercase">
            MULTI-FORMAT RENDER &amp; STEM EXPORTS
          </div>
          <div className="grid grid-cols-3 gap-1.5 font-studio-mono text-[10px]">
            <button
              type="button"
              onClick={onExportMasterWav}
              className="py-2 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-200 font-bold cursor-pointer"
            >
              🔊 MASTER .WAV
            </button>
            <button
              type="button"
              onClick={onExportStemsWav}
              className="py-2 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 font-bold cursor-pointer"
            >
              🎚️ 8 STEMS .WAV
            </button>
            <button
              type="button"
              onClick={onExportMidi}
              className="py-2 px-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-500/40 text-indigo-200 font-bold cursor-pointer"
            >
              🎹 MIDI .MID
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
