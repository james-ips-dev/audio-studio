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

export interface TrackBankPresetItem {
  name: string;
  modeTag: 'beginner' | 'pro';
  overrides: Partial<ProSynthConfig['beginnerMacros']>;
  osc1Wave?: ProSynthConfig['osc1']['wave'];
  osc2Wave?: ProSynthConfig['osc2']['wave'];
  filterType?: ProSynthConfig['filter']['type'];
  sustain?: number;
  glideTime?: number;
}

/**
 * 20 Presets per Track Synth Engine (10 Play Mode + 10 Studio Pro Mode = 20 per track, 160 total).
 */
export const TRACK_PRESET_BANKS: Record<number, TrackBankPresetItem[]> = {
  // Track 0: KICK (20 Presets)
  0: [
    // 10 Play Mode Presets
    { name: '808 Sub Boom', modeTag: 'beginner', overrides: { cutoff: 0.28, pitchEnv: 0.78, ampDecay: 0.48, fmDirt: 0.18 } },
    { name: '909 Punch Kick', modeTag: 'beginner', overrides: { cutoff: 0.48, pitchEnv: 0.85, ampDecay: 0.28, fmDirt: 0.35 } },
    { name: 'Laser Arcade Kick', modeTag: 'beginner', overrides: { cutoff: 0.72, pitchEnv: 0.95, ampDecay: 0.32, fmDirt: 0.65 } },
    { name: 'Pillow Soft Sub', modeTag: 'beginner', overrides: { cutoff: 0.2, pitchEnv: 0.52, ampDecay: 0.55, fmDirt: 0.08 } },
    { name: 'Robot Stomp Kick', modeTag: 'beginner', overrides: { cutoff: 0.58, pitchEnv: 0.82, ampDecay: 0.3, fmDirt: 0.58 } },
    { name: 'Bouncy House Kick', modeTag: 'beginner', overrides: { cutoff: 0.42, pitchEnv: 0.74, ampDecay: 0.34, fmDirt: 0.25 } },
    { name: 'Retro CR-78 Thud', modeTag: 'beginner', overrides: { cutoff: 0.32, pitchEnv: 0.6, ampDecay: 0.22, fmDirt: 0.15 } },
    { name: 'Neon Synthwave Kick', modeTag: 'beginner', overrides: { cutoff: 0.52, pitchEnv: 0.8, ampDecay: 0.4, fmDirt: 0.3 } },
    { name: 'Starlight Lo-Fi Kick', modeTag: 'beginner', overrides: { cutoff: 0.24, pitchEnv: 0.64, ampDecay: 0.26, fmDirt: 0.22 } },
    { name: 'Mega Boss Impact', modeTag: 'beginner', overrides: { cutoff: 0.66, pitchEnv: 0.92, ampDecay: 0.62, fmDirt: 0.72 } },
    // 10 Studio Pro Presets
    { name: 'Berghain Warehouse Sub', modeTag: 'pro', overrides: { cutoff: 0.38, pitchEnv: 0.86, ampDecay: 0.54, fmDirt: 0.44, resonance: 0.35 } },
    { name: 'Hard Industrial Gabber', modeTag: 'pro', overrides: { cutoff: 0.82, pitchEnv: 0.96, ampDecay: 0.46, fmDirt: 0.88, resonance: 0.5 } },
    { name: 'Dub Techno Deep Thump', modeTag: 'pro', overrides: { cutoff: 0.22, pitchEnv: 0.68, ampDecay: 0.5, fmDirt: 0.12, resonance: 0.28 } },
    { name: 'FM Transient Click Kick', modeTag: 'pro', overrides: { cutoff: 0.62, pitchEnv: 0.9, ampDecay: 0.27, fmDirt: 0.64, resonance: 0.2 } },
    { name: 'Modular Vactrol Kick', modeTag: 'pro', overrides: { cutoff: 0.34, pitchEnv: 0.76, ampDecay: 0.38, fmDirt: 0.28, resonance: 0.42 } },
    { name: 'Acid Rave Overdrive', modeTag: 'pro', overrides: { cutoff: 0.7, pitchEnv: 0.88, ampDecay: 0.42, fmDirt: 0.78, resonance: 0.48 } },
    { name: 'Minimal Micro-Click', modeTag: 'pro', overrides: { cutoff: 0.46, pitchEnv: 0.72, ampDecay: 0.19, fmDirt: 0.32, resonance: 0.15 } },
    { name: 'Sustained 808 Bass Kick', modeTag: 'pro', overrides: { cutoff: 0.3, pitchEnv: 0.7, ampDecay: 0.85, fmDirt: 0.24 }, sustain: 0.65 },
    { name: 'Broken Beat Saturator', modeTag: 'pro', overrides: { cutoff: 0.56, pitchEnv: 0.81, ampDecay: 0.33, fmDirt: 0.54, resonance: 0.36 } },
    { name: 'Subharmonic Earthquake', modeTag: 'pro', overrides: { cutoff: 0.26, pitchEnv: 0.84, ampDecay: 0.72, fmDirt: 0.36 }, sustain: 0.5 },
  ],
  // Track 1: SNARE (20 Presets)
  1: [
    // 10 Play Mode Presets
    { name: 'Crisp Analog Snare', modeTag: 'beginner', overrides: { cutoff: 0.68, pitchEnv: 0.35, ampDecay: 0.22, fmDirt: 0.25 } },
    { name: 'Tight Rim Clap', modeTag: 'beginner', overrides: { cutoff: 0.82, pitchEnv: 0.5, ampDecay: 0.14, fmDirt: 0.45 } },
    { name: 'Lo-Fi Crunch Snare', modeTag: 'beginner', overrides: { cutoff: 0.45, pitchEnv: 0.2, ampDecay: 0.3, fmDirt: 0.68 } },
    { name: '8-Bit Noise Snap', modeTag: 'beginner', overrides: { cutoff: 0.78, pitchEnv: 0.4, ampDecay: 0.18, fmDirt: 0.6 }, osc1Wave: 'square' },
    { name: '808 Crispy Clap', modeTag: 'beginner', overrides: { cutoff: 0.74, pitchEnv: 0.28, ampDecay: 0.26, fmDirt: 0.32 } },
    { name: '909 Arena Snare', modeTag: 'beginner', overrides: { cutoff: 0.7, pitchEnv: 0.48, ampDecay: 0.32, fmDirt: 0.38 } },
    { name: 'Cosmic Laser Snare', modeTag: 'beginner', overrides: { cutoff: 0.85, pitchEnv: 0.75, ampDecay: 0.25, fmDirt: 0.52 } },
    { name: 'Warm Bedroom Brush', modeTag: 'beginner', overrides: { cutoff: 0.38, pitchEnv: 0.12, ampDecay: 0.28, fmDirt: 0.12 } },
    { name: 'Electro Funk Whip', modeTag: 'beginner', overrides: { cutoff: 0.8, pitchEnv: 0.62, ampDecay: 0.2, fmDirt: 0.48 } },
    { name: 'Candy Pop Finger Snap', modeTag: 'beginner', overrides: { cutoff: 0.86, pitchEnv: 0.55, ampDecay: 0.11, fmDirt: 0.22 } },
    // 10 Studio Pro Presets
    { name: 'Dub Rimshot Echo Seed', modeTag: 'pro', overrides: { cutoff: 0.64, resonance: 0.55, pitchEnv: 0.58, ampDecay: 0.16, fmDirt: 0.42 }, filterType: 'bp12' },
    { name: 'Industrial Metal Pipe', modeTag: 'pro', overrides: { cutoff: 0.84, resonance: 0.68, pitchEnv: 0.45, ampDecay: 0.38, fmDirt: 0.85 } },
    { name: 'Jungle Breakbeat Crack', modeTag: 'pro', overrides: { cutoff: 0.76, resonance: 0.4, pitchEnv: 0.52, ampDecay: 0.19, fmDirt: 0.5 } },
    { name: 'Synthwave Gated Tail', modeTag: 'pro', overrides: { cutoff: 0.62, resonance: 0.25, pitchEnv: 0.35, ampDecay: 0.55, fmDirt: 0.34 } },
    { name: 'Modular White Burst', modeTag: 'pro', overrides: { cutoff: 0.9, resonance: 0.48, pitchEnv: 0.15, ampDecay: 0.24, fmDirt: 0.62 }, filterType: 'hp12' },
    { name: 'Detroit Clap Stack', modeTag: 'pro', overrides: { cutoff: 0.72, resonance: 0.35, pitchEnv: 0.3, ampDecay: 0.31, fmDirt: 0.44 } },
    { name: 'Glitch Micro-Snare', modeTag: 'pro', overrides: { cutoff: 0.88, resonance: 0.6, pitchEnv: 0.7, ampDecay: 0.08, fmDirt: 0.72 } },
    { name: 'Deep Wood Rim Knock', modeTag: 'pro', overrides: { cutoff: 0.48, resonance: 0.64, pitchEnv: 0.65, ampDecay: 0.15, fmDirt: 0.28 } },
    { name: 'Bitcrushed Arcade Hit', modeTag: 'pro', overrides: { cutoff: 0.66, resonance: 0.5, pitchEnv: 0.42, ampDecay: 0.27, fmDirt: 0.9 } },
    { name: 'Resonant Filter Sweep Snare', modeTag: 'pro', overrides: { cutoff: 0.54, resonance: 0.78, pitchEnv: 0.8, ampDecay: 0.42, fmDirt: 0.46 } },
  ],
  // Track 2: HI-HAT (20 Presets)
  2: [
    // 10 Play Mode Presets
    { name: '909 Closed Hat', modeTag: 'beginner', overrides: { cutoff: 0.85, resonance: 0.3, ampDecay: 0.09, fmDirt: 0.4 } },
    { name: 'Metallic Shimmer Hat', modeTag: 'beginner', overrides: { cutoff: 0.92, resonance: 0.55, ampDecay: 0.24, fmDirt: 0.65 } },
    { name: 'Dusty Vinyl Tick', modeTag: 'beginner', overrides: { cutoff: 0.6, resonance: 0.2, ampDecay: 0.06, fmDirt: 0.15 } },
    { name: '808 Maraca Shaker', modeTag: 'beginner', overrides: { cutoff: 0.78, resonance: 0.25, ampDecay: 0.12, fmDirt: 0.22 } },
    { name: 'Open Sizzle Cymbal', modeTag: 'beginner', overrides: { cutoff: 0.88, resonance: 0.42, ampDecay: 0.48, fmDirt: 0.55 } },
    { name: 'Chiptune White Tick', modeTag: 'beginner', overrides: { cutoff: 0.94, resonance: 0.18, ampDecay: 0.05, fmDirt: 0.3 } },
    { name: 'Robot Ratchet Hat', modeTag: 'beginner', overrides: { cutoff: 0.82, resonance: 0.6, ampDecay: 0.11, fmDirt: 0.72 } },
    { name: 'Soft Silk Shaker', modeTag: 'beginner', overrides: { cutoff: 0.52, resonance: 0.15, ampDecay: 0.16, fmDirt: 0.1 } },
    { name: 'Bright Disco Open Hat', modeTag: 'beginner', overrides: { cutoff: 0.9, resonance: 0.38, ampDecay: 0.36, fmDirt: 0.45 } },
    { name: 'Starlight Clock Tick', modeTag: 'beginner', overrides: { cutoff: 0.68, resonance: 0.45, ampDecay: 0.07, fmDirt: 0.28 } },
    // 10 Studio Pro Presets
    { name: '6-Osc Metallic Alloy Hat', modeTag: 'pro', overrides: { cutoff: 0.89, resonance: 0.62, ampDecay: 0.14, fmDirt: 0.78 }, filterType: 'hp12' },
    { name: 'Dub Filtered Noise Hat', modeTag: 'pro', overrides: { cutoff: 0.64, resonance: 0.72, ampDecay: 0.18, fmDirt: 0.35 }, filterType: 'bp12' },
    { name: 'Minimal Pinpoint Click', modeTag: 'pro', overrides: { cutoff: 0.96, resonance: 0.4, ampDecay: 0.04, fmDirt: 0.5 } },
    { name: 'Warehouse Ride Bell', modeTag: 'pro', overrides: { cutoff: 0.84, resonance: 0.68, ampDecay: 0.58, fmDirt: 0.82 } },
    { name: 'Tape Saturated Closed Hat', modeTag: 'pro', overrides: { cutoff: 0.72, resonance: 0.32, ampDecay: 0.1, fmDirt: 0.64 } },
    { name: 'FM Ring-Mod Cymbal', modeTag: 'pro', overrides: { cutoff: 0.86, resonance: 0.58, ampDecay: 0.42, fmDirt: 0.92 } },
    { name: 'Crisp Trap Fast Hat', modeTag: 'pro', overrides: { cutoff: 0.93, resonance: 0.35, ampDecay: 0.06, fmDirt: 0.48 } },
    { name: 'Analog Bandpass Cabasa', modeTag: 'pro', overrides: { cutoff: 0.74, resonance: 0.52, ampDecay: 0.15, fmDirt: 0.38 }, filterType: 'bp12' },
    { name: 'Dark Industrial Steam Hat', modeTag: 'pro', overrides: { cutoff: 0.58, resonance: 0.66, ampDecay: 0.28, fmDirt: 0.74 } },
    { name: 'Sustained Shimmer Wash', modeTag: 'pro', overrides: { cutoff: 0.88, resonance: 0.5, ampDecay: 0.75, fmDirt: 0.6 }, sustain: 0.55 },
  ],
  // Track 3: PERC (20 Presets)
  3: [
    // 10 Play Mode Presets
    { name: 'FM Wood Perc', modeTag: 'beginner', overrides: { cutoff: 0.58, resonance: 0.4, fmDirt: 0.55, pitchEnv: 0.45, ampDecay: 0.18 } },
    { name: 'Space Tom Zap', modeTag: 'beginner', overrides: { cutoff: 0.5, resonance: 0.6, fmDirt: 0.3, pitchEnv: 0.8, ampDecay: 0.28 } },
    { name: 'Robot Cowbell', modeTag: 'beginner', overrides: { cutoff: 0.76, resonance: 0.5, fmDirt: 0.78, pitchEnv: 0.15, ampDecay: 0.24 } },
    { name: '808 Conga Slap', modeTag: 'beginner', overrides: { cutoff: 0.46, resonance: 0.35, fmDirt: 0.2, pitchEnv: 0.55, ampDecay: 0.22 } },
    { name: 'Arcade Coin Blip', modeTag: 'beginner', overrides: { cutoff: 0.88, resonance: 0.45, fmDirt: 0.65, pitchEnv: 0.7, ampDecay: 0.16 } },
    { name: 'Jungle Log Drum', modeTag: 'beginner', overrides: { cutoff: 0.42, resonance: 0.52, fmDirt: 0.48, pitchEnv: 0.35, ampDecay: 0.2 } },
    { name: 'Disco Synth Tom', modeTag: 'beginner', overrides: { cutoff: 0.54, resonance: 0.42, fmDirt: 0.25, pitchEnv: 0.88, ampDecay: 0.34 } },
    { name: 'Water Drop Pluck', modeTag: 'beginner', overrides: { cutoff: 0.64, resonance: 0.75, fmDirt: 0.15, pitchEnv: 0.65, ampDecay: 0.15 } },
    { name: 'Triangle Ting Bell', modeTag: 'beginner', overrides: { cutoff: 0.92, resonance: 0.6, fmDirt: 0.82, pitchEnv: 0.1, ampDecay: 0.42 } },
    { name: 'Bongo Groove Hit', modeTag: 'beginner', overrides: { cutoff: 0.52, resonance: 0.38, fmDirt: 0.28, pitchEnv: 0.5, ampDecay: 0.17 } },
    // 10 Studio Pro Presets
    { name: 'Buchla Bongo LPG Ping', modeTag: 'pro', overrides: { cutoff: 0.48, resonance: 0.68, fmDirt: 0.62, pitchEnv: 0.58, ampDecay: 0.21 } },
    { name: 'Dub Clave Resonator', modeTag: 'pro', overrides: { cutoff: 0.72, resonance: 0.74, fmDirt: 0.54, pitchEnv: 0.25, ampDecay: 0.14 }, filterType: 'bp12' },
    { name: 'Metallic FM Anvil', modeTag: 'pro', overrides: { cutoff: 0.82, resonance: 0.58, fmDirt: 0.92, pitchEnv: 0.32, ampDecay: 0.36 } },
    { name: 'Polyrhythmic Kalimba', modeTag: 'pro', overrides: { cutoff: 0.66, resonance: 0.44, fmDirt: 0.46, pitchEnv: 0.2, ampDecay: 0.29 } },
    { name: 'Modular Spring Zap', modeTag: 'pro', overrides: { cutoff: 0.78, resonance: 0.82, fmDirt: 0.7, pitchEnv: 0.92, ampDecay: 0.32 } },
    { name: 'Deep Tribal Sub Tom', modeTag: 'pro', overrides: { cutoff: 0.34, resonance: 0.48, fmDirt: 0.32, pitchEnv: 0.74, ampDecay: 0.44 } },
    { name: 'IDM Micro-Glitch Perc', modeTag: 'pro', overrides: { cutoff: 0.9, resonance: 0.65, fmDirt: 0.86, pitchEnv: 0.85, ampDecay: 0.08 } },
    { name: 'Hollow Bamboo Marimba', modeTag: 'pro', overrides: { cutoff: 0.56, resonance: 0.55, fmDirt: 0.38, pitchEnv: 0.18, ampDecay: 0.23 } },
    { name: 'Acid Rim Ping', modeTag: 'pro', overrides: { cutoff: 0.68, resonance: 0.86, fmDirt: 0.52, pitchEnv: 0.62, ampDecay: 0.19 } },
    { name: 'Sustained Drone Bell', modeTag: 'pro', overrides: { cutoff: 0.74, resonance: 0.5, fmDirt: 0.68, pitchEnv: 0.12, ampDecay: 0.78 }, sustain: 0.6 },
  ],
  // Track 4: BASS (20 Presets)
  4: [
    // 10 Play Mode Presets
    { name: '303 Acid Squelch', modeTag: 'beginner', overrides: { cutoff: 0.52, resonance: 0.72, fmDirt: 0.35, ampDecay: 0.26 }, osc1Wave: 'sawtooth', sustain: 0.55 },
    { name: 'Reese Sub Bass', modeTag: 'beginner', overrides: { cutoff: 0.36, resonance: 0.25, detune: 0.65, ampDecay: 0.55 }, osc1Wave: 'supersaw', sustain: 0.75 },
    { name: 'Funky FM Pluck Bass', modeTag: 'beginner', overrides: { cutoff: 0.64, resonance: 0.42, fmDirt: 0.58, ampDecay: 0.22 }, osc1Wave: 'square', sustain: 0.4 },
    { name: 'Warm Synthwave 80s Bass', modeTag: 'beginner', overrides: { cutoff: 0.48, resonance: 0.32, detune: 0.35, ampDecay: 0.34 }, osc1Wave: 'sawtooth', sustain: 0.65 },
    { name: '8-Bit NES Triangle Sub', modeTag: 'beginner', overrides: { cutoff: 0.7, resonance: 0.15, fmDirt: 0.2, ampDecay: 0.4 }, osc1Wave: 'triangle', sustain: 0.8 },
    { name: 'Bouncy Rubber Bass', modeTag: 'beginner', overrides: { cutoff: 0.44, resonance: 0.58, pitchEnv: 0.55, ampDecay: 0.25 }, osc1Wave: 'square', sustain: 0.5 },
    { name: 'Deep Jungle 808 Glide', modeTag: 'beginner', overrides: { cutoff: 0.28, resonance: 0.22, fmDirt: 0.25, ampDecay: 0.68 }, osc1Wave: 'sine', sustain: 0.85, glideTime: 90 },
    { name: 'Robot Wobble Bass', modeTag: 'beginner', overrides: { cutoff: 0.58, resonance: 0.65, fmDirt: 0.62, detune: 0.45 }, osc1Wave: 'pwm', sustain: 0.7 },
    { name: 'Candy Pop Slap Bass', modeTag: 'beginner', overrides: { cutoff: 0.68, resonance: 0.48, fmDirt: 0.45, ampDecay: 0.2 }, osc1Wave: 'sawtooth', sustain: 0.45 },
    { name: 'Velvet Lo-Fi Sub', modeTag: 'beginner', overrides: { cutoff: 0.24, resonance: 0.18, detune: 0.2, ampDecay: 0.52 }, osc1Wave: 'triangle', sustain: 0.78 },
    // 10 Studio Pro Presets
    { name: 'Devilfish Overdrive 303', modeTag: 'pro', overrides: { cutoff: 0.62, resonance: 0.88, fmDirt: 0.68, pitchEnv: 0.72, ampDecay: 0.32 }, osc1Wave: 'sawtooth', sustain: 0.6, glideTime: 65 },
    { name: 'Neurofunk Modulated Reese', modeTag: 'pro', overrides: { cutoff: 0.46, resonance: 0.54, fmDirt: 0.55, detune: 0.82, ampDecay: 0.74 }, osc1Wave: 'supersaw', sustain: 0.88, glideTime: 80 },
    { name: 'Berlin Dub Sub-Harmonic', modeTag: 'pro', overrides: { cutoff: 0.22, resonance: 0.35, fmDirt: 0.18, detune: 0.25, ampDecay: 0.64 }, osc1Wave: 'sine', sustain: 0.82 },
    { name: 'Darksynth Mid-Grind Bass', modeTag: 'pro', overrides: { cutoff: 0.56, resonance: 0.45, fmDirt: 0.78, detune: 0.52, ampDecay: 0.42 }, osc1Wave: 'sawtooth', sustain: 0.72 },
    { name: 'UK Garage Hollow Square', modeTag: 'pro', overrides: { cutoff: 0.38, resonance: 0.42, fmDirt: 0.48, ampDecay: 0.28 }, osc1Wave: 'square', sustain: 0.55 },
    { name: 'Detroit Electro PWM Bass', modeTag: 'pro', overrides: { cutoff: 0.54, resonance: 0.52, fmDirt: 0.34, detune: 0.38, ampDecay: 0.3 }, osc1Wave: 'pwm', sustain: 0.62 },
    { name: 'West Coast Wavefold Bass', modeTag: 'pro', overrides: { cutoff: 0.66, resonance: 0.6, fmDirt: 0.85, pitchEnv: 0.45, ampDecay: 0.36 }, osc1Wave: 'triangle', sustain: 0.65 },
    { name: 'Minimal Rolling Sub-Line', modeTag: 'pro', overrides: { cutoff: 0.3, resonance: 0.4, fmDirt: 0.22, ampDecay: 0.24 }, osc1Wave: 'sine', sustain: 0.58 },
    { name: 'Sustained Drone Pedal Bass', modeTag: 'pro', overrides: { cutoff: 0.4, resonance: 0.36, fmDirt: 0.32, detune: 0.58, ampDecay: 0.92 }, osc1Wave: 'supersaw', sustain: 0.95, glideTime: 110 },
    { name: 'Industrial FM Growl Bass', modeTag: 'pro', overrides: { cutoff: 0.72, resonance: 0.64, fmDirt: 0.92, detune: 0.48, ampDecay: 0.48 }, osc1Wave: 'sawtooth', sustain: 0.75 },
  ],
  // Track 5: LEAD (20 Presets)
  5: [
    // 10 Play Mode Presets
    { name: 'Hyper SuperSaw Lead', modeTag: 'beginner', overrides: { cutoff: 0.78, resonance: 0.32, detune: 0.6, ampDecay: 0.45 }, osc1Wave: 'supersaw', sustain: 0.75 },
    { name: 'Chiptune Pulse Lead', modeTag: 'beginner', overrides: { cutoff: 0.84, resonance: 0.2, fmDirt: 0.4, detune: 0.1, ampDecay: 0.35 }, osc1Wave: 'square', sustain: 0.7 },
    { name: 'Cyber Sync Lead', modeTag: 'beginner', overrides: { cutoff: 0.68, resonance: 0.55, fmDirt: 0.65, pitchEnv: 0.3, ampDecay: 0.4 }, osc1Wave: 'sawtooth', sustain: 0.68 },
    { name: 'Starlight Flute Lead', modeTag: 'beginner', overrides: { cutoff: 0.56, resonance: 0.25, detune: 0.22, ampDecay: 0.55 }, osc1Wave: 'triangle', sustain: 0.82 },
    { name: 'Neon Outrun Solo', modeTag: 'beginner', overrides: { cutoff: 0.74, resonance: 0.42, detune: 0.48, ampDecay: 0.5 }, osc1Wave: 'pwm', sustain: 0.78, glideTime: 45 },
    { name: 'Bouncy Toy Piano Lead', modeTag: 'beginner', overrides: { cutoff: 0.64, resonance: 0.3, fmDirt: 0.35, ampDecay: 0.28 }, osc1Wave: 'sine', sustain: 0.45 },
    { name: 'Laser Whistle Lead', modeTag: 'beginner', overrides: { cutoff: 0.82, resonance: 0.68, pitchEnv: 0.45, ampDecay: 0.42 }, osc1Wave: 'sine', sustain: 0.75, glideTime: 75 },
    { name: 'Arcade Hero Brass', modeTag: 'beginner', overrides: { cutoff: 0.66, resonance: 0.35, detune: 0.42, ampDecay: 0.48 }, osc1Wave: 'sawtooth', sustain: 0.74 },
    { name: 'Robot Talkbox Lead', modeTag: 'beginner', overrides: { cutoff: 0.72, resonance: 0.74, fmDirt: 0.58, ampDecay: 0.36 }, filterType: 'bp12', sustain: 0.65 },
    { name: 'Dreamy Bell Lead', modeTag: 'beginner', overrides: { cutoff: 0.62, resonance: 0.28, fmDirt: 0.45, ampDecay: 0.6 }, osc1Wave: 'triangle', sustain: 0.7 },
    // 10 Studio Pro Presets
    { name: 'Hoover Rave Dominator', modeTag: 'pro', overrides: { cutoff: 0.76, resonance: 0.48, fmDirt: 0.52, detune: 0.88, pitchEnv: 0.55 }, osc1Wave: 'supersaw', sustain: 0.85, glideTime: 85 },
    { name: 'Acid Screamer 303 Lead', modeTag: 'pro', overrides: { cutoff: 0.8, resonance: 0.86, fmDirt: 0.62, pitchEnv: 0.68, ampDecay: 0.34 }, osc1Wave: 'sawtooth', sustain: 0.65 },
    { name: 'Polymoog Sustaining String', modeTag: 'pro', overrides: { cutoff: 0.64, resonance: 0.32, detune: 0.64, ampDecay: 0.88 }, osc1Wave: 'pwm', sustain: 0.92, glideTime: 55 },
    { name: 'Cross-FM Glass Pluck', modeTag: 'pro', overrides: { cutoff: 0.86, resonance: 0.38, fmDirt: 0.75, detune: 0.28, ampDecay: 0.32 }, osc1Wave: 'sine', sustain: 0.5 },
    { name: 'Boards of Analog Tape Lead', modeTag: 'pro', overrides: { cutoff: 0.46, resonance: 0.44, detune: 0.54, ampDecay: 0.68 }, osc1Wave: 'triangle', sustain: 0.84, glideTime: 65 },
    { name: 'Modular Buchla LPG Lead', modeTag: 'pro', overrides: { cutoff: 0.58, resonance: 0.62, fmDirt: 0.68, pitchEnv: 0.4, ampDecay: 0.38 }, osc1Wave: 'sine', sustain: 0.6 },
    { name: 'Berlin Detuned Techno Horn', modeTag: 'pro', overrides: { cutoff: 0.52, resonance: 0.5, fmDirt: 0.48, detune: 0.76, ampDecay: 0.72 }, osc1Wave: 'supersaw', sustain: 0.86 },
    { name: 'Fifth Interval Prophet Lead', modeTag: 'pro', overrides: { cutoff: 0.7, resonance: 0.4, detune: 0.36, ampDecay: 0.54 }, osc1Wave: 'sawtooth', sustain: 0.78 },
    { name: 'Industrial Distortion Lead', modeTag: 'pro', overrides: { cutoff: 0.84, resonance: 0.7, fmDirt: 0.9, detune: 0.5, ampDecay: 0.46 }, osc1Wave: 'square', sustain: 0.72 },
    { name: 'Infinite Sustain Ribbon Lead', modeTag: 'pro', overrides: { cutoff: 0.68, resonance: 0.45, detune: 0.58, ampDecay: 0.95 }, osc1Wave: 'supersaw', sustain: 0.98, glideTime: 95 },
  ],
  // Track 6: CHORDS (20 Presets)
  6: [
    // 10 Play Mode Presets
    { name: 'Juno Warm Chorus Pad', modeTag: 'beginner', overrides: { cutoff: 0.58, resonance: 0.22, detune: 0.52, ampDecay: 0.72 }, osc1Wave: 'pwm', sustain: 0.85 },
    { name: 'Neon Synthwave Stab', modeTag: 'beginner', overrides: { cutoff: 0.74, resonance: 0.38, detune: 0.4, ampDecay: 0.38 }, osc1Wave: 'sawtooth', sustain: 0.65 },
    { name: 'Glass FM Keys', modeTag: 'beginner', overrides: { cutoff: 0.66, resonance: 0.25, fmDirt: 0.48, ampDecay: 0.52 }, osc1Wave: 'sine', sustain: 0.7 },
    { name: 'Cloudy Dream Pad', modeTag: 'beginner', overrides: { cutoff: 0.44, resonance: 0.18, detune: 0.68, ampDecay: 0.88 }, osc1Wave: 'supersaw', sustain: 0.92 },
    { name: '8-Bit Chiptune Triads', modeTag: 'beginner', overrides: { cutoff: 0.82, resonance: 0.2, detune: 0.15, ampDecay: 0.32 }, osc1Wave: 'square', sustain: 0.68 },
    { name: 'Sunny House Organ', modeTag: 'beginner', overrides: { cutoff: 0.52, resonance: 0.32, fmDirt: 0.28, ampDecay: 0.36 }, osc1Wave: 'triangle', sustain: 0.75 },
    { name: 'Starlight Rhodes EP', modeTag: 'beginner', overrides: { cutoff: 0.48, resonance: 0.2, fmDirt: 0.32, ampDecay: 0.58 }, osc1Wave: 'sine', sustain: 0.78 },
    { name: 'Cosmic Brass Ensemble', modeTag: 'beginner', overrides: { cutoff: 0.64, resonance: 0.35, detune: 0.48, ampDecay: 0.64 }, osc1Wave: 'sawtooth', sustain: 0.82 },
    { name: 'Candy Pop Pluck Chords', modeTag: 'beginner', overrides: { cutoff: 0.76, resonance: 0.42, detune: 0.3, ampDecay: 0.26 }, osc1Wave: 'pwm', sustain: 0.55 },
    { name: 'Velvet Lo-Fi Tape Keys', modeTag: 'beginner', overrides: { cutoff: 0.36, resonance: 0.24, detune: 0.56, ampDecay: 0.62 }, osc1Wave: 'triangle', sustain: 0.8 },
    // 10 Studio Pro Presets
    { name: 'Basic Channel Dub Chord', modeTag: 'pro', overrides: { cutoff: 0.46, resonance: 0.68, fmDirt: 0.36, detune: 0.42, ampDecay: 0.28 }, filterType: 'bp12', sustain: 0.62 },
    { name: 'Detroit Minor 9th Stab', modeTag: 'pro', overrides: { cutoff: 0.62, resonance: 0.54, fmDirt: 0.28, detune: 0.58, ampDecay: 0.44 }, osc1Wave: 'supersaw', sustain: 0.75 },
    { name: 'CS-80 Blade Runner Swell', modeTag: 'pro', overrides: { cutoff: 0.56, resonance: 0.38, detune: 0.74, ampDecay: 0.94 }, osc1Wave: 'sawtooth', sustain: 0.96 },
    { name: 'DX7 Crystalline E-Piano', modeTag: 'pro', overrides: { cutoff: 0.78, resonance: 0.22, fmDirt: 0.64, detune: 0.24, ampDecay: 0.56 }, osc1Wave: 'sine', sustain: 0.72 },
    { name: 'Deep House Filtered Organ', modeTag: 'pro', overrides: { cutoff: 0.42, resonance: 0.46, fmDirt: 0.38, detune: 0.2, ampDecay: 0.34 }, osc1Wave: 'square', sustain: 0.7 },
    { name: 'Ambient Cathedral Drone Pad', modeTag: 'pro', overrides: { cutoff: 0.38, resonance: 0.32, detune: 0.82, ampDecay: 0.98 }, osc1Wave: 'supersaw', sustain: 0.98 },
    { name: 'Formant Vocal Choir Pad', modeTag: 'pro', overrides: { cutoff: 0.54, resonance: 0.72, detune: 0.66, ampDecay: 0.84 }, filterType: 'bp12', sustain: 0.9 },
    { name: 'Broken Tape Mellotron', modeTag: 'pro', overrides: { cutoff: 0.4, resonance: 0.4, fmDirt: 0.44, detune: 0.6, ampDecay: 0.76 }, osc1Wave: 'triangle', sustain: 0.84 },
    { name: 'Progressive Pluck Poly-Stab', modeTag: 'pro', overrides: { cutoff: 0.7, resonance: 0.48, detune: 0.46, ampDecay: 0.32 }, osc1Wave: 'pwm', sustain: 0.64 },
    { name: 'Harmonic Swarm Sustain Pad', modeTag: 'pro', overrides: { cutoff: 0.5, resonance: 0.36, fmDirt: 0.3, detune: 0.86, ampDecay: 0.96 }, osc1Wave: 'supersaw', sustain: 0.98 },
  ],
  // Track 7: ARP / FX (20 Presets)
  7: [
    // 10 Play Mode Presets
    { name: 'Crystal Pluck Arp', modeTag: 'beginner', overrides: { cutoff: 0.76, resonance: 0.35, ampDecay: 0.22, detune: 0.3 }, sustain: 0.5 },
    { name: 'Laser Riser FX', modeTag: 'beginner', overrides: { cutoff: 0.88, resonance: 0.68, pitchEnv: 0.7, fmDirt: 0.5, ampDecay: 0.45 }, sustain: 0.75 },
    { name: 'Starlight Bell Arp', modeTag: 'beginner', overrides: { cutoff: 0.7, resonance: 0.28, fmDirt: 0.42, ampDecay: 0.48 }, osc1Wave: 'sine', sustain: 0.68 },
    { name: '8-Bit Gameboy Coin Arp', modeTag: 'beginner', overrides: { cutoff: 0.9, resonance: 0.2, fmDirt: 0.35, ampDecay: 0.16 }, osc1Wave: 'square', sustain: 0.45 },
    { name: 'Cosmic Bubble Sequence', modeTag: 'beginner', overrides: { cutoff: 0.62, resonance: 0.72, pitchEnv: 0.5, ampDecay: 0.2 }, osc1Wave: 'triangle', sustain: 0.5 },
    { name: 'Neon Synthwave Runner Arp', modeTag: 'beginner', overrides: { cutoff: 0.74, resonance: 0.42, detune: 0.45, ampDecay: 0.26 }, osc1Wave: 'sawtooth', sustain: 0.6 },
    { name: 'Robot Telemetry Blips', modeTag: 'beginner', overrides: { cutoff: 0.84, resonance: 0.6, fmDirt: 0.72, ampDecay: 0.14 }, osc1Wave: 'pwm', sustain: 0.4 },
    { name: 'Magic Harp Glissando', modeTag: 'beginner', overrides: { cutoff: 0.66, resonance: 0.24, detune: 0.35, ampDecay: 0.55 }, osc1Wave: 'triangle', sustain: 0.72 },
    { name: 'Cyber Jungle Siren FX', modeTag: 'beginner', overrides: { cutoff: 0.78, resonance: 0.64, pitchEnv: 0.85, ampDecay: 0.6 }, osc1Wave: 'sawtooth', sustain: 0.8 },
    { name: 'Music Box Lullaby Arp', modeTag: 'beginner', overrides: { cutoff: 0.64, resonance: 0.22, fmDirt: 0.38, ampDecay: 0.52 }, osc1Wave: 'sine', sustain: 0.65 },
    // 10 Studio Pro Presets
    { name: 'Tangerine Berlin Sequencer', modeTag: 'pro', overrides: { cutoff: 0.68, resonance: 0.56, fmDirt: 0.34, detune: 0.42, ampDecay: 0.28 }, osc1Wave: 'sawtooth', sustain: 0.62 },
    { name: 'Buchla 259 Complex FM Arp', modeTag: 'pro', overrides: { cutoff: 0.72, resonance: 0.62, fmDirt: 0.84, pitchEnv: 0.48, ampDecay: 0.24 }, osc1Wave: 'sine', sustain: 0.55 },
    { name: 'Acid 303 Hypnotic Line', modeTag: 'pro', overrides: { cutoff: 0.6, resonance: 0.86, fmDirt: 0.45, pitchEnv: 0.65, ampDecay: 0.22 }, osc1Wave: 'square', sustain: 0.58 },
    { name: 'Shimmering SuperSaw Pluck', modeTag: 'pro', overrides: { cutoff: 0.82, resonance: 0.38, detune: 0.72, ampDecay: 0.36 }, osc1Wave: 'supersaw', sustain: 0.7 },
    { name: 'Dub Delay Feedback Ping', modeTag: 'pro', overrides: { cutoff: 0.58, resonance: 0.76, fmDirt: 0.4, ampDecay: 0.18 }, filterType: 'bp12', sustain: 0.5 },
    { name: 'Modular S&H Computer Bleeps', modeTag: 'pro', overrides: { cutoff: 0.86, resonance: 0.7, fmDirt: 0.78, pitchEnv: 0.75, ampDecay: 0.15 }, osc1Wave: 'square', sustain: 0.45 },
    { name: 'Karplus-Strong Metallic String', modeTag: 'pro', overrides: { cutoff: 0.78, resonance: 0.52, fmDirt: 0.66, detune: 0.25, ampDecay: 0.42 }, osc1Wave: 'triangle', sustain: 0.64 },
    { name: 'Dark Sci-Fi Drone Swell FX', modeTag: 'pro', overrides: { cutoff: 0.48, resonance: 0.58, fmDirt: 0.62, detune: 0.78, ampDecay: 0.9 }, osc1Wave: 'supersaw', sustain: 0.92 },
    { name: 'Glitch Bit-Modulated Arp', modeTag: 'pro', overrides: { cutoff: 0.9, resonance: 0.64, fmDirt: 0.92, ampDecay: 0.19 }, osc1Wave: 'pwm', sustain: 0.52 },
    { name: 'Celestial Harmonic Sustain', modeTag: 'pro', overrides: { cutoff: 0.74, resonance: 0.34, fmDirt: 0.48, detune: 0.68, ampDecay: 0.92 }, osc1Wave: 'supersaw', sustain: 0.95 },
  ],
};

export function applyPresetItemToSynth(
  baseSynth: ProSynthConfig,
  preset: TrackBankPresetItem
): ProSynthConfig {
  let next = {
    ...baseSynth,
    osc1: { ...baseSynth.osc1 },
    osc2: { ...baseSynth.osc2 },
    filter: { ...baseSynth.filter },
    ampEnv: { ...baseSynth.ampEnv },
    voice: { ...baseSynth.voice },
  };
  for (const [k, v] of Object.entries(preset.overrides)) {
    if (typeof v === 'number') {
      next = applyBeginnerMacroToSynth(
        next,
        k as keyof ProSynthConfig['beginnerMacros'],
        v
      );
    }
  }
  if (preset.osc1Wave) next.osc1.wave = preset.osc1Wave;
  if (preset.osc2Wave) next.osc2.wave = preset.osc2Wave;
  if (preset.filterType) next.filter.type = preset.filterType;
  if (typeof preset.sustain === 'number') next.ampEnv.sustain = preset.sustain;
  if (typeof preset.glideTime === 'number') next.voice.glideTime = preset.glideTime;
  return next;
}

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
  modeTag: 'beginner' | 'pro';
  bpm: number;
  rootNote: number;
  scaleName: string;
  swing: number;
  presetIndices?: [number, number, number, number, number, number, number, number];
  kickSteps?: number[];
  snareSteps?: number[];
  hatSteps?: number[];
  percSteps?: number[];
  bassNotes?: { step: number; degree: number; len?: number }[];
  leadNotes?: { step: number; degree: number; len?: number }[];
  chordNotes?: { step: number; degree: number; len?: number }[];
  arpSteps?: number[];
}

/**
 * 20 Sample Patches for Groovebox v4:
 * - 10 Sample Patches for PLAY (BEGINNER) Mode
 * - 10 Sample Patches for STUDIO (PRO) Mode
 */
export const STARTER_PROJECT_SPECS: StarterProjectSpec[] = [
  // ==========================================================================
  // 10 PLAY (BEGINNER) MODE SAMPLE PATCHES
  // ==========================================================================
  {
    id: 'space-mission',
    name: 'Space Mission',
    subtitle: 'Cosmic Synthwave & Sustained Chords',
    modeTag: 'beginner',
    bpm: 120,
    rootNote: 0, // C
    scaleName: 'Minor',
    swing: 0,
    presetIndices: [0, 0, 0, 0, 3, 0, 0, 0],
    bassNotes: [
      { step: 0, degree: 0, len: 4 },
      { step: 4, degree: 2, len: 4 },
      { step: 8, degree: 3, len: 4 },
      { step: 12, degree: 4, len: 4 },
    ],
    leadNotes: [
      { step: 0, degree: 4, len: 4 },
      { step: 6, degree: 2, len: 2 },
      { step: 8, degree: 0, len: 4 },
      { step: 12, degree: 5, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 5, len: 8 },
    ],
  },
  {
    id: '8bit-boss',
    name: '8-Bit Boss Battle',
    subtitle: 'High-Energy Chiptune Arcade Action',
    modeTag: 'beginner',
    bpm: 140,
    rootNote: 2, // D
    scaleName: 'Harmonic Minor',
    swing: 0,
    presetIndices: [2, 3, 5, 4, 4, 1, 4, 3],
    kickSteps: [0, 3, 6, 8, 11, 14],
    bassNotes: [
      { step: 0, degree: 0, len: 2 },
      { step: 2, degree: 4, len: 2 },
      { step: 4, degree: 3, len: 4 },
      { step: 8, degree: 2, len: 4 },
      { step: 12, degree: 6, len: 4 },
    ],
  },
  {
    id: 'robot-dance',
    name: 'Robot Dance',
    subtitle: 'Electro Funk & Acid Squelch',
    modeTag: 'beginner',
    bpm: 126,
    rootNote: 9, // A
    scaleName: 'Dorian',
    swing: 0.24,
    presetIndices: [4, 8, 6, 2, 7, 8, 5, 6],
    kickSteps: [0, 6, 10],
    snareSteps: [4, 12],
  },
  {
    id: 'cyber-jungle',
    name: 'Cyber Jungle',
    subtitle: 'Breakbeat Syncopation & 808 Sub Glide',
    modeTag: 'beginner',
    bpm: 156,
    rootNote: 5, // F
    scaleName: 'Minor Pentatonic',
    swing: 0.15,
    presetIndices: [0, 2, 1, 5, 6, 2, 3, 8],
    kickSteps: [0, 6, 10],
    snareSteps: [4, 11, 12],
    bassNotes: [
      { step: 0, degree: 0, len: 6 },
      { step: 6, degree: 3, len: 4 },
      { step: 10, degree: 2, len: 6 },
    ],
  },
  {
    id: 'neon-highway',
    name: 'Neon Highway',
    subtitle: 'Outrun Night Drive & Analog Pads',
    modeTag: 'beginner',
    bpm: 110,
    rootNote: 4, // E
    scaleName: 'Minor',
    swing: 0.1,
    presetIndices: [7, 5, 8, 6, 3, 4, 1, 5],
    chordNotes: [{ step: 0, degree: 0, len: 16 }],
    leadNotes: [
      { step: 0, degree: 4, len: 6 },
      { step: 8, degree: 2, len: 8 },
    ],
  },
  {
    id: 'starlight-chill',
    name: 'Starlight Chill',
    subtitle: 'Lo-Fi Dream Beats & Warm Sustained Keys',
    modeTag: 'beginner',
    bpm: 92,
    rootNote: 7, // G
    scaleName: 'Major',
    swing: 0.35,
    presetIndices: [8, 7, 2, 7, 9, 3, 6, 9],
    kickSteps: [0, 7, 8],
    snareSteps: [4, 12],
    bassNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 4, len: 8 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 3, len: 8 },
    ],
  },
  {
    id: 'pixel-kart',
    name: 'Pixel Kart Racer',
    subtitle: 'Turbo Rainbow Road Melodic Bounce',
    modeTag: 'beginner',
    bpm: 132,
    rootNote: 0, // C
    scaleName: 'Major Pentatonic',
    swing: 0.08,
    presetIndices: [5, 3, 3, 4, 2, 5, 8, 3],
    leadNotes: [
      { step: 0, degree: 0, len: 2 },
      { step: 2, degree: 2, len: 2 },
      { step: 4, degree: 4, len: 4 },
      { step: 8, degree: 5, len: 4 },
      { step: 12, degree: 4, len: 4 },
    ],
  },
  {
    id: 'candy-pop',
    name: 'Candy Pop Arcade',
    subtitle: 'Bubblegum Plucks & Funky Slap Bass',
    modeTag: 'beginner',
    bpm: 118,
    rootNote: 5, // F
    scaleName: 'Major',
    swing: 0.18,
    presetIndices: [5, 9, 8, 8, 8, 9, 8, 0],
    kickSteps: [0, 4, 8, 12],
    snareSteps: [4, 12],
  },
  {
    id: 'dino-stomp',
    name: 'Dino Stomp Party',
    subtitle: 'Booming Prehistoric Sub & Jungle Toms',
    modeTag: 'beginner',
    bpm: 105,
    rootNote: 2, // D
    scaleName: 'Minor Pentatonic',
    swing: 0.22,
    presetIndices: [9, 4, 3, 5, 5, 7, 7, 4],
    kickSteps: [0, 3, 8, 11],
    percSteps: [2, 6, 7, 10, 14, 15],
  },
  {
    id: 'galaxy-lullaby',
    name: 'Galaxy Lullaby',
    subtitle: 'Zero-Gravity Music Box & Floating Pads',
    modeTag: 'beginner',
    bpm: 84,
    rootNote: 10, // A#
    scaleName: 'Major',
    swing: 0.12,
    presetIndices: [3, 7, 9, 7, 9, 3, 3, 9],
    kickSteps: [0, 8],
    snareSteps: [12],
    bassNotes: [{ step: 0, degree: 0, len: 16 }],
    chordNotes: [{ step: 0, degree: 0, len: 16 }],
    leadNotes: [
      { step: 0, degree: 4, len: 8 },
      { step: 8, degree: 2, len: 8 },
    ],
  },

  // ==========================================================================
  // 10 STUDIO (PRO) MODE SAMPLE PATCHES
  // ==========================================================================
  {
    id: 'berlin-dub-techno',
    name: 'Berlin Dub Techno',
    subtitle: 'Basic Channel Filtered Chords & Deep Sub',
    modeTag: 'pro',
    bpm: 122,
    rootNote: 0, // C
    scaleName: 'Minor',
    swing: 0.16,
    presetIndices: [12, 10, 11, 11, 12, 16, 10, 14],
    kickSteps: [0, 4, 8, 12],
    snareSteps: [4, 12],
    bassNotes: [
      { step: 0, degree: 0, len: 6 },
      { step: 6, degree: 0, len: 2 },
      { step: 8, degree: 4, len: 8 },
    ],
    chordNotes: [
      { step: 2, degree: 0, len: 6 },
      { step: 11, degree: 3, len: 5 },
    ],
  },
  {
    id: 'acid-warehouse-303',
    name: 'Acid Warehouse 303',
    subtitle: 'Devilfish Overdrive Squelch & 909 Pound',
    modeTag: 'pro',
    bpm: 136,
    rootNote: 4, // E
    scaleName: 'Phrygian',
    swing: 0.08,
    presetIndices: [15, 15, 10, 18, 10, 11, 11, 12],
    kickSteps: [0, 4, 8, 12],
    hatSteps: [2, 6, 10, 14],
    bassNotes: [
      { step: 0, degree: 0, len: 3 },
      { step: 3, degree: 1, len: 1 },
      { step: 4, degree: 0, len: 2 },
      { step: 6, degree: 4, len: 2 },
      { step: 8, degree: 1, len: 4 },
      { step: 12, degree: 0, len: 4 },
    ],
  },
  {
    id: 'idm-polyrhythm-lab',
    name: 'IDM Polyrhythm Lab',
    subtitle: 'Buchla LPG Pings, Glitch Percussion & Braindance Pads',
    modeTag: 'pro',
    bpm: 128,
    rootNote: 9, // A
    scaleName: 'Dorian',
    swing: 0.12,
    presetIndices: [14, 16, 15, 16, 16, 14, 17, 15],
    kickSteps: [0, 5, 10, 13],
    snareSteps: [4, 9, 12, 15],
    chordNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 2, len: 8 },
    ],
  },
  {
    id: 'deep-house-stabs',
    name: 'Deep House Chord Stabs',
    subtitle: 'Detroit Minor 9th Chords & Swung Organ',
    modeTag: 'pro',
    bpm: 120,
    rootNote: 5, // F
    scaleName: 'Minor',
    swing: 0.32,
    presetIndices: [10, 15, 17, 13, 14, 13, 11, 13],
    kickSteps: [0, 4, 8, 12],
    snareSteps: [4, 12],
    hatSteps: [2, 6, 10, 14],
    bassNotes: [
      { step: 0, degree: 0, len: 3 },
      { step: 3, degree: 2, len: 3 },
      { step: 6, degree: 4, len: 2 },
      { step: 8, degree: 3, len: 4 },
      { step: 12, degree: 4, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 4 },
      { step: 6, degree: 2, len: 4 },
      { step: 12, degree: 4, len: 4 },
    ],
  },
  {
    id: 'detroit-electro-funk',
    name: 'Detroit Electro Funk',
    subtitle: 'Drexciyan Syncopated 808s & PWM Leads',
    modeTag: 'pro',
    bpm: 130,
    rootNote: 7, // G
    scaleName: 'Minor',
    swing: 0.18,
    presetIndices: [17, 15, 10, 14, 15, 12, 13, 10],
    kickSteps: [0, 6, 10],
    snareSteps: [4, 12],
    bassNotes: [
      { step: 0, degree: 0, len: 4 },
      { step: 4, degree: 3, len: 2 },
      { step: 6, degree: 4, len: 4 },
      { step: 10, degree: 2, len: 6 },
    ],
  },
  {
    id: 'cyberpunk-darksynth',
    name: 'Cyberpunk Darksynth',
    subtitle: 'Mid-Grind Distortion Bass & CS-80 Brass Swells',
    modeTag: 'pro',
    bpm: 106,
    rootNote: 2, // D
    scaleName: 'Harmonic Minor',
    swing: 0.05,
    presetIndices: [11, 11, 18, 12, 13, 18, 12, 17],
    kickSteps: [0, 4, 8, 12],
    snareSteps: [4, 12],
    bassNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 5, len: 4 },
      { step: 12, degree: 4, len: 4 },
    ],
    leadNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 4, len: 8 },
    ],
    chordNotes: [{ step: 0, degree: 0, len: 16 }],
  },
  {
    id: 'ambient-modular-drift',
    name: 'Ambient Modular Drift',
    subtitle: 'Cathedral Sustain Pads & Buchla Plucks',
    modeTag: 'pro',
    bpm: 78,
    rootNote: 3, // D#
    scaleName: 'Dorian',
    swing: 0.1,
    presetIndices: [12, 17, 19, 19, 18, 19, 15, 19],
    kickSteps: [0, 10],
    snareSteps: [12],
    bassNotes: [{ step: 0, degree: 0, len: 16 }],
    leadNotes: [
      { step: 0, degree: 4, len: 8 },
      { step: 8, degree: 6, len: 8 },
    ],
    chordNotes: [{ step: 0, degree: 0, len: 16 }],
  },
  {
    id: 'breakbeat-chaos-160',
    name: 'Breakbeat Chaos 160',
    subtitle: 'Neurofunk Reese Sustains & Sliced Jungle Snares',
    modeTag: 'pro',
    bpm: 160,
    rootNote: 5, // F
    scaleName: 'Minor',
    swing: 0.1,
    presetIndices: [19, 12, 16, 15, 11, 10, 16, 18],
    kickSteps: [0, 10],
    snareSteps: [4, 11, 12, 15],
    bassNotes: [
      { step: 0, degree: 0, len: 10 },
      { step: 10, degree: 2, len: 6 },
    ],
  },
  {
    id: 'minimal-microhouse',
    name: 'Minimal Microhouse',
    subtitle: 'Pinpoint Clicks, Sub-Rollers & Vocal Formants',
    modeTag: 'pro',
    bpm: 124,
    rootNote: 9, // A
    scaleName: 'Minor Pentatonic',
    swing: 0.28,
    presetIndices: [16, 17, 12, 10, 17, 15, 16, 14],
    kickSteps: [0, 4, 8, 12],
    snareSteps: [4, 12],
    hatSteps: [2, 6, 10, 14],
  },
  {
    id: 'hypnotic-prog-arp',
    name: 'Hypnotic Progressive Arp',
    subtitle: 'Rolling Berlin Sequencer & Sustained Pedal Bass',
    modeTag: 'pro',
    bpm: 123,
    rootNote: 11, // B
    scaleName: 'Minor',
    swing: 0.12,
    presetIndices: [10, 13, 14, 13, 18, 17, 19, 10],
    kickSteps: [0, 4, 8, 12],
    bassNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 5, len: 8 },
    ],
    chordNotes: [{ step: 0, degree: 0, len: 16 }],
    arpSteps: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14],
  },

  // ==========================================================================
  // 5 HIP HOP FACTORY PRESET BEATS
  // ==========================================================================
  {
    id: 'hiphop-boom-bap-90s',
    name: '90s Boom Bap Golden Era',
    subtitle: 'MPC 58% Swing, Vinyl Rhodes & Heavy Snare Knock',
    modeTag: 'beginner',
    bpm: 92,
    rootNote: 0, // C
    scaleName: 'Dorian',
    swing: 0.32,
    presetIndices: [0, 0, 2, 0, 2, 0, 9, 7], // 808 Sub, Crisp Snare, Dusty Vinyl Hat, FM Wood, Funky Bass, Rhodes EP
    kickSteps: [0, 6, 8, 11],
    snareSteps: [4, 12],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
    percSteps: [3, 7, 11, 15],
    bassNotes: [
      { step: 0, degree: 0, len: 4 },
      { step: 6, degree: 0, len: 2 },
      { step: 8, degree: 2, len: 3 },
      { step: 11, degree: 4, len: 4 },
    ],
    leadNotes: [
      { step: 4, degree: 4, len: 4 },
      { step: 10, degree: 6, len: 2 },
      { step: 12, degree: 5, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 6 },
      { step: 8, degree: 3, len: 6 },
    ],
    arpSteps: [2, 6, 10, 14],
  },
  {
    id: 'hiphop-lofi-chillhop',
    name: 'Lo-Fi Chillhop Study Beat',
    subtitle: 'Drunken 45% Swing, Warm Tape Keys & Mellow Sub',
    modeTag: 'beginner',
    bpm: 84,
    rootNote: 5, // F
    scaleName: 'Minor Pentatonic',
    swing: 0.45,
    presetIndices: [8, 7, 2, 7, 9, 3, 9, 9], // Starlight LoFi Kick, Warm Brush Snare, Dusty Vinyl, Water Drop, Velvet LoFi Sub, Velvet Tape Keys, Music Box Arp
    kickSteps: [0, 5, 8, 14],
    snareSteps: [4, 12],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
    percSteps: [2, 7, 10, 15],
    bassNotes: [
      { step: 0, degree: 0, len: 5 },
      { step: 5, degree: 2, len: 3 },
      { step: 8, degree: 3, len: 6 },
      { step: 14, degree: 4, len: 2 },
    ],
    leadNotes: [
      { step: 0, degree: 2, len: 4 },
      { step: 6, degree: 4, len: 4 },
      { step: 12, degree: 1, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 2, len: 8 },
    ],
    arpSteps: [0, 3, 6, 9, 12, 15],
  },
  {
    id: 'hiphop-trap-808-heat',
    name: 'Trap 808 Night Heat',
    subtitle: 'Sliding Sub Bass, Rapidfire Hats & Dark Minor Bell',
    modeTag: 'pro',
    bpm: 140,
    rootNote: 1, // C#
    scaleName: 'Harmonic Minor',
    swing: 0.05,
    presetIndices: [0, 4, 16, 4, 6, 9, 1, 0], // 808 Sub Boom, 808 Clap, Crisp Trap Fast Hat, Jungle 808 Glide Bass, Dreamy Bell Lead
    kickSteps: [0, 7, 10],
    snareSteps: [4, 12],
    hatSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    percSteps: [3, 9, 11, 14],
    bassNotes: [
      { step: 0, degree: 0, len: 7 },
      { step: 7, degree: 2, len: 3 },
      { step: 10, degree: 5, len: 6 },
    ],
    leadNotes: [
      { step: 0, degree: 4, len: 4 },
      { step: 4, degree: 3, len: 4 },
      { step: 8, degree: 2, len: 4 },
      { step: 12, degree: 6, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 4, len: 8 },
    ],
    arpSteps: [0, 4, 8, 12],
  },
  {
    id: 'hiphop-west-coast-gfunk',
    name: 'West Coast G-Funk Lowrider',
    subtitle: 'Classic Sine Whistle Lead, Punchy Kick & Syncopated Bass',
    modeTag: 'beginner',
    bpm: 96,
    rootNote: 2, // D
    scaleName: 'Minor Pentatonic',
    swing: 0.22,
    presetIndices: [1, 4, 0, 3, 2, 2, 0, 0], // 909 Punch, 808 Clap, 909 Hat, Funky FM Bass, Laser Whistle Lead, Juno Chorus Pad
    kickSteps: [0, 3, 6, 8, 14],
    snareSteps: [4, 12],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
    percSteps: [4, 7, 12, 15],
    bassNotes: [
      { step: 0, degree: 0, len: 3 },
      { step: 3, degree: 0, len: 3 },
      { step: 6, degree: 2, len: 2 },
      { step: 8, degree: 3, len: 4 },
      { step: 14, degree: 4, len: 2 },
    ],
    leadNotes: [
      { step: 0, degree: 4, len: 6 },
      { step: 8, degree: 3, len: 4 },
      { step: 12, degree: 4, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 3, len: 8 },
    ],
    arpSteps: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  {
    id: 'hiphop-underground-dilla-swing',
    name: 'Dilla MPC Drunken Soul',
    subtitle: 'Unquantized Loose MPC Swing, Warm Sub & Smoky Keys',
    modeTag: 'pro',
    bpm: 88,
    rootNote: 10, // A#
    scaleName: 'Dorian',
    swing: 0.48,
    presetIndices: [6, 0, 14, 0, 4, 4, 9, 7], // Retro CR-78, Crisp Snare, Tape Saturated Hat, Funky Bass, Rhodes EP
    kickSteps: [0, 5, 8, 10, 13],
    snareSteps: [4, 12],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
    percSteps: [1, 6, 9, 14],
    bassNotes: [
      { step: 0, degree: 0, len: 5 },
      { step: 5, degree: 2, len: 3 },
      { step: 8, degree: 3, len: 2 },
      { step: 10, degree: 4, len: 3 },
      { step: 13, degree: 0, len: 3 },
    ],
    leadNotes: [
      { step: 2, degree: 4, len: 4 },
      { step: 8, degree: 2, len: 4 },
      { step: 12, degree: 0, len: 4 },
    ],
    chordNotes: [
      { step: 0, degree: 0, len: 6 },
      { step: 8, degree: 2, len: 6 },
    ],
    arpSteps: [1, 3, 5, 7, 9, 11, 13, 15],
  },
];

export function createStarterProject(specId: string = 'space-mission'): GrooveboxProject {
  const spec =
    STARTER_PROJECT_SPECS.find((s) => s.id === specId) ??
    STARTER_PROJECT_SPECS[0];

  const tracks: TrackConfig[] = TRACK_IDENTITIES.map((meta) => {
    const presetList = TRACK_PRESET_BANKS[meta.index] ?? [];
    const targetPresetIdx = spec.presetIndices?.[meta.index] ?? 0;
    const chosenPreset = presetList[targetPresetIdx] ?? presetList[0];
    const baseSynth = createTrackDefaultSynth(meta.index);
    const configuredSynth = chosenPreset
      ? applyPresetItemToSynth(baseSynth, chosenPreset)
      : baseSynth;

    return {
      index: meta.index,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      isDrum: meta.isDrum,
      presetName: chosenPreset?.name ?? `${meta.name} Init`,
      synth: configuredSynth,
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
    kickSteps: spec.kickSteps ?? [0, 4, 8, 12],
    snareSteps: spec.snareSteps ?? [4, 12],
    hatSteps: spec.hatSteps ?? [0, 2, 4, 6, 8, 10, 12, 14],
    percSteps: spec.percSteps ?? [3, 7, 11, 15],
    bassNotes: spec.bassNotes ?? [
      { step: 0, degree: 0, len: 4 },
      { step: 4, degree: 2, len: 4 },
      { step: 8, degree: 3, len: 4 },
      { step: 12, degree: 4, len: 4 },
    ],
    leadNotes: spec.leadNotes ?? [
      { step: 0, degree: 4, len: 4 },
      { step: 4, degree: 2, len: 4 },
      { step: 8, degree: 0, len: 4 },
      { step: 12, degree: 5, len: 4 },
    ],
    chordNotes: spec.chordNotes ?? [
      { step: 0, degree: 0, len: 8 },
      { step: 8, degree: 5, len: 8 },
    ],
    arpSteps: spec.arpSteps ?? [0, 2, 4, 6, 8, 10, 12, 14],
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

  const isLowSpecDevice =
    typeof navigator !== 'undefined' &&
    ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      /Android|CrOS|Chromebook|tablet/i.test(navigator.userAgent));

  return {
    id: `proj_${spec.id}`,
    name: spec.name,
    updatedAt: Date.now(),
    mode: spec.modeTag,
    ecoMode: isLowSpecDevice,
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
