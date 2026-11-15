import React from 'react';
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

  // Folded Scale Grid rows (8 in-key pitches from high to low)
  const scalePitches = getScaleNotes(
    project.rootNote,
    project.scaleName,
    focusedTrack.index === 4 ? 2 : 4,
    8
  ).reverse();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-y-auto">
      {/* Left: Folded Scale Piano Roll + Docked Visual Velocity Lane */}
      <div className="lg:col-span-8 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold text-black"
              style={{ backgroundColor: focusedTrack.color }}
            >
              FOLDED SCALE PIANO ROLL // {focusedTrack.name}
            </span>
            <button
              type="button"
              onClick={() => onAnswerMeCoPlay(focusedTrack.index)}
              className="px-2 py-0.5 rounded bg-violet-500/25 hover:bg-violet-500/40 text-violet-200 border border-violet-400/40 font-studio-mono text-[10px] font-bold cursor-pointer"
            >
              🪄 ANSWER ME (2-BAR CO-PLAY)
            </button>
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

        {/* Folded 8-Row Scale Grid */}
        <div className="flex-1 flex flex-col justify-between gap-0.5 my-1">
          {scalePitches.map((midi) => {
            const gravity = getNoteGravity(midi, project.rootNote);
            return (
              <div
                key={midi}
                className="grid grid-cols-[54px_1fr] gap-1 items-center h-4"
              >
                <span
                  className={`font-studio-mono text-[9px] font-bold px-1 rounded truncate ${
                    gravity === 'home'
                      ? 'text-emerald-300 bg-emerald-500/15'
                      : gravity === 'color'
                        ? 'text-sky-300 bg-sky-500/15'
                        : 'text-gray-400 bg-white/5'
                  }`}
                >
                  {midiToNoteName(midi)}
                </span>

                <div className="grid grid-cols-16 gap-0.5 h-full">
                  {Array.from({ length: 16 }, (_, cIdx) => {
                    const stepIdx = (barOffset + cIdx) % (seq?.lengthSteps || 16);
                    const step = seq?.steps[stepIdx];
                    const hasNote =
                      step?.active &&
                      step.notes.some((n) => n.midiNote === midi);
                    const isPlayhead =
                      isPlaying &&
                      currentGlobalStep % (seq?.lengthSteps || 16) === stepIdx;

                    return (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() =>
                          onUpdateStepData(
                            focusedTrack.index,
                            stepIdx,
                            (prev) => {
                              const already =
                                prev.active &&
                                prev.notes.some((n) => n.midiNote === midi);
                              if (already) {
                                return { ...prev, active: false };
                              }
                              return {
                                ...prev,
                                active: true,
                                notes: [
                                  {
                                    midiNote: midi,
                                    velocity: prev.velocity || 0.85,
                                    durationSteps:
                                      prev.notes[0]?.durationSteps || 1,
                                    glide: false,
                                  },
                                ],
                              };
                            }
                          )
                        }
                        style={{
                          backgroundColor: hasNote
                            ? focusedTrack.color
                            : isPlayhead
                              ? 'rgba(255,255,255,0.18)'
                              : 'rgba(255,255,255,0.04)',
                        }}
                        className="rounded-xs border border-white/5 cursor-pointer"
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Docked Bottom Per-Note Visual Velocity Lane */}
        <div className="grid grid-cols-[54px_1fr] gap-1 items-end pt-1 border-t border-white/10 h-10">
          <span className="font-studio-mono text-[9px] text-gray-400">
            VELOCITY
          </span>
          <div className="grid grid-cols-16 gap-0.5 h-full items-end">
            {Array.from({ length: 16 }, (_, cIdx) => {
              const stepIdx = (barOffset + cIdx) % (seq?.lengthSteps || 16);
              const step = seq?.steps[stepIdx];
              const vel = step?.active ? step.velocity : 0.15;

              return (
                <div
                  key={cIdx}
                  onClick={() => {
                    const nextVel =
                      vel >= 0.95 ? 0.35 : Math.min(1, vel + 0.2);
                    onUpdateStepData(focusedTrack.index, stepIdx, (prev) => ({
                      ...prev,
                      active: true,
                      velocity: nextVel,
                      notes: prev.notes.map((n) => ({
                        ...n,
                        velocity: nextVel,
                      })),
                    }));
                  }}
                  title={`Step ${stepIdx + 1} Velocity: ${Math.round(vel * 127)} (Click to cycle)`}
                  className="h-full bg-black/50 rounded-xs flex flex-col justify-end p-0.2 cursor-ns-resize border border-white/5"
                >
                  <div
                    style={{
                      height: `${Math.round(vel * 100)}%`,
                      backgroundColor: step?.active
                        ? focusedTrack.color
                        : 'rgba(255,255,255,0.15)',
                    }}
                    className="w-full rounded-xs transition-all"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Linear Song Arranger & Multi-Format Export Suite */}
      <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
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
