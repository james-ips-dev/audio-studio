/**
 * src/instruments/groovebox/presets/factoryPresets.ts
 *
 * - Strict 8-Track Color & Geometric Icon Identity
 * - 12 Root Notes x 7 Scale Modes + Functional Note Gravity (Home / Color / Tension)
 * - Track Synth Presets & Bidirectional Beginner Macro Mapper
 * - 6 Ready-to-Remix Starter Projects:
 *   1. Space Mission
 *   2. 8-Bit Boss Battle
 *   3. Robot Dance
 *   4. Cyber Jungle
 *   5. Neon Highway
 *   6. Starlight Chill
 * - Euclidean Pattern Generator, "ANSWER ME" 2-Bar Call & Response, and Voice-Led Chords
 */

import type {
  GrooveboxProject,
  InsertFxUnit,
  ModMatrixSlot,
  Pattern,
  PatternTrackSequence,
  ProSynthConfig,
  StepData,
  TrackConfig,
} from '../types';

export interface TrackMetaSpec {
  index: number;
  name: string;
  icon: string;
  color: string;
  isDrum: boolean;
  defaultNote: number;
}

export const TRACK_IDENTITIES: TrackMetaSpec[] = [
  { index: 0, name: 'KICK', icon: '●', color: '#FF4D4D', isDrum: true, defaultNote: 36 },
  { index: 1, name: 'SNARE', icon: '◆', color: '#FF9F1C', isDrum: true, defaultNote: 38 },
  { index: 2, name: 'HI-HAT', icon: '▲', color: '#FFD60A', isDrum: true, defaultNote: 42 },
  { index: 3, name: 'PERC / FM', icon: '⬡', color: '#38E54D', isDrum: true, defaultNote: 48 },
  { index: 4, name: 'BASS', icon: '〰', color: '#00E5FF', isDrum: false, defaultNote: 36 },
  { index: 5, name: 'LEAD', icon: '⚡', color: '#3B82F6', isDrum: false, defaultNote: 60 },
  { index: 6, name: 'CHORDS', icon: '❖', color: '#A855F7', isDrum: false, defaultNote: 60 },
  { index: 7, name: 'ARP / FX', icon: '✦', color: '#EC4899', isDrum: false, defaultNote: 72 },
];

export const ROOT_NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export const SCALE_DEFINITIONS: Record<string, number[]> = {
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const GROOVE_TEMPLATES: Record<string, { label: string; swing: number }> = {
  Straight: { label: 'Straight (50%)', swing: 0 },
  'MPC 58%': { label: 'MPC 58%', swing: 0.32 },
  'MPC 66%': { label: 'MPC 66%', swing: 0.64 },
  'Drunken Hip-Hop': { label: 'Drunken Hip-Hop', swing: 0.45 },
  'UK Garage': { label: 'UK Garage Shuffle', swing: 0.52 },
};

export const PATTERN_BANK_IDS = [
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4',
] as const;

export type NoteGravity = 'home' | 'color' | 'tension';

/**
 * Computes the functional harmonic gravity of a MIDI note relative to the active Key/Scale:
 * - Home: Root (0) & Perfect 5th (7)
 * - Color: Minor/Major 3rd (3, 4) & 7th (10, 11)
 * - Tension: 2nd (1, 2), 4th (5), 6th (8, 9), Tritone (6)
 */
export function getNoteGravity(midiNote: number, rootNote: number): NoteGravity {
  const interval = ((midiNote - rootNote) % 12 + 12) % 12;
  if (interval === 0 || interval === 7) return 'home';
  if (interval === 3 || interval === 4 || interval === 10 || interval === 11) {
    return 'color';
  }
  return 'tension';
}

export function midiToNoteName(midiNote: number): string {
  const name = ROOT_NOTE_NAMES[((midiNote % 12) + 12) % 12];
  const octave = Math.floor(midiNote / 12) - 1;
  return `${name}${octave}`;
}

export function midiToFreq(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Generates an array of in-scale MIDI notes starting from `baseMidi`.
 */
export function getScaleNotes(
  rootNote: number,
  scaleName: string,
  baseOctave: number = 3,
  count: number = 16
): number[] {
  const intervals = SCALE_DEFINITIONS[scaleName] ?? SCALE_DEFINITIONS.Minor;
  const result: number[] = [];
  let octave = baseOctave;
  let idx = 0;

  while (result.length < count) {
    const semitone = intervals[idx % intervals.length];
    const midi = (octave + 1) * 12 + rootNote + semitone;
    result.push(Math.min(108, Math.max(24, midi)));
    idx++;
    if (idx % intervals.length === 0) {
      octave++;
    }
  }
  return result;
}

/**
 * Smart 1-Finger Voice-Led Chord Voicing Generator with `✨ MAGIC CHORD` borrowed chord support.
 */
export function buildVoiceLedChord(
  padIndex: number,
  rootNote: number,
  scaleName: string,
  chordType: 'triad' | '7th' | '9th' | 'sus4' | 'spread' = '7th',
  magicChord: boolean = false,
  voiceLeading: boolean = true
): number[] {
  const scaleNotes = getScaleNotes(rootNote, scaleName, 3, 24);
  const degree = padIndex % 7;
  const rootMidi = scaleNotes[degree];
  const thirdMidi = scaleNotes[degree + 2] + (magicChord ? 1 : 0);
  const fifthMidi = scaleNotes[degree + 4];
  const seventhMidi = scaleNotes[degree + 6];
  const ninthMidi = scaleNotes[degree + 8];

  let raw: number[];
  switch (chordType) {
    case 'triad':
      raw = [rootMidi, thirdMidi, fifthMidi];
      break;
    case 'sus4':
      raw = [rootMidi, scaleNotes[degree + 3], fifthMidi];
      break;
    case '9th':
      raw = [rootMidi, thirdMidi, fifthMidi, seventhMidi, ninthMidi];
      break;
    case 'spread':
      raw = [rootMidi - 12, fifthMidi, thirdMidi + 12, seventhMidi];
      break;
    case '7th':
    default:
      raw = [rootMidi, thirdMidi, fifthMidi, seventhMidi];
      break;
  }

  if (!voiceLeading) return raw;

  // Voice-lead notes into a tight, warm register around C4 (60..74)
  return raw
    .map((n, i) => {
      if (i === 0) return n;
      let folded = n;
      while (folded > rootMidi + 14) folded -= 12;
      while (folded < rootMidi - 5) folded += 12;
      return folded;
    })
    .sort((a, b) => a - b);
}

/**
 * Euclidean rhythm step distributor (Bjorklund algorithm).
 */
export function computeEuclideanSteps(
  stepsCount: number,
  pulses: number,
  rotation: number = 0
): boolean[] {
  const n = Math.max(1, Math.min(64, stepsCount));
  const k = Math.max(0, Math.min(n, pulses));
  const pattern: boolean[] = new Array(n).fill(false);
  if (k === 0) return pattern;

  for (let i = 0; i < n; i++) {
    const hit = ((i * k) % n) < k;
    const rotatedIdx = (i + rotation + n) % n;
    pattern[rotatedIdx] = hit;
  }
  return pattern;
}

function createDefaultModMatrix(): ModMatrixSlot[] {
  return Array.from({ length: 8 }, (_, idx) => ({
    id: idx,
    enabled: idx === 0,
    source: idx === 0 ? 'lfo1' : 'filterEnv',
    curve: 'linear',
    depth: idx === 0 ? 0.18 : 0,
    destination: idx === 0 ? 'cutoff' : 'pwm',
  }));
}

function createDefaultInsertFx(trackIndex: number): InsertFxUnit[] {
  return [
    {
      type: 'drive',
      enabled: trackIndex === 0 || trackIndex === 4,
      params: { drive: trackIndex === 0 ? 0.35 : 0.25, mix: 0.6 },
    },
    {
      type: 'transientShaper',
      enabled: trackIndex < 4,
      params: { attack: 0.35, sustain: 0.0 },
    },
    {
      type: 'bitcrusher',
      enabled: false,
      params: { bits: 12, downsample: 2, mix: 0.5 },
    },
    {
      type: 'chorusTape',
      enabled: trackIndex >= 5,
      params: { rate: 0.8, depth: 0.35, wow: 0.15, mix: 0.35 },
    },
    {
      type: 'eq4',
      enabled: true,
      params: { lowGain: 1.5, mid1Gain: 0, mid2Gain: 0, highGain: 1.0 },
    },
    {
      type: 'sidechainComp',
      enabled: trackIndex === 4 || trackIndex === 6,
      params: { threshold: -22, ratio: 4.5, release: 0.18, depth: 0.55 },
      sidechainSourceTrack: 0,
    },
  ];
}

export interface TrackPresetOption {
  name: string;
  synth: ProSynthConfig;
}

export function createTrackDefaultSynth(trackIndex: number): ProSynthConfig {
  const baseModMatrix = createDefaultModMatrix();

  // Tailor each track's default synthesis engine to its sonic role
  const isKick = trackIndex === 0;
  const isSnare = trackIndex === 1;
  const isHat = trackIndex === 2;
  const isPerc = trackIndex === 3;
  const isBass = trackIndex === 4;
  const isLead = trackIndex === 5;
  const isChords = trackIndex === 6;

  const cutoffHz = isKick
    ? 220
    : isSnare
      ? 3800
      : isHat
        ? 11000
        : isBass
          ? 950
          : isChords
            ? 2400
            : 4200;
  const resonanceQ = isBass ? 5.5 : isLead ? 3.2 : 1.6;
  const decaySec = isKick
    ? 0.36
    : isSnare
      ? 0.22
      : isHat
        ? 0.09
        : isPerc
          ? 0.18
          : isBass
            ? 0.28
            : isChords
              ? 0.65
              : 0.32;

  return {
    voice: {
      mode: isChords ? 'poly' : isLead ? 'unison' : 'mono',
      legato: isBass || isLead,
      priority: 'last',
      polyVoices: isChords ? 6 : 4,
      unisonVoices: isLead ? 3 : 2,
      unisonDetune: isLead ? 18 : isChords ? 12 : 6,
      unisonSpread: isLead || isChords ? 0.65 : 0.2,
      glideTime: isBass ? 55 : isLead ? 35 : 0,
      glideTrigger: 'legato',
      glideCurve: 'exponential',
      analogSlop: 0.15,
      keyTunedDrum: isKick || isPerc,
    },
    osc1: {
      wave: isKick
        ? 'sine'
        : isSnare
          ? 'triangle'
          : isHat
            ? 'square'
            : isBass
              ? 'sawtooth'
              : isLead
                ? 'supersaw'
                : isChords
                  ? 'pwm'
                  : 'square',
      coarse: 0,
      fine: 0,
      pwm: 0.5,
      keySync: true,
      keyTrack: !isHat,
      level: isHat ? 0.25 : 0.85,
    },
    osc2: {
      wave: isPerc ? 'sine' : isBass ? 'square' : 'sawtooth',
      coarse: isChords ? 7 : isPerc ? 12 : 0,
      fine: isLead || isChords ? 9 : 0,
      hardSync: false,
      fmDepth: isKick ? 0.22 : isPerc ? 0.55 : isHat ? 0.65 : 0.12,
      keySync: true,
      keyTrack: true,
      level: isKick ? 0.15 : isBass || isLead || isChords ? 0.55 : 0.35,
    },
    sub1: {
      wave: 'sine',
      octaveOffset: -12,
      keySync: true,
      level: isKick || isBass ? 0.75 : 0.15,
    },
    sub2: {
      wave: 'triangle',
      semitoneOffset: isChords ? 7 : -24,
      keySync: true,
      level: isBass ? 0.35 : 0.0,
    },
    noise: {
      type: isHat ? 'metallic' : isSnare ? 'white' : 'pink',
      ringMod: isHat || isPerc,
      level: isHat ? 0.85 : isSnare ? 0.65 : isKick ? 0.08 : 0.04,
    },
    filter: {
      type: isHat ? 'hp12' : isBass ? 'lp24' : 'lp12',
      cutoff: cutoffHz,
      resonance: resonanceQ,
      drive: isKick || isBass ? 0.35 : 0.15,
      keyTrack: isBass || isLead || isChords ? 0.6 : 0.1,
      envDepth: isBass ? 0.55 : isKick ? 0.65 : 0.35,
      velocityTimbre: 0.5,
    },
    ampEnv: {
      attack: isChords ? 0.015 : 0.002,
      decay: decaySec,
      sustain: isBass ? 0.35 : isLead || isChords ? 0.55 : 0.0,
      release: isChords ? 0.45 : isLead ? 0.22 : 0.09,
    },
    filterEnv: {
      attack: 0.003,
      decay: decaySec * 0.85,
      sustain: 0.15,
      release: 0.15,
    },
    modEnv: {
      delay: 0,
      attack: 0.001,
      decay: isKick ? 0.055 : 0.12,
      sustain: 0,
      release: 0.06,
      loop: false,
    },
    lfo1: {
      wave: 'sine',
      sync: true,
      rateHz: 2.0,
      rateDiv: '1/4',
      fadeIn: 0,
      retrigger: false,
    },
    lfo2: {
      wave: 'triangle',
      sync: true,
      rateHz: 4.0,
      rateDiv: '1/8',
      fadeIn: 0,
      retrigger: true,
    },
    modSequencer: {
      enabled: false,
      subdivision: '1/16',
      steps: [
        0.8, -0.2, 0.5, -0.5, 0.9, 0.1, -0.4, 0.6,
        0.7, -0.3, 0.4, -0.6, 1.0, 0.2, -0.3, 0.5,
      ],
    },
    modMatrix: baseModMatrix,
    beginnerMacros: {
      cutoff: Math.min(1, Math.max(0, Math.log10(cutoffHz / 40) / Math.log10(18000 / 40))),
      resonance: Math.min(1, Math.max(0, (resonanceQ - 0.5) / 15.5)),
      fmDirt: isKick ? 0.25 : isPerc ? 0.55 : isBass ? 0.3 : 0.15,
      ampDecay: Math.min(1, Math.max(0.05, decaySec / 1.2)),
      pitchEnv: isKick ? 0.75 : isSnare ? 0.35 : isPerc ? 0.45 : 0.0,
      detune: isLead ? 0.45 : isChords ? 0.35 : 0.15,
    },
  };
}

/**
 * Preset bank per track so the `< >` Preset Browser in Tab 1 can cycle sounds cleanly.
 */
export const TRACK_PRESET_BANKS: Record<number, { name: string; overrides: Partial<ProSynthConfig['beginnerMacros']> }[]> = {
  0: [
    { name: '808 Sub Boom', overrides: { cutoff: 0.28, pitchEnv: 0.78, ampDecay: 0.45, fmDirt: 0.2 } },
    { name: '909 Punch Kick', overrides: { cutoff: 0.48, pitchEnv: 0.85, ampDecay: 0.28, fmDirt: 0.38 } },
    { name: 'Laser Gabber Kick', overrides: { cutoff: 0.72, pitchEnv: 0.95, ampDecay: 0.35, fmDirt: 0.75 } },
  ],
  1: [
    { name: 'Crisp Analog Snare', overrides: { cutoff: 0.68, pitchEnv: 0.35, ampDecay: 0.22, fmDirt: 0.25 } },
    { name: 'Tight Rim Clap', overrides: { cutoff: 0.82, pitchEnv: 0.5, ampDecay: 0.14, fmDirt: 0.45 } },
    { name: 'Lo-Fi Crunch Snare', overrides: { cutoff: 0.45, pitchEnv: 0.2, ampDecay: 0.3, fmDirt: 0.68 } },
  ],
  2: [
    { name: '909 Closed Hat', overrides: { cutoff: 0.85, resonance: 0.3, ampDecay: 0.09, fmDirt: 0.4 } },
    { name: 'Metallic Shimmer Hat', overrides: { cutoff: 0.92, resonance: 0.55, ampDecay: 0.24, fmDirt: 0.65 } },
    { name: 'Dusty Vinyl Tick', overrides: { cutoff: 0.6, resonance: 0.2, ampDecay: 0.06, fmDirt: 0.15 } },
  ],
  3: [
    { name: 'FM Wood Perc', overrides: { cutoff: 0.58, resonance: 0.4, fmDirt: 0.55, pitchEnv: 0.45 } },
    { name: 'Space Tom Zap', overrides: { cutoff: 0.5, resonance: 0.6, fmDirt: 0.3, pitchEnv: 0.8 } },
    { name: 'Robot Cowbell', overrides: { cutoff: 0.76, resonance: 0.5, fmDirt: 0.78, pitchEnv: 0.15 } },
  ],
  4: [
    { name: '303 Acid Squelch', overrides: { cutoff: 0.52, resonance: 0.72, fmDirt: 0.35, ampDecay: 0.26 } },
    { name: 'Reese Sub Bass', overrides: { cutoff: 0.36, resonance: 0.25, detune: 0.65, ampDecay: 0.55 } },
    { name: 'Funky FM Pluck Bass', overrides: { cutoff: 0.64, resonance: 0.42, fmDirt: 0.58, ampDecay: 0.22 } },
  ],
  5: [
    { name: 'Hyper SuperSaw Lead', overrides: { cutoff: 0.78, resonance: 0.32, detune: 0.6, ampDecay: 0.4 } },
    { name: 'Chiptune Pulse Lead', overrides: { cutoff: 0.84, resonance: 0.2, fmDirt: 0.4, detune: 0.1 } },
    { name: 'Cyber Sync Lead', overrides: { cutoff: 0.68, resonance: 0.55, fmDirt: 0.65, pitchEnv: 0.3 } },
  ],
  6: [
    { name: 'Juno Warm Chorus Pad', overrides: { cutoff: 0.58, resonance: 0.22, detune: 0.52, ampDecay: 0.68 } },
    { name: 'Neon Synthwave Stab', overrides: { cutoff: 0.74, resonance: 0.38, detune: 0.4, ampDecay: 0.35 } },
    { name: 'Glass FM Keys', overrides: { cutoff: 0.66, resonance: 0.25, fmDirt: 0.48, ampDecay: 0.5 } },
  ],
  7: [
    { name: 'Crystal Pluck Arp', overrides: { cutoff: 0.76, resonance: 0.35, ampDecay: 0.22, detune: 0.3 } },
    { name: 'Laser Riser FX', overrides: { cutoff: 0.88, resonance: 0.68, pitchEnv: 0.7, fmDirt: 0.5 } },
    { name: 'Starlight Bell Arp', overrides: { cutoff: 0.7, resonance: 0.28, fmDirt: 0.42, ampDecay: 0.48 } },
  ],
};

/**
 * Applies a Beginner Macro change onto the shared ProSynthConfig so both modes
 * remain 100% synchronized.
 */
export function applyBeginnerMacroToSynth(
  synth: ProSynthConfig,
  macroKey: keyof ProSynthConfig['beginnerMacros'],
  value: number
): ProSynthConfig {
  const nextMacros = { ...synth.beginnerMacros, [macroKey]: value };
  const next: ProSynthConfig = {
    ...synth,
    beginnerMacros: nextMacros,
    filter: { ...synth.filter },
    osc2: { ...synth.osc2 },
    ampEnv: { ...synth.ampEnv },
    filterEnv: { ...synth.filterEnv },
    voice: { ...synth.voice },
  };

  if (macroKey === 'cutoff') {
    const clamped = Math.min(1, Math.max(0, value));
    next.filter.cutoff = Math.round(40 * Math.pow(18000 / 40, clamped));
  } else if (macroKey === 'resonance') {
    const clamped = Math.min(1, Math.max(0, value));
    next.filter.resonance = Number((0.5 + clamped * 15.5).toFixed(2));
  } else if (macroKey === 'fmDirt') {
    const clamped = Math.min(1, Math.max(0, value));
    next.osc2.fmDepth = Number((clamped * 0.85).toFixed(2));
    next.filter.drive = Number((clamped * 0.75).toFixed(2));
  } else if (macroKey === 'ampDecay') {
    const clamped = Math.min(1, Math.max(0.03, value));
    next.ampEnv.decay = Number((clamped * 1.25).toFixed(3));
    next.filterEnv.decay = Number((clamped * 1.0).toFixed(3));
  } else if (macroKey === 'pitchEnv') {
    const clamped = Math.min(1, Math.max(-1, value));
    next.filter.envDepth = Number(clamped.toFixed(2));
  } else if (macroKey === 'detune') {
    const clamped = Math.min(1, Math.max(0, value));
    next.voice.unisonDetune = Math.round(clamped * 65);
    next.osc2.fine = Math.round(clamped * 35);
  }

  return next;
}

export function createEmptyStep(defaultMidiNote: number): StepData {
  return {
    active: false,
    notes: [
      {
        midiNote: defaultMidiNote,
        velocity: 0.82,
        durationSteps: 1,
        glide: false,
      },
    ],
    velocity: 0.82,
    microTiming: 0,
    ratchet: 1,
    ratchetCurve: 'flat',
    probability: 1.0,
    condition: 'ALWAYS',
    pLocks: {},
  };
}

function buildPatternFromRecipe(
  id: string,
  rootNote: number,
  scaleName: string,
  recipe: {
    kickSteps: number[];
    snareSteps: number[];
    hatSteps: number[];
    percSteps: number[];
    bassNotes: { step: number; degree: number; len?: number }[];
    leadNotes: { step: number; degree: number; len?: number }[];
    chordNotes: { step: number; degree: number; len?: number }[];
    arpSteps: number[];
  }
): Pattern {
  const scaleBass = getScaleNotes(rootNote, scaleName, 2, 16);
  const scaleLead = getScaleNotes(rootNote, scaleName, 4, 16);

  const tracks: PatternTrackSequence[] = TRACK_IDENTITIES.map((meta) => {
    const steps: StepData[] = Array.from({ length: 64 }, () =>
      createEmptyStep(meta.defaultNote)
    );

    const activateDrum = (stepIndices: number[], baseVel: number) => {
      for (let bar = 0; bar < 4; bar++) {
        const offset = bar * 16;
        for (const s of stepIndices) {
          const idx = offset + s;
          if (idx < 64) {
            steps[idx].active = true;
            const vel = s % 4 === 0 ? Math.min(1, baseVel + 0.1) : baseVel;
            steps[idx].velocity = vel;
            steps[idx].notes[0].velocity = vel;
          }
        }
      }
    };

    if (meta.index === 0) activateDrum(recipe.kickSteps, 0.9);
    if (meta.index === 1) activateDrum(recipe.snareSteps, 0.86);
    if (meta.index === 2) activateDrum(recipe.hatSteps, 0.72);
    if (meta.index === 3) activateDrum(recipe.percSteps, 0.76);

    if (meta.index === 4) {
      for (let bar = 0; bar < 4; bar++) {
        const offset = bar * 16;
        for (const item of recipe.bassNotes) {
          const idx = offset + item.step;
          if (idx < 64) {
            const midi = scaleBass[item.degree % scaleBass.length];
            steps[idx].active = true;
            steps[idx].velocity = 0.85;
            steps[idx].notes = [
              {
                midiNote: midi,
                velocity: 0.85,
                durationSteps: item.len ?? 1,
                glide: (item.len ?? 1) > 1,
              },
            ];
          }
        }
      }
    }

    if (meta.index === 5) {
      for (let bar = 0; bar < 4; bar++) {
        const offset = bar * 16;
        for (const item of recipe.leadNotes) {
          const idx = offset + item.step;
          if (idx < 64) {
            const midi = scaleLead[item.degree % scaleLead.length];
            steps[idx].active = true;
            steps[idx].velocity = 0.82;
            steps[idx].notes = [
              {
                midiNote: midi,
                velocity: 0.82,
                durationSteps: item.len ?? 1,
                glide: false,
              },
            ];
          }
        }
      }
    }

    if (meta.index === 6) {
      for (let bar = 0; bar < 4; bar++) {
        const offset = bar * 16;
        for (const item of recipe.chordNotes) {
          const idx = offset + item.step;
          if (idx < 64) {
            const chordMidis = buildVoiceLedChord(
              item.degree,
              rootNote,
              scaleName,
              '7th',
              false,
              true
            );
            steps[idx].active = true;
            steps[idx].velocity = 0.78;
            steps[idx].notes = chordMidis.map((midi) => ({
              midiNote: midi,
              velocity: 0.78,
              durationSteps: item.len ?? 4,
              glide: false,
            }));
          }
        }
      }
    }

    if (meta.index === 7) {
      for (let bar = 0; bar < 4; bar++) {
        const offset = bar * 16;
        recipe.arpSteps.forEach((s, i) => {
          const idx = offset + s;
          if (idx < 64) {
            const midi = scaleLead[(i * 2) % 8] + 12;
            steps[idx].active = true;
            steps[idx].velocity = 0.74;
            steps[idx].notes = [
              {
                midiNote: Math.min(96, midi),
                velocity: 0.74,
                durationSteps: 1,
                glide: false,
              },
            ];
          }
        });
      }
    }

    return {
      trackIndex: meta.index,
      lengthSteps: 16,
      phraseResetBars: 0,
      subdivision: '1/16',
      steps,
    };
  });

  return {
    id,
    bars: 2,
    tracks,
  };
}

/**
 * `🪄 ANSWER ME` (2-Bar Call-and-Response Co-Play Generator):
 * Analyzes Bar 1 (steps 0..15) of a melodic track and writes a complementary,
 * rhythmically mirrored Response phrase into Bar 2 (steps 16..31) that resolves
 * cleanly onto the scale's Home root note.
 */
export function applyAnswerMeCoPlay(
  pattern: Pattern,
  trackIndex: number,
  rootNote: number,
  scaleName: string
): Pattern {
  const scalePool = getScaleNotes(
    rootNote,
    scaleName,
    trackIndex === 4 ? 2 : 4,
    14
  );
  const nextTracks = pattern.tracks.map((trk) => {
    if (trk.trackIndex !== trackIndex) return trk;
    const nextSteps = trk.steps.map((s) => ({
      ...s,
      notes: s.notes.map((n) => ({ ...n })),
    }));

    // Collect active steps in Bar 1 (0..15)
    const callSteps: { stepOffset: number; midi: number; dur: number }[] = [];
    for (let i = 0; i < 16; i++) {
      if (nextSteps[i].active && nextSteps[i].notes.length > 0) {
        callSteps.push({
          stepOffset: i,
          midi: nextSteps[i].notes[0].midiNote,
          dur: nextSteps[i].notes[0].durationSteps,
        });
      }
    }

    // Clear Bar 2 (16..31)
    for (let i = 16; i < 32; i++) {
      nextSteps[i].active = false;
    }

    if (callSteps.length === 0) {
      // Seed a friendly Call & Response if Bar 1 was empty
      const seedOffsets = [0, 3, 6, 10, 16, 19, 22, 28];
      seedOffsets.forEach((st, idx) => {
        const isLast = idx === seedOffsets.length - 1;
        const note = isLast
          ? scalePool[0]
          : scalePool[(idx * 2 + 1) % 6];
        nextSteps[st].active = true;
        nextSteps[st].notes = [
          {
            midiNote: note,
            velocity: 0.85,
            durationSteps: isLast ? 4 : 2,
            glide: false,
          },
        ];
      });
    } else {
      callSteps.forEach((item, idx) => {
        const isFinal = idx === callSteps.length - 1;
        const targetStep = Math.min(31, 16 + item.stepOffset);
        const answerMidi = isFinal
          ? scalePool[0] // Resolve onto Home root note
          : scalePool[(idx + 3) % 7];
        nextSteps[targetStep].active = true;
        nextSteps[targetStep].velocity = 0.86;
        nextSteps[targetStep].notes = [
          {
            midiNote: answerMidi,
            velocity: 0.86,
            durationSteps: isFinal ? Math.max(2, item.dur) : item.dur,
            glide: false,
          },
        ];
      });
    }

    return {
      ...trk,
      steps: nextSteps,
    };
  });

  return {
    ...pattern,
    bars: Math.max(2, pattern.bars) as 1 | 2 | 3 | 4,
    tracks: nextTracks,
  };
}

export interface StarterProjectSpec {
  id: string;
  name: string;
  subtitle: string;
  bpm: number;
  rootNote: number;
  scaleName: string;
  swing: number;
}

export const STARTER_PROJECT_SPECS: StarterProjectSpec[] = [
  {
    id: 'space-mission',
    name: 'Space Mission',
    subtitle: 'Cosmic Synthwave & Driving Arps',
    bpm: 120,
    rootNote: 0, // C
    scaleName: 'Minor',
    swing: 0,
  },
  {
    id: '8bit-boss',
    name: '8-Bit Boss Battle',
    subtitle: 'High-Energy Chiptune Arcade Action',
    bpm: 140,
    rootNote: 2, // D
    scaleName: 'Harmonic Minor',
    swing: 0,
  },
  {
    id: 'robot-dance',
    name: 'Robot Dance',
    subtitle: 'Electro Funk & Acid Squelch',
    bpm: 126,
    rootNote: 9, // A
    scaleName: 'Dorian',
    swing: 0.24,
  },
  {
    id: 'cyber-jungle',
    name: 'Cyber Jungle',
    subtitle: 'Breakbeat Syncopation & Deep Sub',
    bpm: 156,
    rootNote: 5, // F
    scaleName: 'Minor Pentatonic',
    swing: 0.15,
  },
  {
    id: 'neon-highway',
    name: 'Neon Highway',
    subtitle: 'Outrun Night Drive & Analog Chords',
    bpm: 110,
    rootNote: 4, // E
    scaleName: 'Minor',
    swing: 0.1,
  },
  {
    id: 'starlight-chill',
    name: 'Starlight Chill',
    subtitle: 'Lo-Fi Dream Beats & Warm Pads',
    bpm: 92,
    rootNote: 7, // G
    scaleName: 'Major',
    swing: 0.35,
  },
];

export function createStarterProject(specId: string = 'space-mission'): GrooveboxProject {
  const spec =
    STARTER_PROJECT_SPECS.find((s) => s.id === specId) ??
    STARTER_PROJECT_SPECS[0];

  const tracks: TrackConfig[] = TRACK_IDENTITIES.map((meta) => {
    const presetList = TRACK_PRESET_BANKS[meta.index] ?? [];
    const firstPresetName = presetList[0]?.name ?? `${meta.name} Init`;
    return {
      index: meta.index,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      isDrum: meta.isDrum,
      presetName: firstPresetName,
      synth: createTrackDefaultSynth(meta.index),
      insertFx: createDefaultInsertFx(meta.index),
      voiceLeading: true,
      chordStrumMs: meta.index === 6 ? 18 : 0,
      mixer: {
        volume: meta.index === 0 ? 0.88 : meta.index === 4 ? 0.82 : 0.74,
        pan: meta.index === 2 ? -0.2 : meta.index === 3 ? 0.25 : 0,
        stereoWidth: meta.index >= 5 ? 1.35 : 1.0,
        bassMonoHz: 120,
        reverbSend: meta.index >= 5 ? 0.35 : meta.index === 1 ? 0.22 : 0.05,
        delaySend: meta.index === 5 || meta.index === 7 ? 0.32 : 0.08,
        mute: false,
        solo: false,
      },
      recordArmed: meta.index === 5,
      recordLocked: false,
    };
  });

  // Create distinct recipes across patterns A1..D4 so Clip Matrix & Crossfader have rich variations
  const patternA1 = buildPatternFromRecipe('A1', spec.rootNote, spec.scaleName, {
    kickSteps: spec.id === 'cyber-jungle' ? [0, 6, 10] : [0, 4, 8, 12],
    snareSteps: [4, 12],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
    percSteps: [3, 7, 11, 15],
    bassNotes: [
      { step: 0, degree: 0, len: 2 },
      { step: 2, degree: 0, len: 1 },
      { step: 4, degree: 2, len: 2 },
      { step: 7, degree: 4, len: 1 },
      { step: 8, degree: 3, len: 3 },
      { step: 12, degree: 4, len: 2 },
      { step: 14, degree: 6, len: 2 },
    ],
    leadNotes: [
      { step: 0, degree: 4, len: 3 },
      { step: 4, degree: 2, len: 2 },
      { step: 6, degree: 0, len: 2 },
      { step: 10, degree: 5, len: 3 },
      { step: 14, degree: 4, len: 2 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 5, len: 8 },
    ],
    arpSteps: [0, 2, 4, 6, 8, 10, 12, 14],
  });

  const patternA2 = buildPatternFromRecipe('A2', spec.rootNote, spec.scaleName, {
    kickSteps: [0, 3, 6, 8, 12, 14],
    snareSteps: [4, 11, 12, 15],
    hatSteps: [0, 1, 2, 4, 6, 8, 9, 10, 12, 14, 15],
    percSteps: [2, 5, 9, 13],
    bassNotes: [
      { step: 0, degree: 0, len: 3 },
      { step: 3, degree: 2, len: 1 },
      { step: 6, degree: 4, len: 2 },
      { step: 8, degree: 5, len: 4 },
      { step: 12, degree: 3, len: 4 },
    ],
    leadNotes: [
      { step: 2, degree: 6, len: 2 },
      { step: 4, degree: 4, len: 4 },
      { step: 8, degree: 2, len: 2 },
      { step: 12, degree: 0, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 3, len: 8 },
      { step: 8, degree: 4, len: 8 },
    ],
    arpSteps: [1, 3, 5, 7, 9, 11, 13, 15],
  });

  const patternB1 = buildPatternFromRecipe('B1', spec.rootNote, spec.scaleName, {
    kickSteps: [0, 8],
    snareSteps: [4, 12],
    hatSteps: [2, 6, 10, 14],
    percSteps: [0, 6, 12],
    bassNotes: [
      { step: 0, degree: 0, len: 6 },
      { step: 8, degree: 2, len: 6 },
    ],
    leadNotes: [
      { step: 0, degree: 7, len: 4 },
      { step: 6, degree: 4, len: 4 },
      { step: 12, degree: 2, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 16 },
    ],
    arpSteps: [0, 3, 6, 9, 12, 15],
  });

  const patterns: Record<string, Pattern> = {};
  for (const patId of PATTERN_BANK_IDS) {
    if (patId === 'A1') patterns[patId] = patternA1;
    else if (patId === 'A2') patterns[patId] = patternA2;
    else if (patId === 'B1') patterns[patId] = patternB1;
    else {
      patterns[patId] = JSON.parse(
        JSON.stringify(patId.startsWith('B') ? patternB1 : patternA1)
      ) as Pattern;
      patterns[patId].id = patId;
    }
  }

  return {
    id: `proj_${spec.id}`,
    name: spec.name,
    updatedAt: Date.now(),
    mode: 'beginner',
    ecoMode: false,
    safeLockEnabled: false,
    bpm: spec.bpm,
    grooveTemplate: 'Straight',
    swing: spec.swing,
    rootNote: spec.rootNote,
    scaleName: spec.scaleName,
    activePatternId: 'A1',
    tracks,
    patterns,
    performance: {
      activeTrackPatterns: Array(8).fill('A1'),
      queuedTrackPatterns: Array(8).fill(null),
      launchQuantize: '1-bar',
      legatoPhaseLock: true,
      deckA: Array(8).fill('A1'),
      deckB: Array(8).fill('A2'),
      crossfaderPosition: 0,
      crossfadeMode: 'dj-eq-blend',
      activePunchInFx: 'none',
    },
    songTimeline: [
      { id: 'blk_1', patternId: 'A1', repeats: 2, mutedTracks: [5, 7] },
      { id: 'blk_2', patternId: 'A1', repeats: 2, mutedTracks: [] },
      { id: 'blk_3', patternId: 'A2', repeats: 2, mutedTracks: [] },
      { id: 'blk_4', patternId: 'B1', repeats: 1, mutedTracks: [0] },
    ],
    macros: Array.from({ length: 8 }, (_, idx) => ({
      id: idx,
      name: `MACRO ${idx + 1}`,
      value: 0.5,
      mappings: [],
    })),
    sceneA: { 'tracks.4.synth.filter.cutoff': 600, 'tracks.5.synth.filter.cutoff': 1800 },
    sceneB: { 'tracks.4.synth.filter.cutoff': 5200, 'tracks.5.synth.filter.cutoff': 9500 },
    sceneCrossfader: 0,
    midiMappings: [],
    globalFx: {
      reverbSize: 0.62,
      reverbDamp: 0.45,
      reverbReturn: 0.28,
      delayDiv: '1/8D',
      delayFeedback: 0.38,
      delayReturn: 0.24,
      masterFilterCutoff: 18500,
      masterCompressorThreshold: -14,
      masterCompressorRatio: 3.2,
      masterTiltEq: 0.1,
      masterLimiterCeilingDb: -0.3,
      masterVolume: 0.82,
    },
  };
}
