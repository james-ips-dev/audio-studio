import React, { useState } from 'react';
import type { GrooveboxAudioEngine } from '../../audio/GrooveboxAudioEngine';
import {
  buildVoiceLedChord,
  getNoteGravity,
  getScaleNotes,
  midiToNoteName,
  ROOT_NOTE_NAMES,
} from '../../presets/factoryPresets';
import type {
  ArpDirection,
  ArpRateDivision,
  GrooveboxProject,
  TrackConfig,
} from '../../types';

export interface PadsArpTabProps {
  project: GrooveboxProject;
  focusedTrack: TrackConfig;
  engine: GrooveboxAudioEngine;
  arpLatchedMidis: number[];
  onSetArpLatchedMidis: (notes: number[]) => void;
  onUpdatePerformance: (
    updater: (
      prev: GrooveboxProject['performance']
    ) => GrooveboxProject['performance']
  ) => void;
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

const ARP_RATE_OPTIONS: {
  id: ArpRateDivision;
  label: string;
  beatsPerStep: number;
}[] = [
  { id: '1/4', label: '1/4 SYNC', beatsPerStep: 1 },
  { id: '1/8', label: '1/8 SYNC', beatsPerStep: 0.5 },
  { id: '1/8T', label: '1/8T TRIPLET', beatsPerStep: 1 / 3 },
  { id: '1/16', label: '1/16 SYNC', beatsPerStep: 0.25 },
  { id: '1/16T', label: '1/16T TRIPLET', beatsPerStep: 1 / 6 },
  { id: '1/32', label: '1/32 FAST', beatsPerStep: 0.125 },
];

export const PadsArpTab: React.FC<PadsArpTabProps> = ({
  project,
  focusedTrack,
  engine,
  arpLatchedMidis,
  onSetArpLatchedMidis,
  onUpdatePerformance,
  onTriggerPadNotes,
  onUpdateTrackConfig,
}) => {
  const [padMode, setPadMode] = useState<PadMode>('scale');
  const [chordFlavor, setChordFlavor] = useState<ChordFlavor>('7th');
  const [magicChordHeld, setMagicChordHeld] = useState(false);
  const [magicChordLocked, setMagicChordLocked] = useState(false);
  const magicChordActive = magicChordHeld || magicChordLocked;

  const arpEnabled = project.performance.arpEnabled ?? false;
  const arpLatch = project.performance.arpLatch ?? false;
  const arpDir: ArpDirection = project.performance.arpDirection ?? 'up';
  const arpRate: ArpRateDivision = project.performance.arpRate ?? '1/16';
  const arpOctaves: 1 | 2 | 3 = project.performance.arpOctaves ?? 2;

  const [isResampling, setIsResampling] = useState(false);
  const [hasResample, setHasResample] = useState(() =>
    engine.hasResampledAudio()
  );

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

    // When Magic Chord is held/locked OR Chords mode is selected, build a voice-led chord
    if (padMode === 'chords' || magicChordActive) {
      const chordNotes = buildVoiceLedChord(
        padIdx,
        project.rootNote,
        project.scaleName,
        chordFlavor,
        magicChordActive,
        focusedTrack.voiceLeading
      );
      if (arpEnabled) {
        onSetArpLatchedMidis(chordNotes);
      } else {
        onTriggerPadNotes(focusedTrack.index, chordNotes, velocity);
      }
      return;
    }

    const midi = scaleMidis[padIdx] ?? 60;
    const thirdMidi = scaleMidis[(padIdx + 2) % scaleMidis.length] ?? midi + 4;
    const fifthMidi = scaleMidis[(padIdx + 4) % scaleMidis.length] ?? midi + 7;
    if (arpEnabled) {
      const baseTriad = [
        midi,
        thirdMidi < midi ? thirdMidi + 12 : thirdMidi,
        fifthMidi < midi ? fifthMidi + 12 : fifthMidi,
      ];
      onSetArpLatchedMidis(baseTriad);
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
                    onSetArpLatchedMidis([]);
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
                    : padMode === 'chords' || magicChordActive
                      ? `${midiToNoteName(midi)} ${magicChordActive ? 'MAGIC' : chordFlavor.toUpperCase()}`
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

          <div className="flex items-center gap-1">
            <button
              type="button"
              onPointerDown={() => setMagicChordHeld(true)}
              onPointerUp={() => setMagicChordHeld(false)}
              onPointerLeave={() => setMagicChordHeld(false)}
              title="Hold while pressing any pad (or click LOCK) to borrow lush parallel-mode chords (Modal Interchange)"
              className={`flex-1 py-1.5 px-2 rounded-lg font-studio-mono text-[10px] font-bold border transition-all cursor-pointer touch-none-control ${
                magicChordActive
                  ? 'bg-fuchsia-400 text-black border-fuchsia-200 shadow-[0_0_15px_#E879F9]'
                  : 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40 hover:bg-fuchsia-500/25'
              }`}
            >
              ✨ HOLD FOR MAGIC CHORD (MODAL BORROW)
            </button>
            <button
              type="button"
              onClick={() => setMagicChordLocked((v) => !v)}
              title="Lock Magic Chord on so you can play modal-borrowed chords with one hand"
              className={`px-2 py-1.5 rounded-lg font-studio-mono text-[10px] font-bold border transition-all cursor-pointer ${
                magicChordLocked
                  ? 'bg-fuchsia-400 text-black border-fuchsia-200'
                  : 'bg-white/5 text-fuchsia-200 border-white/15 hover:bg-white/10'
              }`}
            >
              {magicChordLocked ? '🔒 LOCKED' : 'LOCK'}
            </button>
          </div>
        </div>

        {/* Built-In Arpeggiator (`ARP` + `LATCH` + BPM-Synced `RATE` + `1-3 OCTAVES` + `DIR`) */}
        <div className="bg-black/35 p-2 rounded-lg border border-white/5 space-y-1.5 font-studio-mono text-[10px]">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => {
                const next = !arpEnabled;
                onUpdatePerformance((prev) => ({
                  ...prev,
                  arpEnabled: next,
                }));
                if (!next) onSetArpLatchedMidis([]);
              }}
              className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                arpEnabled
                  ? 'bg-sky-400 text-black shadow-[0_0_10px_rgba(56,189,248,0.45)]'
                  : 'bg-white/10 text-gray-300'
              }`}
            >
              ARP {arpEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdatePerformance((prev) => ({
                  ...prev,
                  arpLatch: !arpLatch,
                }))
              }
              className={`px-2 py-1 rounded font-bold cursor-pointer ${
                arpLatch
                  ? 'bg-amber-400 text-black'
                  : 'bg-white/10 text-gray-300'
              }`}
            >
              LATCH {arpLatch && arpLatchedMidis.length > 0 ? `(${arpLatchedMidis.length})` : ''}
            </button>

            <select
              aria-label="Arp Direction"
              value={arpDir}
              onChange={(e) => {
                const arpDirection = e.target.value as ArpDirection;
                onUpdatePerformance((prev) => ({ ...prev, arpDirection }));
              }}
              className="bg-black/60 text-white rounded border border-white/15 px-1.5 py-1 cursor-pointer"
            >
              <option value="up" className="bg-[#12151E]">UP</option>
              <option value="down" className="bg-[#12151E]">DOWN</option>
              <option value="up-down" className="bg-[#12151E]">UP/DOWN</option>
              <option value="random" className="bg-[#12151E]">RANDOM</option>
            </select>
          </div>

          {/* Row 2: BPM-Synced Arp Speed Division & Multi-Octave Range (1-3 Octaves) */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <label className="flex items-center gap-1 flex-1">
              <span className="text-sky-300 font-bold text-[9px]">SPEED:</span>
              <select
                aria-label="Arp Synced Rate"
                value={arpRate}
                onChange={(e) => {
                  const nextRate = e.target.value as ArpRateDivision;
                  onUpdatePerformance((prev) => ({
                    ...prev,
                    arpRate: nextRate,
                  }));
                }}
                title="BPM-Synced Arpeggiator Speed Subdivision"
                className="flex-1 bg-black/60 text-sky-200 rounded border border-sky-500/30 px-1.5 py-0.5 text-[9.5px] font-bold cursor-pointer"
              >
                {ARP_RATE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-[#12151E]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-0.5 bg-black/50 p-0.5 rounded border border-white/10">
              {([1, 2, 3] as const).map((oct) => (
                <button
                  key={oct}
                  type="button"
                  onClick={() =>
                    onUpdatePerformance((prev) => ({
                      ...prev,
                      arpOctaves: oct,
                    }))
                  }
                  title={`Arpeggiate across ${oct} octave${oct > 1 ? 's' : ''}`}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                    arpOctaves === oct
                      ? 'bg-sky-400 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {oct} OCT
                </button>
              ))}
            </div>
          </div>
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
