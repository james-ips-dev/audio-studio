import type { ScaleId } from '../types';

export interface ScaleDefinition {
  id: ScaleId;
  name: string;
  nameJa: string;
  description: string;
  descriptionJa: string;
  semitones: number[];
  jiRatios: number[];
  degreeLabels: string[];
}

export const RILEY_SCALES: Record<ScaleId, ScaleDefinition> = {
  mixolydian: {
    id: 'mixolydian',
    name: 'Mixolydian (In C / Shri Camel)',
    nameJa: 'ミクソリディアン（In C / シュリ・キャメル）',
    description: 'Bright minimalist modal scale with harmonic 7th (7/4 ratio in JI)',
    descriptionJa: '純正律7/4を含む明るく催眠的なミニマル・モード音階',
    semitones: [0, 2, 4, 5, 7, 9, 10],
    jiRatios: [1 / 1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 7 / 4],
    degreeLabels: ['I', 'II', 'III', 'IV', 'V', 'VI', 'bVII'],
  },
  dorian: {
    id: 'dorian',
    name: 'Dorian (Curved Air / Poppy Nogood)',
    nameJa: 'ドリアン（カーヴド・エア / ポピー・ノーグッド）',
    description: 'Symmetric minor mode with raised 6th (6/5 minor third, 5/3 major sixth)',
    descriptionJa: '純正短3度(6/5)と長6度(5/3)を持つ対称的なドリアン旋法',
    semitones: [0, 2, 3, 5, 7, 9, 10],
    jiRatios: [1 / 1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 9 / 5],
    degreeLabels: ['I', 'II', 'bIII', 'IV', 'V', 'VI', 'bVII'],
  },
  pentatonic: {
    id: 'pentatonic',
    name: 'Major Pentatonic (Olson III / Kyoto)',
    nameJa: 'メジャー・ペンタトニック（五音音階 / 京都）',
    description: 'Consonant 5-tone harmonic scale for interlocking bell and choir canons',
    descriptionJa: '倍音共鳴とポリメトリック・カノンに最適な5音ペンタトニック',
    semitones: [0, 2, 4, 7, 9],
    jiRatios: [1 / 1, 9 / 8, 5 / 4, 3 / 2, 5 / 3],
    degreeLabels: ['1', '2', '3', '5', '6'],
  },
  bhairav: {
    id: 'bhairav',
    name: 'Raga Bhairav (Persian Dervishes)',
    nameJa: 'ラーガ・バイラヴ（ペルシャ旋回舞踏）',
    description: 'Hindustani morning raga with microtonal flat 2nd (16/15), flat 6th (8/5), and major 7th (15/8)',
    descriptionJa: '微分音程（16/15, 8/5, 15/8）を持つ北インド古典ラーガ旋法',
    semitones: [0, 1, 4, 5, 7, 8, 11],
    jiRatios: [1 / 1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 15 / 8],
    degreeLabels: ['Sa', 're', 'Ga', 'Ma', 'Pa', 'dha', 'Ni'],
  },
};

export const SCALE_IDS: ScaleId[] = [
  'mixolydian',
  'dorian',
  'pentatonic',
  'bhairav',
];

export interface RootNoteOption {
  midi: number; // Base C3 = 48 .. B3 = 59 (or C4 = 60 .. B4 = 71; we use 60..71 standard middle octave)
  name: string;
}

export const ROOT_NOTE_OPTIONS: RootNoteOption[] = [
  { midi: 60, name: 'C' },
  { midi: 61, name: 'C#' },
  { midi: 62, name: 'D' },
  { midi: 63, name: 'Eb' },
  { midi: 64, name: 'E' },
  { midi: 65, name: 'F' },
  { midi: 66, name: 'F#' },
  { midi: 67, name: 'G' },
  { midi: 68, name: 'Ab' },
  { midi: 69, name: 'A' },
  { midi: 70, name: 'Bb' },
  { midi: 71, name: 'B' },
];

const NOTE_NAMES_12 = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/**
 * Section 4: Exact Frequency Quantization (Just Intonation vs. 12-TET)
 */
export function quantizeScaleFrequency(
  scaleId: ScaleId,
  rootMidi: number,
  degree: number,
  octave: number,
  justIntonation: boolean
): number {
  const scale = RILEY_SCALES[scaleId] ?? RILEY_SCALES.mixolydian;
  const len = scale.semitones.length;
  const normDeg = ((degree % len) + len) % len;
  const extraOct = Math.floor(degree / len);

  if (justIntonation) {
    const rootFreq = 440 * Math.pow(2, (rootMidi - 69) / 12);
    const ratio = scale.jiRatios[normDeg] ?? 1;
    return rootFreq * ratio * Math.pow(2, octave + extraOct);
  }

  const semitoneOffset = scale.semitones[normDeg] ?? 0;
  const midi = rootMidi + semitoneOffset + (octave + extraOct) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Formats a human-readable note name (e.g., 'C4', 'G4', 'Bb3') for sequencer step display.
 */
export function formatStepNoteName(
  scaleId: ScaleId,
  rootMidi: number,
  degree: number,
  octave: number
): string {
  const scale = RILEY_SCALES[scaleId] ?? RILEY_SCALES.mixolydian;
  const len = scale.semitones.length;
  const normDeg = ((degree % len) + len) % len;
  const extraOct = Math.floor(degree / len);
  const semitoneOffset = scale.semitones[normDeg] ?? 0;
  const midi = rootMidi + semitoneOffset + (octave + extraOct) * 12;
  const noteName = NOTE_NAMES_12[((midi % 12) + 12) % 12];
  const octNum = Math.floor(midi / 12) - 1;
  return `${noteName}${octNum}`;
}
