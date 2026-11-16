import React, { useEffect, useState } from 'react';
import type { GrooveboxAudioEngine } from '../../audio/GrooveboxAudioEngine';
import {
  buildVoiceLedChord,
  getNoteGravity,
  getScaleNotes,
  midiToNoteName,
  ROOT_NOTE_NAMES,
} from '../../presets/factoryPresets';
import type { GrooveboxProject, TrackConfig } from '../../types';

export interface PadsArpTabProps {
  project: GrooveboxProject;
  focusedTrack: TrackConfig;
  engine: GrooveboxAudioEngine;
  onTriggerPadNotes: (
    trackIndex: number,
    midiNotes: number[],
    velocity: number
  ) => void;
  onUpdateTrackConfig: (
    trackIndex: number,
    updater: (prev: TrackConfig) => TrackConfig
  ) => void;
}

type PadMode = 'scale' | 'chords' | 'drums';
type ChordFlavor = 'triad' | '7th' | '9th' | 'sus4' | 'spread';
type ArpDirection = 'up' | 'down' | 'up-down' | 'random';

export const PadsArpTab: React.FC<PadsArpTabProps> = ({
  project,
  focusedTrack,
  engine,
  onTriggerPadNotes,
  onUpdateTrackConfig,
}) => {
  const [padMode, setPadMode] = useState<PadMode>('scale');
  const [chordFlavor, setChordFlavor] = useState<ChordFlavor>('7th');
  const [magicChordActive, setMagicChordActive] = useState(false);

  const [arpEnabled, setArpEnabled] = useState(false);
  const [arpLatch, setArpLatch] = useState(false);
  const [arpDir, setArpDir] = useState<ArpDirection>('up');
  const [latchedMidis, setLatchedMidis] = useState<number[]>([]);

  const [isResampling, setIsResampling] = useState(false);
  const [hasResample, setHasResample] = useState(() =>
    engine.hasResampledAudio()
  );

  // Built-In Arpeggiator clock loop
  useEffect(() => {
    if (!arpEnabled || latchedMidis.length === 0) return;
    let idx = 0;
    const stepMs = (60 / Math.max(40, project.bpm) / 4) * 1000;

    const timer = window.setInterval(() => {
      const pool =
        arpDir === 'down'
          ? [...latchedMidis].reverse()
          : arpDir === 'random'
            ? [
                latchedMidis[
                  Math.floor(Math.random() * latchedMidis.length)
                ],
              ]
            : latchedMidis;
      const note = pool[idx % pool.length];
      onTriggerPadNotes(focusedTrack.index, [note], 0.85);
      idx++;
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [
    arpEnabled,
    latchedMidis,
    arpDir,
    project.bpm,
    focusedTrack.index,
    onTriggerPadNotes,
  ]);

  const scaleMidis = getScaleNotes(
    project.rootNote,
    project.scaleName,
    focusedTrack.index === 4 ? 2 : 4,
    16
  );

  const handlePadPress = (
    padIdx: number,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const velocity = Math.min(1, Math.max(0.45, 0.5 + relY * 0.5));

    if (padMode === 'drums') {
      const trkIdx = padIdx % 8;
      const note = project.tracks[trkIdx]?.isDrum ? 36 : 60;
      onTriggerPadNotes(trkIdx, [note], velocity);
      return;
    }

    if (padMode === 'chords') {
      const chordNotes = buildVoiceLedChord(
        padIdx,
        project.rootNote,
        project.scaleName,
        chordFlavor,
        magicChordActive,
        focusedTrack.voiceLeading
      );
      if (arpEnabled) {
        setLatchedMidis(chordNotes);
      } else {
        onTriggerPadNotes(focusedTrack.index, chordNotes, velocity);
      }
      return;
    }

    const midi = scaleMidis[padIdx] ?? 60;
    if (arpEnabled) {
      setLatchedMidis([midi, midi + 7, midi + 12]);
    } else {
      onTriggerPadNotes(focusedTrack.index, [midi], velocity);
    }
  };

  const handleToggleResample = () => {
    if (!isResampling) {
      engine.startResampling();
      setIsResampling(true);
    } else {
      const ok = engine.stopResampling();
      setIsResampling(false);
      setHasResample(ok);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full">
      {/* Left: 4x4 Multi-Touch Pad Grid with Functional Note Gravity Coloring */}
      <div className="studio-module-seq lg:col-span-8 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-white/10">
            {(['scale', 'chords', 'drums'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPadMode(m)}
                className={`px-2.5 py-1 rounded font-studio-mono text-[10px] font-bold uppercase cursor-pointer ${
                  padMode === m
                    ? 'bg-rose-500 text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {m === 'scale'
                  ? '🎵 SCALE GRID'
                  : m === 'chords'
                    ? '🎹 1-FINGER CHORDS'
                    : '🥁 8-DRUM KIT'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[9px] font-studio-mono">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ● HOME (ROOT/5TH)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
              ◆ COLOR (3RD/7TH)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ▲ TENSION
            </span>
          </div>
        </div>

        {/* 16 Expressive Pads (2x8 landscape layout for fast two-thumb play) */}
        <div className="grid grid-cols-8 gap-1.5 flex-1 my-auto">
          {Array.from({ length: 16 }, (_, idx) => {
            const midi = scaleMidis[idx] ?? 60;
            const gravity = getNoteGravity(midi, project.rootNote);
            const borderStyle =
              gravity === 'home'
                ? focusedTrack.color
                : gravity === 'color'
                  ? '#38BDF8'
                  : 'rgba(251,191,36,0.45)';

            const bgTint =
              gravity === 'home'
                ? `${focusedTrack.color}38`
                : gravity === 'color'
                  ? 'rgba(56,189,248,0.16)'
                  : 'rgba(255,255,255,0.05)';

            return (
              <button
                key={idx}
                type="button"
                onPointerDown={(e) => handlePadPress(idx, e)}
                onPointerUp={() => {
                  if (arpEnabled && !arpLatch) {
                    setLatchedMidis([]);
                  }
                }}
                style={{
                  borderColor: borderStyle,
                  backgroundColor: bgTint,
                }}
                className="rounded-lg border p-2 flex flex-col items-start justify-between hover:brightness-125 active:scale-95 transition-all cursor-pointer touch-none-control"
              >
                <span className="font-studio-mono text-[9px] font-bold text-gray-300 uppercase">
                  {gravity}
                </span>
                <span className="font-studio-mono text-xs font-bold text-white">
                  {padMode === 'drums'
                    ? project.tracks[idx % 8]?.name
                    : padMode === 'chords'
                      ? `${midiToNoteName(midi)} ${chordFlavor.toUpperCase()}`
                      : midiToNoteName(midi)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Magic Chord, Voice Leading, Arpeggiator & Live Resampler */}
      <div className="studio-module-mod lg:col-span-4 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between space-y-2">
        {/* Smart Chord Voicing & ✨ MAGIC CHORD */}
        <div className="bg-black/35 p-2 rounded-lg border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between font-studio-mono text-[10px]">
            <span className="text-purple-300 font-bold">
              CHORD VOICING ({ROOT_NOTE_NAMES[project.rootNote]} {project.scaleName})
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateTrackConfig(focusedTrack.index, (prev) => ({
                  ...prev,
                  voiceLeading: !prev.voiceLeading,
                }))
              }
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                focusedTrack.voiceLeading
                  ? 'bg-purple-500 text-black'
                  : 'bg-white/10 text-gray-400'
              }`}
            >
              VOICE LEAD
            </button>
          </div>

          <div className="flex items-center gap-1">
            {(['triad', '7th', '9th', 'sus4', 'spread'] as const).map((cf) => (
              <button
                key={cf}
                type="button"
                onClick={() => {
                  setPadMode('chords');
                  setChordFlavor(cf);
                }}
                className={`flex-1 py-1 rounded font-studio-mono text-[9px] font-bold uppercase cursor-pointer ${
                  chordFlavor === cf && padMode === 'chords'
                    ? 'bg-purple-400 text-black'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {cf}
              </button>
            ))}
          </div>

          <button
            type="button"
            onPointerDown={() => setMagicChordActive(true)}
            onPointerUp={() => setMagicChordActive(false)}
            onPointerLeave={() => setMagicChordActive(false)}
            className={`w-full py-1.5 rounded-lg font-studio-mono text-[11px] font-bold border transition-all cursor-pointer touch-none-control ${
              magicChordActive
                ? 'bg-fuchsia-400 text-black border-fuchsia-200 shadow-[0_0_15px_#E879F9]'
                : 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40 hover:bg-fuchsia-500/25'
            }`}
          >
            ✨ HOLD FOR MAGIC CHORD (MODAL BORROW)
          </button>
        </div>

        {/* Built-In Arpeggiator (`ARP` + `LATCH`) */}
        <div className="bg-black/35 p-2 rounded-lg border border-white/5 flex items-center justify-between gap-1.5 font-studio-mono text-[10px]">
          <button
            type="button"
            onClick={() => {
              setArpEnabled((v) => !v);
              if (arpEnabled) setLatchedMidis([]);
            }}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
              arpEnabled
                ? 'bg-sky-400 text-black'
                : 'bg-white/10 text-gray-300'
            }`}
          >
            ARP {arpEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setArpLatch((v) => !v)}
            className={`px-2 py-1 rounded font-bold cursor-pointer ${
              arpLatch
                ? 'bg-amber-400 text-black'
                : 'bg-white/10 text-gray-300'
            }`}
          >
            LATCH
          </button>

          <select
            aria-label="Arp Direction"
            value={arpDir}
            onChange={(e) => setArpDir(e.target.value as ArpDirection)}
            className="bg-black/60 text-white rounded border border-white/15 px-1.5 py-1 cursor-pointer"
          >
            <option value="up" className="bg-[#12151E]">UP</option>
            <option value="down" className="bg-[#12151E]">DOWN</option>
            <option value="up-down" className="bg-[#12151E]">UP/DOWN</option>
            <option value="random" className="bg-[#12151E]">RANDOM</option>
          </select>
        </div>

        {/* Internal Live Resampler Pad */}
        <div className="bg-black/35 p-2 rounded-lg border border-white/5 flex items-center justify-between gap-1.5 font-studio-mono text-[10px]">
          <button
            type="button"
            onClick={handleToggleResample}
            className={`flex-1 py-1.5 rounded font-bold cursor-pointer ${
              isResampling
                ? 'bg-rose-500 text-black animate-pulse'
                : 'bg-white/10 hover:bg-white/15 text-rose-300 border border-rose-500/30'
            }`}
          >
            {isResampling ? '■ STOP RESAMPLING' : '● RESAMPLE LIVE BUS'}
          </button>

          {hasResample && (
            <>
              <button
                type="button"
                onClick={() => engine.triggerResampledPad()}
                className="px-2.5 py-1.5 rounded bg-emerald-400 text-black font-bold cursor-pointer"
              >
                ▶ PLAY PAD
              </button>
              <button
                type="button"
                onClick={() => engine.downloadResampledLoopWav()}
                className="px-2 py-1.5 rounded bg-white/10 text-white cursor-pointer"
                title="Download Resampled WAV"
              >
                ⬇
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
