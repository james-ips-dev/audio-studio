/**
 * src/instruments/aether8/presets/factoryPatches.ts
 *
 * - Complete 12-Module Patch Jack Registry (`PATCH_JACK_REGISTRY`) with 8 Track Trigger Outs,
 *   8 Track CV Outs, 8 Track Trigger Ins, and 8 Track Audio Outs + Mix Out
 * - 8 Full Studio Synth Track Engines with 20 Presets per Track (10 Soft + 10 Harsh = 160 Presets)
 * - 20 Presets for Module 04 Harmonic Drone Bank (10 Soft + 10 Harsh)
 * - 20 Signature Factory Sample Patches (10 Soft Silk Mode + 10 Harsh Mode)
 *   featuring multi-beat extendable sustained notes across all 8 tracks.
 */

import type {
  Aether8PatchV4,
  AetherFilterType,
  AetherOscWave,
  BeatVoiceKey,
  BeatVoiceSynthConfig,
  ChordVoicingType,
  DirectOutputChannelKey,
  OutputChannelFxConfig,
  PatchJackDef,
  PatternBankId,
  TimbreCharacter,
  XoxPatternBank,
} from '../types';

export interface AetherTrackMeta {
  index: number;
  key: BeatVoiceKey;
  name: string;
  shortLabel: string;
  color: string;
  isDrum: boolean;
  defaultMidiNote: number;
  defaultFreq: number;
  trigOutId: string;
  cvOutId: string;
  trigInId: string;
  audioOutId: string;
}

export const AETHER_TRACK_META: AetherTrackMeta[] = [
  {
    index: 0,
    key: 'kick',
    name: '01 SUB KICK',
    shortLabel: 'KICK',
    color: '#F43F5E',
    isDrum: true,
    defaultMidiNote: 36,
    defaultFreq: 48,
    trigOutId: 'xox:trig1',
    cvOutId: 'xox:cv1',
    trigInId: 'beats:kickIn',
    audioOutId: 'beats:kickOut',
  },
  {
    index: 1,
    key: 'rim',
    name: '02 DUB RIM',
    shortLabel: 'RIM',
    color: '#F59E0B',
    isDrum: true,
    defaultMidiNote: 38,
    defaultFreq: 340,
    trigOutId: 'xox:trig2',
    cvOutId: 'xox:cv2',
    trigInId: 'beats:rimIn',
    audioOutId: 'beats:rimOut',
  },
  {
    index: 2,
    key: 'hat',
    name: '03 DUST HAT',
    shortLabel: 'HAT',
    color: '#38BDF8',
    isDrum: true,
    defaultMidiNote: 42,
    defaultFreq: 680,
    trigOutId: 'xox:trig3',
    cvOutId: 'xox:cv3',
    trigInId: 'beats:hatIn',
    audioOutId: 'beats:hatOut',
  },
  {
    index: 3,
    key: 'tom',
    name: '04 WOOD TOM',
    shortLabel: 'TOM',
    color: '#34D399',
    isDrum: true,
    defaultMidiNote: 45,
    defaultFreq: 118,
    trigOutId: 'xox:trig4',
    cvOutId: 'xox:cv4',
    trigInId: 'beats:tomIn',
    audioOutId: 'beats:tomOut',
  },
  {
    index: 4,
    key: 'bass',
    name: '05 SUB BASS',
    shortLabel: 'BASS',
    color: '#00E5FF',
    isDrum: false,
    defaultMidiNote: 36,
    defaultFreq: 65.41,
    trigOutId: 'xox:trig5',
    cvOutId: 'xox:cv5',
    trigInId: 'beats:bassIn',
    audioOutId: 'beats:bassOut',
  },
  {
    index: 5,
    key: 'lead',
    name: '06 ACID LEAD',
    shortLabel: 'LEAD',
    color: '#EC4899',
    isDrum: false,
    defaultMidiNote: 48,
    defaultFreq: 130.81,
    trigOutId: 'xox:trig6',
    cvOutId: 'xox:cv6',
    trigInId: 'beats:leadIn',
    audioOutId: 'beats:leadOut',
  },
  {
    index: 6,
    key: 'chord',
    name: '07 DUB CHORD',
    shortLabel: 'CHORD',
    color: '#A855F7',
    isDrum: false,
    defaultMidiNote: 60,
    defaultFreq: 261.63,
    trigOutId: 'xox:trig7',
    cvOutId: 'xox:cv7',
    trigInId: 'beats:chordIn',
    audioOutId: 'beats:chordOut',
  },
  {
    index: 7,
    key: 'arp',
    name: '08 PLUCK ARP',
    shortLabel: 'ARP',
    color: '#FBBF24',
    isDrum: false,
    defaultMidiNote: 67,
    defaultFreq: 392.0,
    trigOutId: 'xox:trig8',
    cvOutId: 'xox:cv8',
    trigInId: 'beats:arpIn',
    audioOutId: 'beats:arpOut',
  },
];

export const BEAT_VOICE_KEYS: BeatVoiceKey[] = AETHER_TRACK_META.map(
  (m) => m.key
);

const NOTE_NAMES = [
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
];

export function aetherMidiToNoteName(midi: number): string {
  const clamped = Math.max(12, Math.min(108, Math.round(midi)));
  const name = NOTE_NAMES[clamped % 12];
  const oct = Math.floor(clamped / 12) - 1;
  return `${name}${oct}`;
}

export function aetherMidiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const DIRECT_OUTPUT_CHANNELS: {
  key: DirectOutputChannelKey;
  code: string;
  label: string;
  color: string;
}[] = [
  { key: 'drone', code: '01', label: 'DRONE', color: '#38BDF8' },
  { key: 'subOsc', code: '02', label: 'SUB OSC', color: '#0284C7' },
  { key: 'noiseLab', code: '03', label: 'NOISE LAB', color: '#A855F7' },
  { key: 'zdfFilt', code: '04', label: 'ZDF FILT', color: '#F59E0B' },
  { key: 'subPulse', code: '05', label: 'SUB PULSE', color: '#10B981' },
  { key: 'kick', code: '06', label: '01 KICK', color: '#F43F5E' },
  { key: 'beatBus', code: '07', label: '8-TRK BUS', color: '#FB7185' },
  { key: 'foldFx', code: '08', label: 'FOLD FX', color: '#EC4899' },
  { key: 'tapeDly', code: '09', label: 'TAPE DLY', color: '#818CF8' },
  { key: 'biosphere', code: '10', label: 'BIOSPHERE', color: '#34D399' },
];

export const PATCH_JACK_REGISTRY: PatchJackDef[] = [
  // 01 // X0X UNDERTONE SEQUENCER (8 Track Trigger Outs + 8 Track CV Outs + Master Clock/Bar)
  { id: 'xox:trig1', moduleId: '01', label: 'T1 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig2', moduleId: '01', label: 'T2 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig3', moduleId: '01', label: 'T3 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig4', moduleId: '01', label: 'T4 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig5', moduleId: '01', label: 'T5 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig6', moduleId: '01', label: 'T6 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig7', moduleId: '01', label: 'T7 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig8', moduleId: '01', label: 'T8 TRIG', direction: 'out', domain: 'trig' },
  { id: 'xox:cv1', moduleId: '01', label: 'T1 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:cv2', moduleId: '01', label: 'T2 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:cv3', moduleId: '01', label: 'T3 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:cv4', moduleId: '01', label: 'T4 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:cv5', moduleId: '01', label: 'T5 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:cv6', moduleId: '01', label: 'T6 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:cv7', moduleId: '01', label: 'T7 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:cv8', moduleId: '01', label: 'T8 CV', direction: 'out', domain: 'cv' },
  { id: 'xox:stepClk', moduleId: '01', label: 'STEP CLK', direction: 'out', domain: 'trig' },
  { id: 'xox:barTrig', moduleId: '01', label: 'BAR 1 TRG', direction: 'out', domain: 'trig' },

  // 02 // 8-TRACK STUDIO SYNTH & BEAT ENGINE (8 Trigger Ins + 2 CV Ins + 8 Audio Outs + Mix Out + Env CV)
  { id: 'beats:kickIn', moduleId: '02', label: 'T1 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:rimIn', moduleId: '02', label: 'T2 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:hatIn', moduleId: '02', label: 'T3 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:tomIn', moduleId: '02', label: 'T4 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:bassIn', moduleId: '02', label: 'T5 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:leadIn', moduleId: '02', label: 'T6 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:chordIn', moduleId: '02', label: 'T7 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:arpIn', moduleId: '02', label: 'T8 IN', direction: 'in', domain: 'trig' },
  { id: 'beats:ptchCv', moduleId: '02', label: 'PTCH CV', direction: 'in', domain: 'cv' },
  { id: 'beats:filtCv', moduleId: '02', label: 'FILT CV', direction: 'in', domain: 'cv' },
  { id: 'beats:kickOut', moduleId: '02', label: 'T1 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:rimOut', moduleId: '02', label: 'T2 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:hatOut', moduleId: '02', label: 'T3 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:tomOut', moduleId: '02', label: 'T4 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:bassOut', moduleId: '02', label: 'T5 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:leadOut', moduleId: '02', label: 'T6 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:chordOut', moduleId: '02', label: 'T7 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:arpOut', moduleId: '02', label: 'T8 OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:mixOut', moduleId: '02', label: 'MIX OUT', direction: 'out', domain: 'audio' },
  { id: 'beats:envOut', moduleId: '02', label: 'ENV CV', direction: 'out', domain: 'cv' },

  // 03 // EUCLIDEAN & TIME DIVIDER
  { id: 'clock:stepIn', moduleId: '03', label: 'STEP IN', direction: 'in', domain: 'trig' },
  { id: 'clock:resetIn', moduleId: '03', label: 'RESET IN', direction: 'in', domain: 'trig' },
  { id: 'clock:euclidA', moduleId: '03', label: 'EUCLID A', direction: 'out', domain: 'trig' },
  { id: 'clock:euclidB', moduleId: '03', label: 'EUCLID B', direction: 'out', domain: 'trig' },
  { id: 'clock:div4', moduleId: '03', label: 'DIV /4', direction: 'out', domain: 'trig' },
  { id: 'clock:bar24', moduleId: '03', label: '2/4 BAR', direction: 'out', domain: 'trig' },

  // 04 // HARMONIC DRONE BANK
  { id: 'drone:pitchCv', moduleId: '04', label: 'PITCH', direction: 'in', domain: 'cv' },
  { id: 'drone:fmCv', moduleId: '04', label: 'FM CV', direction: 'in', domain: 'cv' },
  { id: 'drone:spreadCv', moduleId: '04', label: 'SPREAD', direction: 'in', domain: 'cv' },
  { id: 'drone:subOut', moduleId: '04', label: 'SUB OUT', direction: 'out', domain: 'audio' },
  { id: 'drone:droneOut', moduleId: '04', label: 'DRONE', direction: 'out', domain: 'audio' },

  // 05 // TEXTURA NOISE LAB
  { id: 'noise:formCv', moduleId: '05', label: 'FORM CV', direction: 'in', domain: 'cv' },
  { id: 'noise:vcaCv', moduleId: '05', label: 'VCA CV', direction: 'in', domain: 'cv' },
  { id: 'noise:dustTrg', moduleId: '05', label: 'DUST TRG', direction: 'out', domain: 'trig' },
  { id: 'noise:noiseOut', moduleId: '05', label: 'NOISE', direction: 'out', domain: 'audio' },

  // 06 // ZDF ANALOG FILTER
  { id: 'filter:audioIn', moduleId: '06', label: 'AUDIO IN', direction: 'in', domain: 'audio' },
  { id: 'filter:fm1Cv', moduleId: '06', label: 'FM 1 CV', direction: 'in', domain: 'cv' },
  { id: 'filter:fm2Cv', moduleId: '06', label: 'FM 2 CV', direction: 'in', domain: 'cv' },
  { id: 'filter:filtOut', moduleId: '06', label: 'FILT OUT', direction: 'out', domain: 'audio' },

  // 07 // VACTROL SUB-PULSE
  { id: 'pulse:trigIn', moduleId: '07', label: 'TRIG IN', direction: 'in', domain: 'trig' },
  { id: 'pulse:pitchCv', moduleId: '07', label: 'PITCH CV', direction: 'in', domain: 'cv' },
  { id: 'pulse:decayCv', moduleId: '07', label: 'DECAY CV', direction: 'in', domain: 'cv' },
  { id: 'pulse:pulseOut', moduleId: '07', label: 'PULSE', direction: 'out', domain: 'audio' },

  // 08 // SLOW LFO & CHAOS
  { id: 'mod:lfoResetIn', moduleId: '08', label: 'LFO RST', direction: 'in', domain: 'trig' },
  { id: 'mod:shTrigIn', moduleId: '08', label: 'S&H TRG', direction: 'in', domain: 'trig' },
  { id: 'mod:lfo1Out', moduleId: '08', label: 'LFO 1', direction: 'out', domain: 'cv' },
  { id: 'mod:lfo2Out', moduleId: '08', label: 'LFO 2', direction: 'out', domain: 'cv' },
  { id: 'mod:chaosOut', moduleId: '08', label: 'CHAOS', direction: 'out', domain: 'cv' },
  { id: 'mod:shOut', moduleId: '08', label: 'SLEW S&H', direction: 'out', domain: 'cv' },

  // 09 // WAVEFOLD & LO-FI FX
  { id: 'fx:audioIn', moduleId: '09', label: 'AUDIO IN', direction: 'in', domain: 'audio' },
  { id: 'fx:toneCv', moduleId: '09', label: 'TONE CV', direction: 'in', domain: 'cv' },
  { id: 'fx:foldCv', moduleId: '09', label: 'FOLD CV', direction: 'in', domain: 'cv' },
  { id: 'fx:fxOut', moduleId: '09', label: 'FX OUT', direction: 'out', domain: 'audio' },

  // 10 // DUB TAPE DELAY
  { id: 'delay:audioIn', moduleId: '10', label: 'AUDIO IN', direction: 'in', domain: 'audio' },
  { id: 'delay:timeCv', moduleId: '10', label: 'TIME CV', direction: 'in', domain: 'cv' },
  { id: 'delay:fbackCv', moduleId: '10', label: 'FBACK CV', direction: 'in', domain: 'cv' },
  { id: 'delay:tapeOut', moduleId: '10', label: 'TAPE OUT', direction: 'out', domain: 'audio' },

  // 11 // SPACE & TAPE MIXER
  { id: 'mixer:ch1In', moduleId: '11', label: 'CH 1 IN', direction: 'in', domain: 'audio' },
  { id: 'mixer:ch2In', moduleId: '11', label: 'CH 2 IN', direction: 'in', domain: 'audio' },
  { id: 'mixer:ch3In', moduleId: '11', label: 'CH 3 IN', direction: 'in', domain: 'audio' },
  { id: 'mixer:ch4In', moduleId: '11', label: 'CH 4 IN', direction: 'in', domain: 'audio' },

  // 12 // BIOSPHERE & WEATHER LAB
  { id: 'bio:thndrTrg', moduleId: '12', label: 'THNDR TRG', direction: 'in', domain: 'trig' },
  { id: 'bio:windCv', moduleId: '12', label: 'WIND CV', direction: 'in', domain: 'cv' },
  { id: 'bio:waveCv', moduleId: '12', label: 'WAVE CV', direction: 'in', domain: 'cv' },
  { id: 'bio:rainOut', moduleId: '12', label: 'RAIN', direction: 'out', domain: 'audio' },
  { id: 'bio:waterOut', moduleId: '12', label: 'WATER', direction: 'out', domain: 'audio' },
  { id: 'bio:wavesOut', moduleId: '12', label: 'WAVES', direction: 'out', domain: 'audio' },
  { id: 'bio:windOut', moduleId: '12', label: 'WIND', direction: 'out', domain: 'audio' },
  { id: 'bio:ltngTrg', moduleId: '12', label: 'LTNG TRG', direction: 'out', domain: 'trig' },
  { id: 'bio:natureMix', moduleId: '12', label: 'NATURE MIX', direction: 'out', domain: 'audio' },
];

export interface AetherTrackPresetItem {
  name: string;
  modeTag: TimbreCharacter; // 'soft' | 'harsh'
  osc1Wave: AetherOscWave;
  osc2Wave: AetherOscWave;
  filterType: AetherFilterType;
  freq: number;
  macros: {
    cutoff: number;
    resonance: number;
    fmDirt: number;
    ampDecay: number;
    pitchEnv: number;
    detune: number;
  };
  sub1Level: number;
  sub2Level: number;
  noiseMix: number;
  sustain: number;
  glideTime?: number;
}

/**
 * 20 Presets per Track Synth Engine across all 8 AETHER-8 Tracks (10 Soft + 10 Harsh = 160 Presets)
 */
export const AETHER_TRACK_PRESET_BANKS: Record<BeatVoiceKey, AetherTrackPresetItem[]> = {
  // Track 01: SUB KICK (10 Soft + 10 Harsh)
  kick: [
    { name: 'Velvet Dub Sub Kick', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 46, macros: { cutoff: 0.32, resonance: 0.2, fmDirt: 0.12, ampDecay: 0.45, pitchEnv: 0.65, detune: 0.04 }, sub1Level: 0.85, sub2Level: 0.35, noiseMix: 0.04, sustain: 0.2 },
    { name: 'Warm 808 Long Boom', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'lp24', freq: 42, macros: { cutoff: 0.28, resonance: 0.15, fmDirt: 0.08, ampDecay: 0.78, pitchEnv: 0.55, detune: 0.02 }, sub1Level: 0.92, sub2Level: 0.45, noiseMix: 0.02, sustain: 0.55 },
    { name: 'Soft Moss Heartbeat', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp12', freq: 50, macros: { cutoff: 0.24, resonance: 0.12, fmDirt: 0.05, ampDecay: 0.38, pitchEnv: 0.42, detune: 0.05 }, sub1Level: 0.78, sub2Level: 0.3, noiseMix: 0.03, sustain: 0.15 },
    { name: 'Tape Saturated Thump', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp24', freq: 54, macros: { cutoff: 0.36, resonance: 0.22, fmDirt: 0.24, ampDecay: 0.34, pitchEnv: 0.58, detune: 0.06 }, sub1Level: 0.8, sub2Level: 0.25, noiseMix: 0.06, sustain: 0.1 },
    { name: 'Deep Cavern Pulse', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'lp24', freq: 40, macros: { cutoff: 0.22, resonance: 0.28, fmDirt: 0.1, ampDecay: 0.68, pitchEnv: 0.48, detune: 0.08 }, sub1Level: 0.9, sub2Level: 0.5, noiseMix: 0.05, sustain: 0.45 },
    { name: 'Analog Pillow Kick', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 48, macros: { cutoff: 0.25, resonance: 0.14, fmDirt: 0.06, ampDecay: 0.42, pitchEnv: 0.38, detune: 0.03 }, sub1Level: 0.82, sub2Level: 0.28, noiseMix: 0.02, sustain: 0.2 },
    { name: 'Basic Channel Sub', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'lp24', freq: 45, macros: { cutoff: 0.3, resonance: 0.24, fmDirt: 0.14, ampDecay: 0.52, pitchEnv: 0.6, detune: 0.04 }, sub1Level: 0.88, sub2Level: 0.38, noiseMix: 0.04, sustain: 0.3 },
    { name: 'Lo-Fi Vinyl Kick', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp12', freq: 52, macros: { cutoff: 0.34, resonance: 0.18, fmDirt: 0.18, ampDecay: 0.32, pitchEnv: 0.52, detune: 0.07 }, sub1Level: 0.74, sub2Level: 0.2, noiseMix: 0.12, sustain: 0.1 },
    { name: 'Oceanic Sub Swell', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 38, macros: { cutoff: 0.2, resonance: 0.25, fmDirt: 0.08, ampDecay: 0.85, pitchEnv: 0.32, detune: 0.1 }, sub1Level: 0.95, sub2Level: 0.55, noiseMix: 0.03, sustain: 0.65 },
    { name: 'Warm Vactrol Thud', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'lp24', freq: 49, macros: { cutoff: 0.29, resonance: 0.3, fmDirt: 0.15, ampDecay: 0.4, pitchEnv: 0.62, detune: 0.04 }, sub1Level: 0.84, sub2Level: 0.3, noiseMix: 0.04, sustain: 0.18 },
    // 10 Harsh
    { name: 'Industrial Gabber Kick', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'lp12', freq: 58, macros: { cutoff: 0.72, resonance: 0.58, fmDirt: 0.88, ampDecay: 0.55, pitchEnv: 0.95, detune: 0.22 }, sub1Level: 0.9, sub2Level: 0.6, noiseMix: 0.24, sustain: 0.35 },
    { name: 'Berlin Bunker 909', modeTag: 'harsh', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 54, macros: { cutoff: 0.58, resonance: 0.42, fmDirt: 0.56, ampDecay: 0.46, pitchEnv: 0.85, detune: 0.12 }, sub1Level: 0.88, sub2Level: 0.4, noiseMix: 0.16, sustain: 0.2 },
    { name: 'Wavefolded Sub Smash', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp24', freq: 47, macros: { cutoff: 0.64, resonance: 0.5, fmDirt: 0.76, ampDecay: 0.5, pitchEnv: 0.88, detune: 0.18 }, sub1Level: 0.92, sub2Level: 0.5, noiseMix: 0.2, sustain: 0.3 },
    { name: 'Metallic FM Impact', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'bp12', freq: 62, macros: { cutoff: 0.68, resonance: 0.62, fmDirt: 0.92, ampDecay: 0.42, pitchEnv: 0.9, detune: 0.28 }, sub1Level: 0.8, sub2Level: 0.45, noiseMix: 0.28, sustain: 0.2 },
    { name: 'Tectonic Fault Doom', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 39, macros: { cutoff: 0.52, resonance: 0.65, fmDirt: 0.82, ampDecay: 0.86, pitchEnv: 0.75, detune: 0.32 }, sub1Level: 0.96, sub2Level: 0.7, noiseMix: 0.22, sustain: 0.65 },
    { name: 'Laser Transient Punch', modeTag: 'harsh', osc1Wave: 'triangle', osc2Wave: 'square', filterType: 'lp12', freq: 64, macros: { cutoff: 0.78, resonance: 0.48, fmDirt: 0.64, ampDecay: 0.32, pitchEnv: 1.0, detune: 0.14 }, sub1Level: 0.82, sub2Level: 0.35, noiseMix: 0.18, sustain: 0.1 },
    { name: 'Acid Overdrive Stomp', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'triangle', filterType: 'lp24', freq: 52, macros: { cutoff: 0.62, resonance: 0.72, fmDirt: 0.74, ampDecay: 0.48, pitchEnv: 0.82, detune: 0.16 }, sub1Level: 0.88, sub2Level: 0.42, noiseMix: 0.15, sustain: 0.25 },
    { name: 'Bitcrushed Arcade Kick', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'square', filterType: 'lp12', freq: 56, macros: { cutoff: 0.75, resonance: 0.45, fmDirt: 0.84, ampDecay: 0.36, pitchEnv: 0.92, detune: 0.25 }, sub1Level: 0.85, sub2Level: 0.4, noiseMix: 0.3, sustain: 0.15 },
    { name: 'Hydraulic Piston Hit', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp24', freq: 50, macros: { cutoff: 0.66, resonance: 0.54, fmDirt: 0.78, ampDecay: 0.44, pitchEnv: 0.86, detune: 0.2 }, sub1Level: 0.9, sub2Level: 0.48, noiseMix: 0.34, sustain: 0.22 },
    { name: 'Sub-Zero Bass Cannon', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'square', filterType: 'lp24', freq: 41, macros: { cutoff: 0.56, resonance: 0.6, fmDirt: 0.8, ampDecay: 0.82, pitchEnv: 0.78, detune: 0.35 }, sub1Level: 0.98, sub2Level: 0.65, noiseMix: 0.18, sustain: 0.6 },
  ],

  // Track 02: DUB RIM / SNARE (10 Soft + 10 Harsh)
  rim: [
    { name: 'King Tubby Spring Rim', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'bp12', freq: 340, macros: { cutoff: 0.56, resonance: 0.48, fmDirt: 0.22, ampDecay: 0.18, pitchEnv: 0.42, detune: 0.08 }, sub1Level: 0.25, sub2Level: 0.1, noiseMix: 0.32, sustain: 0.05 },
    { name: 'Warm Analog Woodblock', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'bp12', freq: 410, macros: { cutoff: 0.48, resonance: 0.52, fmDirt: 0.15, ampDecay: 0.14, pitchEnv: 0.38, detune: 0.05 }, sub1Level: 0.2, sub2Level: 0.05, noiseMix: 0.18, sustain: 0.02 },
    { name: 'Velvet Brush Snare', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp24', freq: 210, macros: { cutoff: 0.52, resonance: 0.25, fmDirt: 0.12, ampDecay: 0.36, pitchEnv: 0.28, detune: 0.12 }, sub1Level: 0.35, sub2Level: 0.15, noiseMix: 0.68, sustain: 0.2 },
    { name: 'Tape Echo Sidestick', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'square', filterType: 'bp12', freq: 380, macros: { cutoff: 0.58, resonance: 0.44, fmDirt: 0.2, ampDecay: 0.16, pitchEnv: 0.45, detune: 0.06 }, sub1Level: 0.2, sub2Level: 0.1, noiseMix: 0.28, sustain: 0.04 },
    { name: 'Soft Bamboo Click', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'bp12', freq: 460, macros: { cutoff: 0.62, resonance: 0.56, fmDirt: 0.18, ampDecay: 0.12, pitchEnv: 0.5, detune: 0.04 }, sub1Level: 0.15, sub2Level: 0.05, noiseMix: 0.22, sustain: 0.02 },
    { name: 'Lo-Fi Bedroom Snare', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp12', freq: 195, macros: { cutoff: 0.44, resonance: 0.22, fmDirt: 0.16, ampDecay: 0.24, pitchEnv: 0.32, detune: 0.1 }, sub1Level: 0.4, sub2Level: 0.15, noiseMix: 0.55, sustain: 0.1 },
    { name: 'Hollow Log Knock', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'bp12', freq: 290, macros: { cutoff: 0.46, resonance: 0.6, fmDirt: 0.14, ampDecay: 0.2, pitchEnv: 0.48, detune: 0.05 }, sub1Level: 0.3, sub2Level: 0.1, noiseMix: 0.15, sustain: 0.05 },
    { name: 'Dubwise Handclap', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'bp12', freq: 260, macros: { cutoff: 0.54, resonance: 0.36, fmDirt: 0.24, ampDecay: 0.32, pitchEnv: 0.22, detune: 0.18 }, sub1Level: 0.2, sub2Level: 0.1, noiseMix: 0.74, sustain: 0.15 },
    { name: 'Mellow CR-78 Rim', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'bp12', freq: 520, macros: { cutoff: 0.6, resonance: 0.5, fmDirt: 0.2, ampDecay: 0.11, pitchEnv: 0.35, detune: 0.04 }, sub1Level: 0.15, sub2Level: 0.05, noiseMix: 0.2, sustain: 0.02 },
    { name: 'Silk Noise Swell Snare', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp24', freq: 220, macros: { cutoff: 0.5, resonance: 0.3, fmDirt: 0.15, ampDecay: 0.65, pitchEnv: 0.25, detune: 0.14 }, sub1Level: 0.3, sub2Level: 0.15, noiseMix: 0.78, sustain: 0.48 },
    // 10 Harsh
    { name: 'Industrial Metal Pipe', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'bp12', freq: 440, macros: { cutoff: 0.76, resonance: 0.72, fmDirt: 0.88, ampDecay: 0.42, pitchEnv: 0.75, detune: 0.38 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.62, sustain: 0.25 },
    { name: '909 Crack Snare', modeTag: 'harsh', osc1Wave: 'triangle', osc2Wave: 'square', filterType: 'lp12', freq: 225, macros: { cutoff: 0.74, resonance: 0.38, fmDirt: 0.52, ampDecay: 0.34, pitchEnv: 0.68, detune: 0.16 }, sub1Level: 0.45, sub2Level: 0.2, noiseMix: 0.82, sustain: 0.15 },
    { name: 'FM Clang Whip', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'hp12', freq: 390, macros: { cutoff: 0.68, resonance: 0.64, fmDirt: 0.92, ampDecay: 0.28, pitchEnv: 0.85, detune: 0.32 }, sub1Level: 0.2, sub2Level: 0.15, noiseMix: 0.7, sustain: 0.12 },
    { name: 'Wavefold Snap Rim', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'triangle', filterType: 'bp12', freq: 480, macros: { cutoff: 0.72, resonance: 0.58, fmDirt: 0.78, ampDecay: 0.2, pitchEnv: 0.8, detune: 0.22 }, sub1Level: 0.25, sub2Level: 0.1, noiseMix: 0.48, sustain: 0.08 },
    { name: 'Bitcrushed Glitch Clap', modeTag: 'harsh', osc1Wave: 'pwm', osc2Wave: 'square', filterType: 'bp12', freq: 310, macros: { cutoff: 0.78, resonance: 0.52, fmDirt: 0.84, ampDecay: 0.38, pitchEnv: 0.6, detune: 0.42 }, sub1Level: 0.25, sub2Level: 0.15, noiseMix: 0.88, sustain: 0.22 },
    { name: 'Buchla LPG Strike', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 360, macros: { cutoff: 0.66, resonance: 0.68, fmDirt: 0.74, ampDecay: 0.22, pitchEnv: 0.9, detune: 0.18 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.35, sustain: 0.1 },
    { name: 'Electro Zap Snare', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp12', freq: 270, macros: { cutoff: 0.8, resonance: 0.46, fmDirt: 0.66, ampDecay: 0.3, pitchEnv: 0.94, detune: 0.2 }, sub1Level: 0.4, sub2Level: 0.2, noiseMix: 0.65, sustain: 0.15 },
    { name: 'Anvil Forged Hit', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'square', filterType: 'bp12', freq: 540, macros: { cutoff: 0.75, resonance: 0.76, fmDirt: 0.95, ampDecay: 0.48, pitchEnv: 0.7, detune: 0.45 }, sub1Level: 0.3, sub2Level: 0.25, noiseMix: 0.58, sustain: 0.3 },
    { name: 'Distorted Dub Rimshot', modeTag: 'harsh', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'bp12', freq: 350, macros: { cutoff: 0.7, resonance: 0.6, fmDirt: 0.72, ampDecay: 0.24, pitchEnv: 0.64, detune: 0.15 }, sub1Level: 0.3, sub2Level: 0.1, noiseMix: 0.45, sustain: 0.1 },
    { name: 'gated Industrial Burst', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'square', filterType: 'lp12', freq: 205, macros: { cutoff: 0.82, resonance: 0.5, fmDirt: 0.86, ampDecay: 0.62, pitchEnv: 0.55, detune: 0.36 }, sub1Level: 0.5, sub2Level: 0.3, noiseMix: 0.92, sustain: 0.5 },
  ],

  // Track 03: DUST HAT (10 Soft + 10 Harsh)
  hat: [
    { name: 'Vinyl Dust Shaker', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'hp12', freq: 680, macros: { cutoff: 0.68, resonance: 0.28, fmDirt: 0.18, ampDecay: 0.12, pitchEnv: 0.15, detune: 0.12 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.88, sustain: 0.02 },
    { name: 'Soft Silk Closed Hat', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'square', filterType: 'hp12', freq: 740, macros: { cutoff: 0.64, resonance: 0.22, fmDirt: 0.14, ampDecay: 0.09, pitchEnv: 0.1, detune: 0.08 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.85, sustain: 0.01 },
    { name: 'Tape Hiss Offbeat Hat', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'bp12', freq: 620, macros: { cutoff: 0.62, resonance: 0.34, fmDirt: 0.12, ampDecay: 0.28, pitchEnv: 0.12, detune: 0.1 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.92, sustain: 0.18 },
    { name: 'Warm Maraca Whisper', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'bp12', freq: 580, macros: { cutoff: 0.58, resonance: 0.25, fmDirt: 0.08, ampDecay: 0.15, pitchEnv: 0.08, detune: 0.06 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.95, sustain: 0.04 },
    { name: 'Analog 606 Soft Tick', modeTag: 'soft', osc1Wave: 'square', osc2Wave: 'triangle', filterType: 'hp12', freq: 820, macros: { cutoff: 0.7, resonance: 0.32, fmDirt: 0.24, ampDecay: 0.1, pitchEnv: 0.18, detune: 0.14 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.78, sustain: 0.02 },
    { name: 'Brushed Jazz Cymbal', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'square', filterType: 'hp12', freq: 690, macros: { cutoff: 0.6, resonance: 0.26, fmDirt: 0.2, ampDecay: 0.52, pitchEnv: 0.12, detune: 0.18 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.9, sustain: 0.38 },
    { name: 'Raindrop Micro-Tick', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'bp12', freq: 880, macros: { cutoff: 0.66, resonance: 0.45, fmDirt: 0.15, ampDecay: 0.08, pitchEnv: 0.35, detune: 0.05 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.65, sustain: 0.01 },
    { name: 'Velvet Open Dub Hat', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'square', filterType: 'hp12', freq: 650, macros: { cutoff: 0.62, resonance: 0.3, fmDirt: 0.22, ampDecay: 0.48, pitchEnv: 0.14, detune: 0.15 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.88, sustain: 0.35 },
    { name: 'Cassette Air Shimmer', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'hp12', freq: 720, macros: { cutoff: 0.56, resonance: 0.2, fmDirt: 0.1, ampDecay: 0.36, pitchEnv: 0.08, detune: 0.12 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.96, sustain: 0.25 },
    { name: 'Forest Leaf Rustle', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'triangle', filterType: 'bp12', freq: 540, macros: { cutoff: 0.54, resonance: 0.36, fmDirt: 0.12, ampDecay: 0.24, pitchEnv: 0.1, detune: 0.1 }, sub1Level: 0.0, sub2Level: 0.0, noiseMix: 0.94, sustain: 0.15 },
    // 10 Harsh
    { name: '909 Metallic Open Hat', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'square', filterType: 'hp12', freq: 840, macros: { cutoff: 0.84, resonance: 0.52, fmDirt: 0.78, ampDecay: 0.48, pitchEnv: 0.32, detune: 0.38 }, sub1Level: 0.0, sub2Level: 0.1, noiseMix: 0.86, sustain: 0.35 },
    { name: 'Ring-Mod Alloy Cymbal', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'hp12', freq: 920, macros: { cutoff: 0.82, resonance: 0.64, fmDirt: 0.92, ampDecay: 0.56, pitchEnv: 0.4, detune: 0.46 }, sub1Level: 0.0, sub2Level: 0.15, noiseMix: 0.78, sustain: 0.42 },
    { name: 'Razor Sizzle Closed', modeTag: 'harsh', osc1Wave: 'pwm', osc2Wave: 'square', filterType: 'hp12', freq: 880, macros: { cutoff: 0.88, resonance: 0.48, fmDirt: 0.74, ampDecay: 0.11, pitchEnv: 0.28, detune: 0.32 }, sub1Level: 0.0, sub2Level: 0.05, noiseMix: 0.9, sustain: 0.02 },
    { name: 'Industrial Steam Valve', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'bp12', freq: 760, macros: { cutoff: 0.76, resonance: 0.58, fmDirt: 0.82, ampDecay: 0.64, pitchEnv: 0.22, detune: 0.35 }, sub1Level: 0.1, sub2Level: 0.1, noiseMix: 0.96, sustain: 0.5 },
    { name: 'FM Bell Ride Ping', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'hp12', freq: 960, macros: { cutoff: 0.8, resonance: 0.68, fmDirt: 0.95, ampDecay: 0.52, pitchEnv: 0.45, detune: 0.42 }, sub1Level: 0.0, sub2Level: 0.2, noiseMix: 0.55, sustain: 0.3 },
    { name: 'Bitcrushed Glitch Hat', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'square', filterType: 'hp12', freq: 790, macros: { cutoff: 0.86, resonance: 0.54, fmDirt: 0.88, ampDecay: 0.18, pitchEnv: 0.36, detune: 0.48 }, sub1Level: 0.0, sub2Level: 0.1, noiseMix: 0.85, sustain: 0.08 },
    { name: 'High-Voltage Arc Tick', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', filterType: 'hp12', freq: 910, macros: { cutoff: 0.9, resonance: 0.62, fmDirt: 0.84, ampDecay: 0.14, pitchEnv: 0.52, detune: 0.3 }, sub1Level: 0.0, sub2Level: 0.05, noiseMix: 0.82, sustain: 0.04 },
    { name: 'Shattered Glass Crash', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'square', filterType: 'hp12', freq: 860, macros: { cutoff: 0.85, resonance: 0.6, fmDirt: 0.9, ampDecay: 0.78, pitchEnv: 0.38, detune: 0.52 }, sub1Level: 0.0, sub2Level: 0.15, noiseMix: 0.94, sustain: 0.6 },
    { name: 'Acid Hi-Hat Sizzle', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'bp12', freq: 810, macros: { cutoff: 0.78, resonance: 0.74, fmDirt: 0.76, ampDecay: 0.26, pitchEnv: 0.3, detune: 0.28 }, sub1Level: 0.0, sub2Level: 0.05, noiseMix: 0.88, sustain: 0.15 },
    { name: 'Cyberpunk Ratchet Hat', modeTag: 'harsh', osc1Wave: 'pwm', osc2Wave: 'square', filterType: 'hp12', freq: 890, macros: { cutoff: 0.87, resonance: 0.5, fmDirt: 0.8, ampDecay: 0.2, pitchEnv: 0.34, detune: 0.36 }, sub1Level: 0.0, sub2Level: 0.08, noiseMix: 0.86, sustain: 0.1 },
  ],

  // Track 04: WOOD TOM / PERC (10 Soft + 10 Harsh)
  tom: [
    { name: 'Deep Rosewood Tom', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 118, macros: { cutoff: 0.42, resonance: 0.38, fmDirt: 0.14, ampDecay: 0.32, pitchEnv: 0.55, detune: 0.06 }, sub1Level: 0.55, sub2Level: 0.2, noiseMix: 0.08, sustain: 0.12 },
    { name: 'Warm Bongo Undertone', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'bp12', freq: 165, macros: { cutoff: 0.48, resonance: 0.44, fmDirt: 0.12, ampDecay: 0.22, pitchEnv: 0.48, detune: 0.04 }, sub1Level: 0.4, sub2Level: 0.1, noiseMix: 0.06, sustain: 0.05 },
    { name: 'Buchla Vactrol Bongo', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 142, macros: { cutoff: 0.46, resonance: 0.52, fmDirt: 0.22, ampDecay: 0.28, pitchEnv: 0.62, detune: 0.08 }, sub1Level: 0.48, sub2Level: 0.15, noiseMix: 0.05, sustain: 0.1 },
    { name: 'Hollow Bamboo Marimba', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'bp12', freq: 220, macros: { cutoff: 0.54, resonance: 0.46, fmDirt: 0.18, ampDecay: 0.24, pitchEnv: 0.35, detune: 0.05 }, sub1Level: 0.35, sub2Level: 0.15, noiseMix: 0.04, sustain: 0.08 },
    { name: 'Dubwise Nyabinghi Drum', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 98, macros: { cutoff: 0.36, resonance: 0.34, fmDirt: 0.15, ampDecay: 0.46, pitchEnv: 0.52, detune: 0.07 }, sub1Level: 0.68, sub2Level: 0.28, noiseMix: 0.1, sustain: 0.25 },
    { name: 'Soft Kalimba Thumb', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 260, macros: { cutoff: 0.56, resonance: 0.4, fmDirt: 0.2, ampDecay: 0.3, pitchEnv: 0.28, detune: 0.06 }, sub1Level: 0.3, sub2Level: 0.1, noiseMix: 0.05, sustain: 0.15 },
    { name: 'Water Drop Resonator', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'bp12', freq: 190, macros: { cutoff: 0.52, resonance: 0.68, fmDirt: 0.1, ampDecay: 0.26, pitchEnv: -0.45, detune: 0.04 }, sub1Level: 0.3, sub2Level: 0.1, noiseMix: 0.02, sustain: 0.08 },
    { name: 'Velvet Conga Slap', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp24', freq: 150, macros: { cutoff: 0.44, resonance: 0.36, fmDirt: 0.16, ampDecay: 0.28, pitchEnv: 0.5, detune: 0.05 }, sub1Level: 0.45, sub2Level: 0.15, noiseMix: 0.12, sustain: 0.1 },
    { name: 'Cavern Floor Tom', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 86, macros: { cutoff: 0.34, resonance: 0.32, fmDirt: 0.14, ampDecay: 0.58, pitchEnv: 0.48, detune: 0.08 }, sub1Level: 0.75, sub2Level: 0.35, noiseMix: 0.08, sustain: 0.38 },
    { name: 'Warm Analog Cowbell', modeTag: 'soft', osc1Wave: 'square', osc2Wave: 'triangle', filterType: 'bp12', freq: 540, macros: { cutoff: 0.58, resonance: 0.42, fmDirt: 0.28, ampDecay: 0.22, pitchEnv: 0.15, detune: 0.22 }, sub1Level: 0.2, sub2Level: 0.1, noiseMix: 0.05, sustain: 0.08 },
    // 10 Harsh
    { name: 'Simmons SDS-V Hex Tom', modeTag: 'harsh', osc1Wave: 'triangle', osc2Wave: 'square', filterType: 'lp12', freq: 135, macros: { cutoff: 0.68, resonance: 0.48, fmDirt: 0.64, ampDecay: 0.44, pitchEnv: 0.88, detune: 0.18 }, sub1Level: 0.6, sub2Level: 0.25, noiseMix: 0.28, sustain: 0.2 },
    { name: 'FM Steel Drum Clang', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'bp12', freq: 240, macros: { cutoff: 0.74, resonance: 0.62, fmDirt: 0.88, ampDecay: 0.38, pitchEnv: 0.52, detune: 0.34 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.18, sustain: 0.22 },
    { name: 'Industrial Oil Barrel', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'bp12', freq: 110, macros: { cutoff: 0.64, resonance: 0.66, fmDirt: 0.82, ampDecay: 0.54, pitchEnv: 0.72, detune: 0.38 }, sub1Level: 0.65, sub2Level: 0.35, noiseMix: 0.32, sustain: 0.35 },
    { name: 'Acid Sonar Ping', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp24', freq: 175, macros: { cutoff: 0.72, resonance: 0.82, fmDirt: 0.68, ampDecay: 0.4, pitchEnv: 0.78, detune: 0.2 }, sub1Level: 0.45, sub2Level: 0.2, noiseMix: 0.12, sustain: 0.25 },
    { name: 'Modular Cross-FM Zap', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', filterType: 'lp12', freq: 160, macros: { cutoff: 0.78, resonance: 0.58, fmDirt: 0.92, ampDecay: 0.3, pitchEnv: 0.95, detune: 0.28 }, sub1Level: 0.4, sub2Level: 0.2, noiseMix: 0.22, sustain: 0.15 },
    { name: 'Wavefold Tribal Tom', modeTag: 'harsh', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 105, macros: { cutoff: 0.62, resonance: 0.54, fmDirt: 0.76, ampDecay: 0.48, pitchEnv: 0.68, detune: 0.22 }, sub1Level: 0.7, sub2Level: 0.3, noiseMix: 0.2, sustain: 0.28 },
    { name: 'Glitch Ratchet Perc', modeTag: 'harsh', osc1Wave: 'pwm', osc2Wave: 'square', filterType: 'bp12', freq: 210, macros: { cutoff: 0.76, resonance: 0.6, fmDirt: 0.84, ampDecay: 0.24, pitchEnv: 0.82, detune: 0.4 }, sub1Level: 0.3, sub2Level: 0.15, noiseMix: 0.35, sustain: 0.1 },
    { name: 'Distorted Taiko Thunder', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp24', freq: 78, macros: { cutoff: 0.56, resonance: 0.52, fmDirt: 0.78, ampDecay: 0.76, pitchEnv: 0.64, detune: 0.3 }, sub1Level: 0.88, sub2Level: 0.5, noiseMix: 0.26, sustain: 0.55 },
    { name: 'Metallic Spring Boing', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'bp12', freq: 195, macros: { cutoff: 0.7, resonance: 0.75, fmDirt: 0.86, ampDecay: 0.42, pitchEnv: -0.75, detune: 0.32 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.16, sustain: 0.2 },
    { name: 'Overdriven Synth Agogo', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'square', filterType: 'hp12', freq: 420, macros: { cutoff: 0.75, resonance: 0.64, fmDirt: 0.9, ampDecay: 0.32, pitchEnv: 0.6, detune: 0.36 }, sub1Level: 0.2, sub2Level: 0.15, noiseMix: 0.15, sustain: 0.15 },
  ],

  // Track 05: SUB BASS (10 Soft + 10 Harsh)
  bass: [
    { name: 'Deep Dub Reggae Sub', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 55, macros: { cutoff: 0.34, resonance: 0.24, fmDirt: 0.1, ampDecay: 0.68, pitchEnv: 0.18, detune: 0.08 }, sub1Level: 0.92, sub2Level: 0.45, noiseMix: 0.02, sustain: 0.82, glideTime: 65 },
    { name: 'Warm Moog Velvet Bass', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'triangle', filterType: 'lp24', freq: 65.41, macros: { cutoff: 0.44, resonance: 0.36, fmDirt: 0.18, ampDecay: 0.58, pitchEnv: 0.32, detune: 0.14 }, sub1Level: 0.8, sub2Level: 0.3, noiseMix: 0.03, sustain: 0.76, glideTime: 45 },
    { name: 'SH-101 Liquid Sub', modeTag: 'soft', osc1Wave: 'pwm', osc2Wave: 'sine', filterType: 'lp24', freq: 65.41, macros: { cutoff: 0.42, resonance: 0.42, fmDirt: 0.14, ampDecay: 0.52, pitchEnv: 0.38, detune: 0.06 }, sub1Level: 0.85, sub2Level: 0.35, noiseMix: 0.02, sustain: 0.74, glideTime: 35 },
    { name: 'Sustained Drone Pedal', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 55, macros: { cutoff: 0.38, resonance: 0.28, fmDirt: 0.12, ampDecay: 0.88, pitchEnv: 0.12, detune: 0.18 }, sub1Level: 0.9, sub2Level: 0.55, noiseMix: 0.04, sustain: 0.92, glideTime: 90 },
    { name: 'Silk Fretless Glide', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp12', freq: 73.42, macros: { cutoff: 0.46, resonance: 0.34, fmDirt: 0.15, ampDecay: 0.64, pitchEnv: 0.22, detune: 0.12 }, sub1Level: 0.75, sub2Level: 0.25, noiseMix: 0.03, sustain: 0.78, glideTime: 110 },
    { name: 'Basic Channel Rolling Sub', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 61.74, macros: { cutoff: 0.36, resonance: 0.3, fmDirt: 0.16, ampDecay: 0.56, pitchEnv: 0.28, detune: 0.1 }, sub1Level: 0.88, sub2Level: 0.4, noiseMix: 0.02, sustain: 0.75, glideTime: 40 },
    { name: 'Juno Chorus Bass', modeTag: 'soft', osc1Wave: 'pwm', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 65.41, macros: { cutoff: 0.48, resonance: 0.32, fmDirt: 0.14, ampDecay: 0.54, pitchEnv: 0.3, detune: 0.28 }, sub1Level: 0.82, sub2Level: 0.3, noiseMix: 0.03, sustain: 0.72, glideTime: 25 },
    { name: 'Mellow Upright Pluck', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp24', freq: 55, macros: { cutoff: 0.4, resonance: 0.22, fmDirt: 0.1, ampDecay: 0.46, pitchEnv: 0.25, detune: 0.06 }, sub1Level: 0.84, sub2Level: 0.35, noiseMix: 0.05, sustain: 0.58, glideTime: 20 },
    { name: 'Submarine Pressure Bass', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'lp24', freq: 49, macros: { cutoff: 0.3, resonance: 0.38, fmDirt: 0.08, ampDecay: 0.82, pitchEnv: 0.15, detune: 0.08 }, sub1Level: 0.95, sub2Level: 0.6, noiseMix: 0.02, sustain: 0.88, glideTime: 80 },
    { name: 'Tape Warmth 808 Glide', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 55, macros: { cutoff: 0.38, resonance: 0.26, fmDirt: 0.22, ampDecay: 0.74, pitchEnv: 0.35, detune: 0.06 }, sub1Level: 0.9, sub2Level: 0.45, noiseMix: 0.03, sustain: 0.8, glideTime: 95 },
    // 10 Harsh
    { name: '303 Devilfish Overdrive', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp24', freq: 65.41, macros: { cutoff: 0.68, resonance: 0.86, fmDirt: 0.78, ampDecay: 0.48, pitchEnv: 0.82, detune: 0.14 }, sub1Level: 0.72, sub2Level: 0.25, noiseMix: 0.08, sustain: 0.68, glideTime: 55 },
    { name: 'Neurofunk Reese Monster', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 55, macros: { cutoff: 0.62, resonance: 0.54, fmDirt: 0.72, ampDecay: 0.84, pitchEnv: 0.45, detune: 0.52 }, sub1Level: 0.9, sub2Level: 0.5, noiseMix: 0.12, sustain: 0.88, glideTime: 85 },
    { name: 'West-Coast Wavefold Bass', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'sawtooth', filterType: 'lp12', freq: 65.41, macros: { cutoff: 0.72, resonance: 0.6, fmDirt: 0.88, ampDecay: 0.56, pitchEnv: 0.68, detune: 0.22 }, sub1Level: 0.82, sub2Level: 0.4, noiseMix: 0.1, sustain: 0.74, glideTime: 40 },
    { name: 'MS-20 Screaming Korg Bass', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp12', freq: 61.74, macros: { cutoff: 0.64, resonance: 0.88, fmDirt: 0.82, ampDecay: 0.52, pitchEnv: 0.75, detune: 0.18 }, sub1Level: 0.78, sub2Level: 0.35, noiseMix: 0.14, sustain: 0.7, glideTime: 35 },
    { name: 'Industrial Grind Saw', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'square', filterType: 'lp24', freq: 55, macros: { cutoff: 0.76, resonance: 0.58, fmDirt: 0.9, ampDecay: 0.68, pitchEnv: 0.6, detune: 0.44 }, sub1Level: 0.88, sub2Level: 0.48, noiseMix: 0.2, sustain: 0.8, glideTime: 50 },
    { name: 'FM Metallic Donk Bass', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'bp12', freq: 73.42, macros: { cutoff: 0.74, resonance: 0.64, fmDirt: 0.92, ampDecay: 0.42, pitchEnv: 0.78, detune: 0.24 }, sub1Level: 0.75, sub2Level: 0.3, noiseMix: 0.08, sustain: 0.6, glideTime: 20 },
    { name: 'Cyberpunk Mid-Bass Growl', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 65.41, macros: { cutoff: 0.7, resonance: 0.66, fmDirt: 0.84, ampDecay: 0.62, pitchEnv: 0.64, detune: 0.38 }, sub1Level: 0.85, sub2Level: 0.42, noiseMix: 0.15, sustain: 0.78, glideTime: 45 },
    { name: 'EBM Sequenced Aggressor', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 65.41, macros: { cutoff: 0.66, resonance: 0.62, fmDirt: 0.76, ampDecay: 0.44, pitchEnv: 0.8, detune: 0.2 }, sub1Level: 0.84, sub2Level: 0.38, noiseMix: 0.1, sustain: 0.65, glideTime: 15 },
    { name: 'Sub-Harmonic Seismic Wall', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'square', filterType: 'lp24', freq: 46.25, macros: { cutoff: 0.58, resonance: 0.7, fmDirt: 0.8, ampDecay: 0.9, pitchEnv: 0.5, detune: 0.48 }, sub1Level: 0.98, sub2Level: 0.7, noiseMix: 0.16, sustain: 0.92, glideTime: 100 },
    { name: 'Notch-Swept Wobble Bass', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'notch', freq: 55, macros: { cutoff: 0.64, resonance: 0.78, fmDirt: 0.85, ampDecay: 0.72, pitchEnv: 0.72, detune: 0.42 }, sub1Level: 0.88, sub2Level: 0.45, noiseMix: 0.12, sustain: 0.82, glideTime: 60 },
  ],

  // Track 06: ACID LEAD / SYNTH (10 Soft + 10 Harsh)
  lead: [
    { name: 'Silk Analog Ribbon Lead', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 130.81, macros: { cutoff: 0.54, resonance: 0.36, fmDirt: 0.16, ampDecay: 0.62, pitchEnv: 0.24, detune: 0.18 }, sub1Level: 0.35, sub2Level: 0.15, noiseMix: 0.04, sustain: 0.78, glideTime: 55 },
    { name: 'Boards of Canada Tape Lead', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp12', freq: 146.83, macros: { cutoff: 0.48, resonance: 0.28, fmDirt: 0.2, ampDecay: 0.68, pitchEnv: 0.15, detune: 0.26 }, sub1Level: 0.3, sub2Level: 0.1, noiseMix: 0.08, sustain: 0.82, glideTime: 75 },
    { name: 'Warm SH-101 Melodic', modeTag: 'soft', osc1Wave: 'pwm', osc2Wave: 'triangle', filterType: 'lp24', freq: 130.81, macros: { cutoff: 0.56, resonance: 0.42, fmDirt: 0.14, ampDecay: 0.54, pitchEnv: 0.32, detune: 0.12 }, sub1Level: 0.4, sub2Level: 0.15, noiseMix: 0.03, sustain: 0.74, glideTime: 40 },
    { name: 'Velvet Flute Harmonic', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 196.0, macros: { cutoff: 0.52, resonance: 0.24, fmDirt: 0.1, ampDecay: 0.72, pitchEnv: 0.12, detune: 0.14 }, sub1Level: 0.25, sub2Level: 0.1, noiseMix: 0.09, sustain: 0.85, glideTime: 65 },
    { name: 'Dub Siren Melodica', modeTag: 'soft', osc1Wave: 'square', osc2Wave: 'triangle', filterType: 'bp12', freq: 164.81, macros: { cutoff: 0.58, resonance: 0.46, fmDirt: 0.22, ampDecay: 0.64, pitchEnv: 0.38, detune: 0.16 }, sub1Level: 0.25, sub2Level: 0.1, noiseMix: 0.05, sustain: 0.76, glideTime: 80 },
    { name: 'Glass Harmonica Sing', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'lp24', freq: 220.0, macros: { cutoff: 0.6, resonance: 0.38, fmDirt: 0.24, ampDecay: 0.76, pitchEnv: 0.18, detune: 0.2 }, sub1Level: 0.2, sub2Level: 0.15, noiseMix: 0.03, sustain: 0.86, glideTime: 50 },
    { name: 'Soft Prophet Brass Lead', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 130.81, macros: { cutoff: 0.52, resonance: 0.32, fmDirt: 0.18, ampDecay: 0.66, pitchEnv: 0.28, detune: 0.24 }, sub1Level: 0.35, sub2Level: 0.15, noiseMix: 0.04, sustain: 0.8, glideTime: 45 },
    { name: 'Mellow Minimoog Fifth', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'triangle', filterType: 'lp24', freq: 146.83, macros: { cutoff: 0.55, resonance: 0.35, fmDirt: 0.16, ampDecay: 0.6, pitchEnv: 0.3, detune: 0.18 }, sub1Level: 0.4, sub2Level: 0.45, noiseMix: 0.03, sustain: 0.76, glideTime: 60 },
    { name: 'Pastel Dream Cry', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'pwm', filterType: 'lp24', freq: 174.61, macros: { cutoff: 0.5, resonance: 0.3, fmDirt: 0.12, ampDecay: 0.74, pitchEnv: 0.2, detune: 0.22 }, sub1Level: 0.3, sub2Level: 0.1, noiseMix: 0.05, sustain: 0.84, glideTime: 85 },
    { name: 'Subtle Buchla Sing', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 155.56, macros: { cutoff: 0.54, resonance: 0.44, fmDirt: 0.26, ampDecay: 0.58, pitchEnv: 0.34, detune: 0.14 }, sub1Level: 0.35, sub2Level: 0.15, noiseMix: 0.03, sustain: 0.72, glideTime: 50 },
    // 10 Harsh
    { name: 'TB-303 Acid Scream Lead', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp24', freq: 130.81, macros: { cutoff: 0.74, resonance: 0.9, fmDirt: 0.76, ampDecay: 0.52, pitchEnv: 0.86, detune: 0.16 }, sub1Level: 0.45, sub2Level: 0.2, noiseMix: 0.08, sustain: 0.7, glideTime: 60 },
    { name: 'Hoover Rave Dominator', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'pwm', filterType: 'lp12', freq: 130.81, macros: { cutoff: 0.8, resonance: 0.56, fmDirt: 0.78, ampDecay: 0.74, pitchEnv: 0.78, detune: 0.58 }, sub1Level: 0.65, sub2Level: 0.35, noiseMix: 0.14, sustain: 0.84, glideTime: 95 },
    { name: 'Cross-FM Screamer', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'bp12', freq: 164.81, macros: { cutoff: 0.78, resonance: 0.72, fmDirt: 0.94, ampDecay: 0.58, pitchEnv: 0.8, detune: 0.34 }, sub1Level: 0.4, sub2Level: 0.25, noiseMix: 0.16, sustain: 0.72, glideTime: 40 },
    { name: 'Industrial Siren Lead', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 146.83, macros: { cutoff: 0.76, resonance: 0.68, fmDirt: 0.84, ampDecay: 0.82, pitchEnv: 0.72, detune: 0.48 }, sub1Level: 0.5, sub2Level: 0.3, noiseMix: 0.18, sustain: 0.88, glideTime: 120 },
    { name: 'Polivoks Soviet Lead', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'bp12', freq: 130.81, macros: { cutoff: 0.7, resonance: 0.84, fmDirt: 0.88, ampDecay: 0.56, pitchEnv: 0.76, detune: 0.28 }, sub1Level: 0.5, sub2Level: 0.25, noiseMix: 0.15, sustain: 0.74, glideTime: 50 },
    { name: 'Wavefold Razor Sync', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'lp12', freq: 174.61, macros: { cutoff: 0.82, resonance: 0.62, fmDirt: 0.86, ampDecay: 0.6, pitchEnv: 0.84, detune: 0.32 }, sub1Level: 0.4, sub2Level: 0.2, noiseMix: 0.12, sustain: 0.76, glideTime: 35 },
    { name: 'Cyberpunk Anthem SuperSaw', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'supersaw', filterType: 'lp24', freq: 146.83, macros: { cutoff: 0.84, resonance: 0.52, fmDirt: 0.68, ampDecay: 0.78, pitchEnv: 0.58, detune: 0.54 }, sub1Level: 0.55, sub2Level: 0.3, noiseMix: 0.1, sustain: 0.86, glideTime: 45 },
    { name: 'Formant Vocal Shriek', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'bp12', freq: 196.0, macros: { cutoff: 0.72, resonance: 0.88, fmDirt: 0.82, ampDecay: 0.64, pitchEnv: 0.7, detune: 0.3 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.14, sustain: 0.78, glideTime: 55 },
    { name: 'Glitch Bit-Lead 8-Bit', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'square', filterType: 'lp12', freq: 220.0, macros: { cutoff: 0.86, resonance: 0.54, fmDirt: 0.9, ampDecay: 0.48, pitchEnv: 0.66, detune: 0.26 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.2, sustain: 0.68, glideTime: 25 },
    { name: 'High-Resonance Laser Sweep', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'triangle', filterType: 'lp24', freq: 164.81, macros: { cutoff: 0.76, resonance: 0.92, fmDirt: 0.74, ampDecay: 0.66, pitchEnv: 0.9, detune: 0.24 }, sub1Level: 0.4, sub2Level: 0.2, noiseMix: 0.1, sustain: 0.76, glideTime: 70 },
  ],

  // Track 07: DUB CHORD / PAD (10 Soft + 10 Harsh)
  chord: [
    { name: 'Basic Channel Dub Chord', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'pwm', filterType: 'lp24', freq: 261.63, macros: { cutoff: 0.46, resonance: 0.44, fmDirt: 0.16, ampDecay: 0.64, pitchEnv: 0.38, detune: 0.24 }, sub1Level: 0.45, sub2Level: 0.55, noiseMix: 0.06, sustain: 0.82, glideTime: 30 },
    { name: 'Velvet Minor 9th Pad', modeTag: 'soft', osc1Wave: 'supersaw', osc2Wave: 'triangle', filterType: 'lp24', freq: 220.0, macros: { cutoff: 0.48, resonance: 0.28, fmDirt: 0.12, ampDecay: 0.86, pitchEnv: 0.2, detune: 0.32 }, sub1Level: 0.5, sub2Level: 0.6, noiseMix: 0.05, sustain: 0.92, glideTime: 65 },
    { name: 'Warm Juno-60 Wash', modeTag: 'soft', osc1Wave: 'pwm', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 261.63, macros: { cutoff: 0.52, resonance: 0.32, fmDirt: 0.1, ampDecay: 0.8, pitchEnv: 0.25, detune: 0.36 }, sub1Level: 0.48, sub2Level: 0.45, noiseMix: 0.04, sustain: 0.88, glideTime: 45 },
    { name: 'Tape Loop Mellotron Choir', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'bp12', freq: 246.94, macros: { cutoff: 0.5, resonance: 0.36, fmDirt: 0.18, ampDecay: 0.84, pitchEnv: 0.15, detune: 0.28 }, sub1Level: 0.4, sub2Level: 0.5, noiseMix: 0.1, sustain: 0.9, glideTime: 70 },
    { name: 'Deep Underwater Organ', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 196.0, macros: { cutoff: 0.38, resonance: 0.3, fmDirt: 0.14, ampDecay: 0.78, pitchEnv: 0.18, detune: 0.2 }, sub1Level: 0.6, sub2Level: 0.65, noiseMix: 0.03, sustain: 0.88, glideTime: 40 },
    { name: 'Silk Harmonium Drone Pad', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'triangle', filterType: 'lp12', freq: 220.0, macros: { cutoff: 0.44, resonance: 0.26, fmDirt: 0.15, ampDecay: 0.88, pitchEnv: 0.14, detune: 0.26 }, sub1Level: 0.52, sub2Level: 0.58, noiseMix: 0.05, sustain: 0.94, glideTime: 80 },
    { name: 'Filtered Detroit Stab', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'pwm', filterType: 'lp24', freq: 261.63, macros: { cutoff: 0.54, resonance: 0.48, fmDirt: 0.2, ampDecay: 0.56, pitchEnv: 0.46, detune: 0.22 }, sub1Level: 0.42, sub2Level: 0.5, noiseMix: 0.04, sustain: 0.74, glideTime: 35 },
    { name: 'Cloudy Fender Rhodes', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 293.66, macros: { cutoff: 0.48, resonance: 0.24, fmDirt: 0.22, ampDecay: 0.7, pitchEnv: 0.22, detune: 0.16 }, sub1Level: 0.4, sub2Level: 0.45, noiseMix: 0.03, sustain: 0.8, glideTime: 25 },
    { name: 'Cathedral Shimmer Bed', modeTag: 'soft', osc1Wave: 'supersaw', osc2Wave: 'sine', filterType: 'lp24', freq: 261.63, macros: { cutoff: 0.56, resonance: 0.34, fmDirt: 0.14, ampDecay: 0.92, pitchEnv: 0.24, detune: 0.4 }, sub1Level: 0.45, sub2Level: 0.65, noiseMix: 0.06, sustain: 0.95, glideTime: 90 },
    { name: 'Analog Solina Strings', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'pwm', filterType: 'lp24', freq: 246.94, macros: { cutoff: 0.52, resonance: 0.28, fmDirt: 0.12, ampDecay: 0.85, pitchEnv: 0.18, detune: 0.34 }, sub1Level: 0.42, sub2Level: 0.52, noiseMix: 0.05, sustain: 0.9, glideTime: 55 },
    // 10 Harsh
    { name: 'Overdriven Dub Siren Stab', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'square', filterType: 'bp12', freq: 261.63, macros: { cutoff: 0.72, resonance: 0.74, fmDirt: 0.78, ampDecay: 0.6, pitchEnv: 0.68, detune: 0.38 }, sub1Level: 0.5, sub2Level: 0.6, noiseMix: 0.14, sustain: 0.78, glideTime: 40 },
    { name: 'Wavefolded Brass Swell', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 220.0, macros: { cutoff: 0.74, resonance: 0.58, fmDirt: 0.82, ampDecay: 0.78, pitchEnv: 0.56, detune: 0.44 }, sub1Level: 0.55, sub2Level: 0.65, noiseMix: 0.12, sustain: 0.86, glideTime: 60 },
    { name: 'Industrial Choir Wall', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'supersaw', filterType: 'bp12', freq: 196.0, macros: { cutoff: 0.68, resonance: 0.66, fmDirt: 0.86, ampDecay: 0.88, pitchEnv: 0.48, detune: 0.56 }, sub1Level: 0.65, sub2Level: 0.7, noiseMix: 0.22, sustain: 0.92, glideTime: 85 },
    { name: 'Rave Fifth Chord Blaster', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'square', filterType: 'lp12', freq: 261.63, macros: { cutoff: 0.8, resonance: 0.54, fmDirt: 0.72, ampDecay: 0.58, pitchEnv: 0.64, detune: 0.46 }, sub1Level: 0.5, sub2Level: 0.75, noiseMix: 0.1, sustain: 0.76, glideTime: 30 },
    { name: 'FM Metallic Glass Pad', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'hp12', freq: 293.66, macros: { cutoff: 0.7, resonance: 0.68, fmDirt: 0.9, ampDecay: 0.76, pitchEnv: 0.52, detune: 0.36 }, sub1Level: 0.35, sub2Level: 0.55, noiseMix: 0.15, sustain: 0.84, glideTime: 50 },
    { name: 'Notch-Phased Cyber Pad', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'pwm', filterType: 'notch', freq: 220.0, macros: { cutoff: 0.66, resonance: 0.76, fmDirt: 0.74, ampDecay: 0.84, pitchEnv: 0.6, detune: 0.5 }, sub1Level: 0.52, sub2Level: 0.6, noiseMix: 0.16, sustain: 0.88, glideTime: 70 },
    { name: 'Distorted Organ Grind', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 196.0, macros: { cutoff: 0.72, resonance: 0.62, fmDirt: 0.88, ampDecay: 0.72, pitchEnv: 0.45, detune: 0.32 }, sub1Level: 0.6, sub2Level: 0.65, noiseMix: 0.14, sustain: 0.85, glideTime: 35 },
    { name: 'Acid Bandpass Chord', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'bp12', freq: 246.94, macros: { cutoff: 0.68, resonance: 0.84, fmDirt: 0.76, ampDecay: 0.62, pitchEnv: 0.74, detune: 0.28 }, sub1Level: 0.45, sub2Level: 0.55, noiseMix: 0.1, sustain: 0.78, glideTime: 45 },
    { name: 'Dystopian Blade CS-80', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 220.0, macros: { cutoff: 0.76, resonance: 0.56, fmDirt: 0.7, ampDecay: 0.9, pitchEnv: 0.52, detune: 0.52 }, sub1Level: 0.58, sub2Level: 0.68, noiseMix: 0.12, sustain: 0.94, glideTime: 110 },
    { name: 'Bit-Shattered Swarm Stab', modeTag: 'harsh', osc1Wave: 'pwm', osc2Wave: 'square', filterType: 'lp12', freq: 261.63, macros: { cutoff: 0.82, resonance: 0.64, fmDirt: 0.92, ampDecay: 0.54, pitchEnv: 0.7, detune: 0.48 }, sub1Level: 0.45, sub2Level: 0.6, noiseMix: 0.2, sustain: 0.74, glideTime: 30 },
  ],

  // Track 08: PLUCK ARP (10 Soft + 10 Harsh)
  arp: [
    { name: 'Buchla Low-Pass Gate Pluck', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 392.0, macros: { cutoff: 0.56, resonance: 0.44, fmDirt: 0.22, ampDecay: 0.34, pitchEnv: 0.46, detune: 0.1 }, sub1Level: 0.25, sub2Level: 0.15, noiseMix: 0.03, sustain: 0.55, glideTime: 15 },
    { name: 'Silk Music Box Chime', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'sine', filterType: 'lp24', freq: 523.25, macros: { cutoff: 0.62, resonance: 0.3, fmDirt: 0.26, ampDecay: 0.42, pitchEnv: 0.2, detune: 0.08 }, sub1Level: 0.15, sub2Level: 0.25, noiseMix: 0.02, sustain: 0.62, glideTime: 10 },
    { name: 'Warm Analog Koto Pluck', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 329.63, macros: { cutoff: 0.54, resonance: 0.38, fmDirt: 0.18, ampDecay: 0.32, pitchEnv: 0.4, detune: 0.12 }, sub1Level: 0.3, sub2Level: 0.15, noiseMix: 0.05, sustain: 0.52, glideTime: 20 },
    { name: 'Celesta Starlight Bell', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 440.0, macros: { cutoff: 0.64, resonance: 0.28, fmDirt: 0.24, ampDecay: 0.48, pitchEnv: 0.18, detune: 0.14 }, sub1Level: 0.2, sub2Level: 0.3, noiseMix: 0.02, sustain: 0.68, glideTime: 15 },
    { name: 'Tangerine Berlin Sequencer', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'pwm', filterType: 'lp24', freq: 392.0, macros: { cutoff: 0.52, resonance: 0.46, fmDirt: 0.16, ampDecay: 0.36, pitchEnv: 0.48, detune: 0.18 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.03, sustain: 0.58, glideTime: 25 },
    { name: 'Soft Marimba Mallet', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 349.23, macros: { cutoff: 0.48, resonance: 0.34, fmDirt: 0.14, ampDecay: 0.28, pitchEnv: 0.32, detune: 0.06 }, sub1Level: 0.3, sub2Level: 0.15, noiseMix: 0.04, sustain: 0.48, glideTime: 10 },
    { name: 'Dewdrop Harp Harmonic', modeTag: 'soft', osc1Wave: 'triangle', osc2Wave: 'sine', filterType: 'lp24', freq: 493.88, macros: { cutoff: 0.58, resonance: 0.26, fmDirt: 0.12, ampDecay: 0.54, pitchEnv: 0.22, detune: 0.16 }, sub1Level: 0.2, sub2Level: 0.25, noiseMix: 0.02, sustain: 0.72, glideTime: 30 },
    { name: 'Dub Delay Sonar Pluck', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'bp12', freq: 440.0, macros: { cutoff: 0.56, resonance: 0.52, fmDirt: 0.2, ampDecay: 0.3, pitchEnv: 0.42, detune: 0.1 }, sub1Level: 0.2, sub2Level: 0.15, noiseMix: 0.03, sustain: 0.5, glideTime: 20 },
    { name: 'Velvet Pizzicato String', modeTag: 'soft', osc1Wave: 'sawtooth', osc2Wave: 'triangle', filterType: 'lp24', freq: 392.0, macros: { cutoff: 0.46, resonance: 0.3, fmDirt: 0.1, ampDecay: 0.26, pitchEnv: 0.36, detune: 0.18 }, sub1Level: 0.28, sub2Level: 0.15, noiseMix: 0.04, sustain: 0.45, glideTime: 15 },
    { name: 'Floating Glass Arp', modeTag: 'soft', osc1Wave: 'sine', osc2Wave: 'triangle', filterType: 'lp24', freq: 523.25, macros: { cutoff: 0.6, resonance: 0.35, fmDirt: 0.22, ampDecay: 0.62, pitchEnv: 0.25, detune: 0.2 }, sub1Level: 0.2, sub2Level: 0.35, noiseMix: 0.02, sustain: 0.78, glideTime: 40 },
    // 10 Harsh
    { name: 'Acid 303 Accented Pluck', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'lp24', freq: 392.0, macros: { cutoff: 0.74, resonance: 0.86, fmDirt: 0.72, ampDecay: 0.38, pitchEnv: 0.84, detune: 0.16 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.06, sustain: 0.58, glideTime: 35 },
    { name: 'DX7 Metallic FM Pluck', modeTag: 'harsh', osc1Wave: 'sine', osc2Wave: 'square', filterType: 'lp12', freq: 440.0, macros: { cutoff: 0.82, resonance: 0.54, fmDirt: 0.92, ampDecay: 0.42, pitchEnv: 0.62, detune: 0.28 }, sub1Level: 0.25, sub2Level: 0.35, noiseMix: 0.08, sustain: 0.6, glideTime: 15 },
    { name: 'Wavefold Buchla Bong-Arp', modeTag: 'harsh', osc1Wave: 'triangle', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 349.23, macros: { cutoff: 0.72, resonance: 0.68, fmDirt: 0.86, ampDecay: 0.36, pitchEnv: 0.78, detune: 0.24 }, sub1Level: 0.35, sub2Level: 0.25, noiseMix: 0.08, sustain: 0.55, glideTime: 20 },
    { name: 'Trance SuperSaw Gate Arp', modeTag: 'harsh', osc1Wave: 'supersaw', osc2Wave: 'sawtooth', filterType: 'lp24', freq: 440.0, macros: { cutoff: 0.84, resonance: 0.52, fmDirt: 0.64, ampDecay: 0.46, pitchEnv: 0.68, detune: 0.52 }, sub1Level: 0.4, sub2Level: 0.3, noiseMix: 0.1, sustain: 0.68, glideTime: 25 },
    { name: 'Chiptune SID Pulse Arp', modeTag: 'harsh', osc1Wave: 'pwm', osc2Wave: 'square', filterType: 'lp12', freq: 523.25, macros: { cutoff: 0.86, resonance: 0.48, fmDirt: 0.78, ampDecay: 0.32, pitchEnv: 0.72, detune: 0.22 }, sub1Level: 0.3, sub2Level: 0.2, noiseMix: 0.12, sustain: 0.52, glideTime: 10 },
    { name: 'Industrial Steel Wire', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'sawtooth', filterType: 'bp12', freq: 392.0, macros: { cutoff: 0.78, resonance: 0.74, fmDirt: 0.88, ampDecay: 0.44, pitchEnv: 0.75, detune: 0.38 }, sub1Level: 0.3, sub2Level: 0.25, noiseMix: 0.15, sustain: 0.62, glideTime: 20 },
    { name: 'Comb-Resonant Karplus', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'square', filterType: 'bp12', freq: 329.63, macros: { cutoff: 0.76, resonance: 0.88, fmDirt: 0.8, ampDecay: 0.4, pitchEnv: 0.8, detune: 0.26 }, sub1Level: 0.35, sub2Level: 0.2, noiseMix: 0.18, sustain: 0.58, glideTime: 15 },
    { name: 'Laser Sequencer Blip', modeTag: 'harsh', osc1Wave: 'sawtooth', osc2Wave: 'triangle', filterType: 'lp12', freq: 493.88, macros: { cutoff: 0.88, resonance: 0.62, fmDirt: 0.74, ampDecay: 0.28, pitchEnv: 0.94, detune: 0.2 }, sub1Level: 0.25, sub2Level: 0.15, noiseMix: 0.08, sustain: 0.45, glideTime: 10 },
    { name: 'Overdriven Harpsichord', modeTag: 'harsh', osc1Wave: 'pwm', osc2Wave: 'sawtooth', filterType: 'hp12', freq: 440.0, macros: { cutoff: 0.7, resonance: 0.58, fmDirt: 0.84, ampDecay: 0.38, pitchEnv: 0.55, detune: 0.32 }, sub1Level: 0.25, sub2Level: 0.2, noiseMix: 0.14, sustain: 0.56, glideTime: 15 },
    { name: 'Glitch Ring-Mod Arp', modeTag: 'harsh', osc1Wave: 'square', osc2Wave: 'square', filterType: 'bp12', freq: 587.33, macros: { cutoff: 0.8, resonance: 0.7, fmDirt: 0.95, ampDecay: 0.36, pitchEnv: 0.82, detune: 0.44 }, sub1Level: 0.2, sub2Level: 0.3, noiseMix: 0.16, sustain: 0.54, glideTime: 20 },
  ],
};

export interface AetherDronePresetItem {
  name: string;
  modeTag: TimbreCharacter;
  chordType: ChordVoicingType;
  baseFreq: number;
  driftDetune: number;
  subLevel: number;
  waveFold: number;
  fmIndex: number;
  swarmLevel: number;
}

/**
 * 20 Presets for Module 04 // Harmonic Drone Bank (10 Soft Silk + 10 Harsh)
 */
export const AETHER_DRONE_PRESETS: AetherDronePresetItem[] = [
  // 10 Soft Silk Drone Presets
  { name: 'Coppice Velvet Min7', modeTag: 'soft', chordType: 'min7', baseFreq: 55.0, driftDetune: 14, subLevel: 0.78, waveFold: 0.18, fmIndex: 0.12, swarmLevel: 0.8 },
  { name: 'Silk Rain Unison Foundation', modeTag: 'soft', chordType: 'unison', baseFreq: 65.41, driftDetune: 18, subLevel: 0.85, waveFold: 0.12, fmIndex: 0.08, swarmLevel: 0.76 },
  { name: 'Cathedral Minor 9th Choir', modeTag: 'soft', chordType: 'min9', baseFreq: 49.0, driftDetune: 22, subLevel: 0.74, waveFold: 0.15, fmIndex: 0.14, swarmLevel: 0.86 },
  { name: 'Deep Ocean Sub Fifth', modeTag: 'soft', chordType: 'fifth', baseFreq: 41.2, driftDetune: 10, subLevel: 0.92, waveFold: 0.1, fmIndex: 0.06, swarmLevel: 0.72 },
  { name: 'Warm Tape Harmonium', modeTag: 'soft', chordType: 'min7', baseFreq: 58.27, driftDetune: 16, subLevel: 0.7, waveFold: 0.22, fmIndex: 0.16, swarmLevel: 0.82 },
  { name: 'Foghorn Harbor Pedal', modeTag: 'soft', chordType: 'fifth', baseFreq: 46.25, driftDetune: 12, subLevel: 0.88, waveFold: 0.2, fmIndex: 0.1, swarmLevel: 0.78 },
  { name: 'Zero-Gravity Cloud Bed', modeTag: 'soft', chordType: 'min9', baseFreq: 73.42, driftDetune: 26, subLevel: 0.65, waveFold: 0.14, fmIndex: 0.18, swarmLevel: 0.88 },
  { name: 'Moss Forest Undertone', modeTag: 'soft', chordType: 'min7', baseFreq: 51.91, driftDetune: 15, subLevel: 0.82, waveFold: 0.16, fmIndex: 0.12, swarmLevel: 0.75 },
  { name: 'Analog Sunset Drift', modeTag: 'soft', chordType: 'min9', baseFreq: 61.74, driftDetune: 20, subLevel: 0.76, waveFold: 0.18, fmIndex: 0.15, swarmLevel: 0.84 },
  { name: 'Subterranean Velvet Hum', modeTag: 'soft', chordType: 'unison', baseFreq: 36.71, driftDetune: 8, subLevel: 0.95, waveFold: 0.08, fmIndex: 0.05, swarmLevel: 0.7 },
  // 10 Harsh Drone Presets
  { name: 'West-Coast Wavefold Fifth', modeTag: 'harsh', chordType: 'fifth', baseFreq: 41.2, driftDetune: 18, subLevel: 0.88, waveFold: 0.68, fmIndex: 0.45, swarmLevel: 0.85 },
  { name: 'Reactor Core Overload', modeTag: 'harsh', chordType: 'unison', baseFreq: 48.99, driftDetune: 28, subLevel: 0.92, waveFold: 0.82, fmIndex: 0.62, swarmLevel: 0.9 },
  { name: 'Industrial Swarm Min7', modeTag: 'harsh', chordType: 'min7', baseFreq: 55.0, driftDetune: 32, subLevel: 0.84, waveFold: 0.74, fmIndex: 0.54, swarmLevel: 0.88 },
  { name: 'Tectonic Sub-Bass Monolith', modeTag: 'harsh', chordType: 'fifth', baseFreq: 34.65, driftDetune: 22, subLevel: 0.98, waveFold: 0.78, fmIndex: 0.48, swarmLevel: 0.92 },
  { name: 'Metallic FM Cluster Min9', modeTag: 'harsh', chordType: 'min9', baseFreq: 65.41, driftDetune: 34, subLevel: 0.75, waveFold: 0.64, fmIndex: 0.85, swarmLevel: 0.86 },
  { name: 'Cybernetic Hive Detune', modeTag: 'harsh', chordType: 'unison', baseFreq: 58.27, driftDetune: 35, subLevel: 0.86, waveFold: 0.72, fmIndex: 0.58, swarmLevel: 0.94 },
  { name: 'High-Voltage Power Grid', modeTag: 'harsh', chordType: 'fifth', baseFreq: 60.0, driftDetune: 16, subLevel: 0.9, waveFold: 0.88, fmIndex: 0.66, swarmLevel: 0.86 },
  { name: 'Dystopian Brass Horizon', modeTag: 'harsh', chordType: 'min9', baseFreq: 51.91, driftDetune: 26, subLevel: 0.82, waveFold: 0.66, fmIndex: 0.42, swarmLevel: 0.9 },
  { name: 'Buchla Chaos Fold Swarm', modeTag: 'harsh', chordType: 'min7', baseFreq: 43.65, driftDetune: 30, subLevel: 0.88, waveFold: 0.84, fmIndex: 0.74, swarmLevel: 0.88 },
  { name: 'Doom Engine Pedal Wall', modeTag: 'harsh', chordType: 'fifth', baseFreq: 32.7, driftDetune: 24, subLevel: 1.0, waveFold: 0.9, fmIndex: 0.6, swarmLevel: 0.95 },
];

export function applyMacroToAetherVoice(
  voice: BeatVoiceSynthConfig,
  macroKey: keyof BeatVoiceSynthConfig['macros'],
  value: number
): BeatVoiceSynthConfig {
  const nextMacros = { ...voice.macros, [macroKey]: value };
  const next: BeatVoiceSynthConfig = {
    ...voice,
    macros: nextMacros,
    osc1: { ...voice.osc1 },
    osc2: { ...voice.osc2 },
    sub1: { ...voice.sub1 },
    sub2: { ...voice.sub2 },
    noise: { ...voice.noise },
    filter: { ...voice.filter },
    ampEnv: { ...voice.ampEnv },
    filterEnv: { ...voice.filterEnv },
    modEnv: { ...voice.modEnv },
    voice: { ...voice.voice },
  };

  if (macroKey === 'cutoff') {
    const clamped = Math.min(1, Math.max(0, value));
    const hz = Math.round(45 * Math.pow(16000 / 45, clamped));
    next.cutoff = hz;
    next.filter.cutoff = hz;
  } else if (macroKey === 'resonance') {
    const clamped = Math.min(1, Math.max(0, value));
    const q = Number((0.5 + clamped * 15.5).toFixed(2));
    next.res = q;
    next.filter.resonance = q;
  } else if (macroKey === 'fmDirt') {
    const clamped = Math.min(1, Math.max(0, value));
    next.osc2.fmDepth = Number((clamped * 0.85).toFixed(2));
    next.drive = Number((clamped * 0.8).toFixed(2));
    next.filter.drive = Number((clamped * 0.8).toFixed(2));
  } else if (macroKey === 'ampDecay') {
    const clamped = Math.min(1, Math.max(0.03, value));
    const dec = Number((clamped * 1.25).toFixed(3));
    next.decay = dec;
    next.ampEnv.decay = dec;
    next.filterEnv.decay = Number((clamped * 1.0).toFixed(3));
  } else if (macroKey === 'pitchEnv') {
    const clamped = Math.min(1, Math.max(-1, value));
    next.pEnvAmt = Math.abs(clamped);
    next.filter.envDepth = Number(clamped.toFixed(2));
    next.filtEnv = Math.round(clamped * 3200);
    next.modEnv.pitchDepth = Number(clamped.toFixed(2));
  } else if (macroKey === 'detune') {
    const clamped = Math.min(1, Math.max(0, value));
    next.voice.unisonDetune = Math.round(clamped * 60);
    next.osc2.fine = Math.round(clamped * 35);
  }

  return next;
}

export function createBaseBeatVoice(
  key: BeatVoiceKey
): BeatVoiceSynthConfig {
  const meta =
    AETHER_TRACK_META.find((m) => m.key === key) ?? AETHER_TRACK_META[0];
  const isDrum = meta.isDrum;

  const base: BeatVoiceSynthConfig = {
    presetName: `${meta.shortLabel} Init`,
    wave: isDrum ? 'sine' : 'sawtooth',
    filterType: key === 'hat' ? 'highpass' : key === 'rim' ? 'bandpass' : 'lowpass',
    freq: meta.defaultFreq,
    pEnvAmt: isDrum ? 0.55 : 0.25,
    pEnvDec: isDrum ? 0.065 : 0.12,
    noiseMix: key === 'hat' ? 0.85 : key === 'rim' ? 0.3 : 0.05,
    cutoff: key === 'hat' ? 5400 : isDrum ? 950 : 2200,
    res: 2.5,
    filtEnv: 1200,
    drive: 0.28,
    attack: key === 'chord' ? 0.025 : 0.002,
    decay: isDrum ? 0.32 : 0.48,
    sustain: isDrum ? 0.15 : 0.75,
    release: isDrum ? 0.14 : 0.24,
    osc1: {
      wave: key === 'chord' ? 'supersaw' : isDrum ? 'sine' : 'sawtooth',
      coarse: 0,
      fine: 0,
      pwm: 0.5,
      level: 0.88,
    },
    osc2: {
      wave: isDrum ? 'triangle' : 'square',
      coarse: key === 'chord' ? 7 : 0,
      fine: isDrum ? 0 : 9,
      fmDepth: 0.18,
      ringMod: 0,
      hardSync: false,
      level: isDrum ? 0.35 : 0.55,
    },
    sub1: {
      wave: 'sine',
      level: key === 'kick' || key === 'bass' ? 0.85 : 0.35,
    },
    sub2: {
      wave: 'triangle',
      semitoneOffset: key === 'chord' ? 7 : -24,
      level: key === 'kick' || key === 'bass' || key === 'chord' ? 0.4 : 0.15,
    },
    noise: {
      type: 'pink',
      filterCutoff: 3600,
      level: key === 'hat' ? 0.85 : key === 'rim' ? 0.3 : 0.05,
    },
    filter: {
      type: key === 'hat' ? 'hp12' : key === 'rim' ? 'bp12' : 'lp24',
      cutoff: key === 'hat' ? 5400 : isDrum ? 950 : 2200,
      resonance: 2.5,
      drive: 0.28,
      envDepth: 0.45,
      keyTracking: isDrum ? 0.1 : 0.65,
      velocityTimbre: 0.5,
    },
    ampEnv: {
      attack: key === 'chord' ? 0.025 : 0.002,
      decay: isDrum ? 0.32 : 0.48,
      sustain: isDrum ? 0.15 : 0.75,
      release: isDrum ? 0.14 : 0.24,
    },
    filterEnv: {
      attack: 0.003,
      decay: 0.3,
      sustain: 0.2,
      release: 0.2,
    },
    modEnv: {
      attack: 0.001,
      decay: 0.09,
      sustain: 0,
      release: 0.05,
      pitchDepth: isDrum ? 0.55 : 0.2,
    },
    lfo1: {
      shape: 'sine',
      rateHz: 1.8,
      depth: 0.15,
    },
    lfo2: {
      shape: 'triangle',
      rateHz: 0.45,
      depth: 0.1,
    },
    voice: {
      mode: key === 'chord' ? 'poly' : 'mono',
      unisonVoices: key === 'chord' ? 3 : 2,
      unisonDetune: isDrum ? 6 : 16,
      stereoSpread: isDrum ? 0.2 : 0.55,
      glideTime: key === 'bass' || key === 'lead' ? 45 : 0,
      analogSlop: 0.18,
    },
    macros: {
      cutoff: 0.5,
      resonance: 0.25,
      fmDirt: 0.2,
      ampDecay: 0.35,
      pitchEnv: 0.4,
      detune: 0.15,
    },
  };

  const firstPreset = AETHER_TRACK_PRESET_BANKS[key]?.[0];
  return firstPreset ? applyAetherTrackPreset(base, firstPreset) : base;
}

export function applyAetherTrackPreset(
  baseVoice: BeatVoiceSynthConfig,
  preset: AetherTrackPresetItem
): BeatVoiceSynthConfig {
  let next: BeatVoiceSynthConfig = {
    ...baseVoice,
    presetName: preset.name,
    freq: preset.freq,
    wave:
      preset.osc1Wave === 'supersaw'
        ? 'sawtooth'
        : preset.osc1Wave === 'pwm'
          ? 'square'
          : preset.osc1Wave,
    filterType:
      preset.filterType === 'hp12'
        ? 'highpass'
        : preset.filterType === 'bp12'
          ? 'bandpass'
          : 'lowpass',
    noiseMix: preset.noiseMix,
    sustain: preset.sustain,
    osc1: { ...baseVoice.osc1, wave: preset.osc1Wave },
    osc2: { ...baseVoice.osc2, wave: preset.osc2Wave },
    sub1: { ...baseVoice.sub1, level: preset.sub1Level },
    sub2: { ...baseVoice.sub2, level: preset.sub2Level },
    noise: { ...baseVoice.noise, level: preset.noiseMix },
    filter: { ...baseVoice.filter, type: preset.filterType },
    ampEnv: { ...baseVoice.ampEnv, sustain: preset.sustain },
    voice: {
      ...baseVoice.voice,
      mode: preset.osc1Wave === 'supersaw' ? 'unison' : baseVoice.voice.mode,
      glideTime: preset.glideTime ?? baseVoice.voice.glideTime,
    },
  };

  for (const [k, v] of Object.entries(preset.macros)) {
    next = applyMacroToAetherVoice(
      next,
      k as keyof BeatVoiceSynthConfig['macros'],
      v
    );
  }
  return next;
}

export function createDefaultBeatVoices(
  presetIndices?: [number, number, number, number, number, number, number, number]
): Record<BeatVoiceKey, BeatVoiceSynthConfig> {
  const out = {} as Record<BeatVoiceKey, BeatVoiceSynthConfig>;
  AETHER_TRACK_META.forEach((meta, idx) => {
    const base = createBaseBeatVoice(meta.key);
    const bank = AETHER_TRACK_PRESET_BANKS[meta.key] ?? [];
    const chosenIdx = presetIndices?.[idx] ?? 0;
    const chosen = bank[chosenIdx] ?? bank[0];
    out[meta.key] = chosen ? applyAetherTrackPreset(base, chosen) : base;
  });
  return out;
}

export function createDefaultOutputMixer(): Record<
  DirectOutputChannelKey,
  OutputChannelFxConfig
> {
  const makeCh = (level: number, pan = 0, revSend = 0.25): OutputChannelFxConfig => ({
    level,
    pan,
    mute: false,
    solo: false,
    fxBypass: false,
    fx: {
      satDrive: 0.22,
      crushAmt: 0.0,
      chorusRate: 0.45,
      chorusMix: 0.18,
      hpFreq: 30,
      lpFreq: 14000,
      filtRes: 1.0,
      revSend,
    },
  });

  return {
    drone: makeCh(0.76, 0, 0.45),
    subOsc: makeCh(0.68, 0, 0.05),
    noiseLab: makeCh(0.32, -0.15, 0.55),
    zdfFilt: makeCh(0.72, 0.1, 0.38),
    subPulse: makeCh(0.64, 0, 0.18),
    kick: makeCh(0.82, 0, 0.08),
    beatBus: makeCh(0.76, 0, 0.28),
    foldFx: makeCh(0.35, -0.2, 0.42),
    tapeDly: makeCh(0.58, 0.2, 0.62),
    biosphere: makeCh(0.48, 0, 0.52),
  };
}

export function createXoxPatternFromStyle(
  style: 'dub' | 'minimal' | 'polyrhythm' | 'clear',
  barCount: 1 | 2 | 4 = 2,
  trackLengths: number[] = [16, 16, 16, 16, 16, 16, 16, 16]
): XoxPatternBank {
  const normalizedLens = Array.from(
    { length: 8 },
    (_, i) => trackLengths[i] ?? 16
  );
  const steps: number[][] = Array.from({ length: 8 }, () =>
    new Array(64).fill(0)
  );
  const notes: number[][] = AETHER_TRACK_META.map((m) =>
    new Array(64).fill(m.defaultMidiNote)
  );

  if (style === 'clear') {
    return { barCount, trackLengths: normalizedLens, steps, notes };
  }

  for (let bar = 0; bar < 4; bar++) {
    const offset = bar * 16;
    if (style === 'dub') {
      // 01 Sub Kick on 0, 6, 10
      [0, 6, 10].forEach((s) => (steps[0][offset + s] = 1));
      // 02 Dub Rim on 4, 12
      [4, 12].forEach((s) => (steps[1][offset + s] = 1));
      if (bar % 2 === 1) steps[1][offset + 15] = 1;
      // 03 Dust Hat offbeats & dub shuffles
      [2, 5, 6, 10, 13, 14].forEach((s) => (steps[2][offset + s] = 1));
      // 04 Wood Tom syncopated undertone
      [3, 11, 14].forEach((s) => (steps[3][offset + s] = 1));
      // 05 Sub Bass (multi-beat extended sustained notes!)
      steps[4][offset + 0] = 6;
      notes[4][offset + 0] = 36;
      steps[4][offset + 8] = 8;
      notes[4][offset + 8] = 43;
      // 06 Acid Lead (sustained dub motif)
      steps[5][offset + 4] = 4;
      notes[5][offset + 4] = 55;
      steps[5][offset + 12] = 4;
      notes[5][offset + 12] = 51;
      // 07 Dub Chord (extended 8-step = 2-beat chord swell)
      steps[6][offset + 2] = 6;
      notes[6][offset + 2] = 60;
      steps[6][offset + 10] = 6;
      notes[6][offset + 10] = 58;
      // 08 Pluck Arp
      [0, 3, 6, 9, 12, 14].forEach((s, i) => {
        steps[7][offset + s] = 2;
        notes[7][offset + s] = 60 + ((i * 3) % 12);
      });
    } else if (style === 'minimal') {
      [0, 8].forEach((s) => (steps[0][offset + s] = 1));
      [4, 12].forEach((s) => (steps[1][offset + s] = 1));
      [2, 6, 10, 14].forEach((s) => (steps[2][offset + s] = 1));
      [7, 15].forEach((s) => (steps[3][offset + s] = 1));
      steps[4][offset + 0] = 8;
      steps[4][offset + 8] = 8;
      notes[4][offset + 8] = 39;
      steps[5][offset + 6] = 4;
      steps[6][offset + 0] = 16; // Full 1-bar sustained chord!
      [2, 10].forEach((s) => (steps[7][offset + s] = 4));
    } else if (style === 'polyrhythm') {
      [0, 5, 10].forEach((s) => (steps[0][offset + s] = 1));
      [3, 7, 11].forEach((s) => (steps[1][offset + s] = 1));
      [0, 2, 4, 7, 9, 11].forEach((s) => (steps[2][offset + s] = 1));
      [1, 4, 8, 10].forEach((s) => (steps[3][offset + s] = 1));
      steps[4][offset + 0] = 4;
      steps[4][offset + 5] = 5;
      notes[4][offset + 5] = 41;
      steps[4][offset + 10] = 6;
      notes[4][offset + 10] = 38;
      steps[5][offset + 0] = 4;
      steps[5][offset + 8] = 6;
      notes[5][offset + 8] = 53;
      steps[6][offset + 0] = 8;
      steps[6][offset + 8] = 8;
      notes[6][offset + 8] = 63;
      [0, 3, 6, 9, 12].forEach((s, i) => {
        steps[7][offset + s] = 2;
        notes[7][offset + s] = 62 + ((i * 2) % 10);
      });
    }
  }

  return { barCount, trackLengths: normalizedLens, steps, notes };
}

export function createDefaultParams(): Record<string, Record<string, number>> {
  return {
    euclid: { stepsA: 16, hitsA: 5, hitsB: 3, humanize: 0.12 },
    drone: {
      baseFreq: 55,
      driftDetune: 14,
      subLevel: 0.72,
      waveFold: 0.24,
      fmIndex: 0.18,
      swarmLevel: 0.78,
    },
    noise: {
      formant: 920,
      resonance: 3.4,
      vinylDust: 0.42,
      tapeHiss: 0.28,
      width: 0.75,
      noiseLevel: 0.36,
    },
    filter: {
      cutoff: 1450,
      resonance: 3.2,
      satDrive: 0.32,
      fm1Atten: 0.45,
      fm2Atten: -0.25,
      filtLevel: 0.82,
    },
    pulse: {
      subPitch: 46,
      punchDrop: 0.65,
      vactrolDec: 0.68,
      lpgWarmth: 0.72,
      woodSnap: 0.34,
      pulseLevel: 0.7,
    },
    mod: {
      lfo1Hz: 0.18,
      lfo2Hz: 0.65,
      chaosSlew: 0.45,
    },
    fx: {
      wavefold: 0.35,
      bitCrush: 0.18,
      toneFilt: 2800,
      filtRes: 2.1,
      cvDepth: 0.4,
      fxMix: 0.42,
    },
    delay: {
      tapeTime: 0.42,
      feedback: 0.68,
      tapeDamp: 2400,
      wowFlut: 0.32,
      headPan: 0.65,
      echoWet: 0.48,
    },
    mixer: {
      ch1Drone: 0.78,
      ch2Beat: 0.76,
      ch3Aux: 0.54,
      ch4Echo: 0.62,
      cavernRev: 0.58,
      beatPump: 0.48,
    },
    biosphere: {
      rainLvl: 0.35,
      rainSize: 0.52,
      waterFlow: 0.28,
      brookBub: 0.4,
      wavesLvl: 0.45,
      tideSpeed: 0.22,
      windGust: 0.32,
      stormProb: 0.25,
    },
  };
}

export interface FactoryPatchMeta {
  id: string;
  name: string;
  tagline: string;
  modeTag: TimbreCharacter; // 'soft' | 'harsh'
  patch: Aether8PatchV4;
}

function buildFactoryPatch(
  name: string,
  overrides: Partial<Aether8PatchV4>,
  paramOverrides?: Record<string, Partial<Record<string, number>>>,
  presetIndices?: [number, number, number, number, number, number, number, number],
  dronePresetIdx?: number
): Aether8PatchV4 {
  const baseParams = createDefaultParams();
  const dronePreset =
    dronePresetIdx !== undefined
      ? AETHER_DRONE_PRESETS[dronePresetIdx]
      : undefined;

  if (dronePreset) {
    baseParams.drone = {
      baseFreq: dronePreset.baseFreq,
      driftDetune: dronePreset.driftDetune,
      subLevel: dronePreset.subLevel,
      waveFold: dronePreset.waveFold,
      fmIndex: dronePreset.fmIndex,
      swarmLevel: dronePreset.swarmLevel,
    };
  }

  if (paramOverrides) {
    for (const [modKey, modVals] of Object.entries(paramOverrides)) {
      baseParams[modKey] = {
        ...baseParams[modKey],
        ...(modVals as Record<string, number>),
      };
    }
  }

  const xoxPatterns: Record<PatternBankId, XoxPatternBank> = {
    A: createXoxPatternFromStyle('dub', 2, [16, 16, 16, 16, 16, 16, 16, 16]),
    B: createXoxPatternFromStyle('polyrhythm', 2, [16, 16, 13, 11, 16, 12, 16, 14]),
    C: createXoxPatternFromStyle('minimal', 1, [16, 16, 16, 16, 16, 16, 16, 16]),
    D: createXoxPatternFromStyle('dub', 4, [16, 12, 16, 14, 16, 16, 16, 12]),
  };

  const isLowSpecDevice =
    typeof navigator !== 'undefined' &&
    ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      /Android|CrOS|Chromebook|tablet/i.test(navigator.userAgent));

  return {
    version: 'AETHER-8-v4',
    name,
    savedAt: new Date().toISOString(),
    bpm: 68,
    masterVol: 0.8,
    timbreMode: 'soft',
    chordType: dronePreset?.chordType ?? 'min7',
    dronePresetName: dronePreset?.name ?? AETHER_DRONE_PRESETS[0].name,
    noiseColor: 'pink',
    filterType: 'lp24',
    activePattern: 'A',
    ecoMode: isLowSpecDevice,
    patternChainEnabled: false,
    xoxAutoFollow: true,
    xoxPatterns,
    xoxMuted: Array(8).fill(false),
    xoxNormLink: Array(8).fill(true),
    clockExtStepMode: false,
    beatVoices: createDefaultBeatVoices(presetIndices),
    outputMixer: createDefaultOutputMixer(),
    params: baseParams,
    cables: [
      {
        id: 'c_1',
        from: 'xox:barTrig',
        to: 'mod:lfoResetIn',
        type: 'trig',
        attenuation: 1.0,
      },
      {
        id: 'c_2',
        from: 'xox:stepClk',
        to: 'clock:stepIn',
        type: 'trig',
        attenuation: 1.0,
      },
      {
        id: 'c_3',
        from: 'clock:euclidA',
        to: 'pulse:trigIn',
        type: 'trig',
        attenuation: 1.0,
      },
      {
        id: 'c_4',
        from: 'mod:lfo1Out',
        to: 'filter:fm1Cv',
        type: 'cv',
        attenuation: 0.65,
      },
      {
        id: 'c_5',
        from: 'beats:envOut',
        to: 'delay:fbackCv',
        type: 'cv',
        attenuation: 0.45,
      },
    ],
    matrixSlots: [
      { enabled: true, source: 'lfo1', depth: 0.45, dest: 'filter.cutoff' },
      { enabled: true, source: 'lfo2', depth: 0.25, dest: 'drone.detune' },
      { enabled: true, source: 'chaos', depth: 0.35, dest: 'noise.formant' },
      { enabled: true, source: 'sh', depth: -0.3, dest: 'delay.time' },
      { enabled: false, source: 'lfo1', depth: 0.2, dest: 'pulse.decay' },
      { enabled: false, source: 'chaos', depth: 0.15, dest: 'drone.morph' },
    ],
    ...overrides,
  };
}

/**
 * Ensures any older 4-track patch loaded from IndexedDB or JSON file is upgraded
 * to 8 tracks and full Studio Synth configurations without missing fields.
 */
export function normalizeAether8Patch(raw: Aether8PatchV4): Aether8PatchV4 {
  const defaults = createDefaultBeatVoices();
  const nextVoices = { ...defaults };

  for (const key of BEAT_VOICE_KEYS) {
    const existing = raw.beatVoices?.[key];
    if (existing) {
      nextVoices[key] = {
        ...defaults[key],
        ...existing,
        osc1: { ...defaults[key].osc1, ...(existing.osc1 ?? {}) },
        osc2: { ...defaults[key].osc2, ...(existing.osc2 ?? {}) },
        sub1: { ...defaults[key].sub1, ...(existing.sub1 ?? {}) },
        sub2: { ...defaults[key].sub2, ...(existing.sub2 ?? {}) },
        noise: { ...defaults[key].noise, ...(existing.noise ?? {}) },
        filter: { ...defaults[key].filter, ...(existing.filter ?? {}) },
        ampEnv: { ...defaults[key].ampEnv, ...(existing.ampEnv ?? {}) },
        filterEnv: { ...defaults[key].filterEnv, ...(existing.filterEnv ?? {}) },
        modEnv: { ...defaults[key].modEnv, ...(existing.modEnv ?? {}) },
        lfo1: { ...defaults[key].lfo1, ...(existing.lfo1 ?? {}) },
        lfo2: { ...defaults[key].lfo2, ...(existing.lfo2 ?? {}) },
        voice: { ...defaults[key].voice, ...(existing.voice ?? {}) },
        macros: { ...defaults[key].macros, ...(existing.macros ?? {}) },
      };
    }
  }

  const nextPatterns = {} as Record<PatternBankId, XoxPatternBank>;
  for (const pid of ['A', 'B', 'C', 'D'] as PatternBankId[]) {
    const pBank = raw.xoxPatterns?.[pid] ?? createXoxPatternFromStyle('dub');
    const lens = Array.from(
      { length: 8 },
      (_, i) => pBank.trackLengths?.[i] ?? 16
    );
    const steps = Array.from({ length: 8 }, (_, i) => {
      const row = pBank.steps?.[i];
      return row && row.length === 64 ? [...row] : new Array(64).fill(0);
    });
    const notes = AETHER_TRACK_META.map((m, i) => {
      const row = pBank.notes?.[i];
      return row && row.length === 64
        ? [...row]
        : new Array(64).fill(m.defaultMidiNote);
    });
    nextPatterns[pid] = {
      barCount: pBank.barCount ?? 2,
      trackLengths: lens,
      steps,
      notes,
    };
  }

  return {
    ...raw,
    dronePresetName: raw.dronePresetName ?? AETHER_DRONE_PRESETS[0].name,
    xoxPatterns: nextPatterns,
    xoxMuted: Array.from({ length: 8 }, (_, i) => raw.xoxMuted?.[i] ?? false),
    xoxNormLink: Array.from(
      { length: 8 },
      (_, i) => raw.xoxNormLink?.[i] ?? true
    ),
    beatVoices: nextVoices,
  };
}

export function computeEuclideanSteps(
  stepsCount: number,
  pulses: number,
  rotation: number = 0
): boolean[] {
  const n = Math.max(1, Math.min(32, Math.round(stepsCount)));
  const k = Math.max(0, Math.min(n, Math.round(pulses)));
  const raw: boolean[] = new Array(n).fill(false);
  if (k > 0) {
    for (let i = 0; i < n; i++) {
      if (((i * k) % n) < k) {
        raw[i] = true;
      }
    }
  }
  const rot = ((Math.round(rotation) % n) + n) % n;
  return raw.map((_, idx) => raw[(idx - rot + n) % n]);
}

/**
 * 20 Factory Sample Patches for AETHER-8 v4:
 * - 10 SOFT SILK Mode Sample Patches (`modeTag: 'soft'`)
 * - 10 HARSH Mode Sample Patches (`modeTag: 'harsh'`)
 */
export const AETHER8_FACTORY_PATCHES: FactoryPatchMeta[] = [
  // ==========================================================================
  // 10 SOFT SILK MODE SAMPLE PATCHES
  // ==========================================================================
  {
    id: 'coppice-dub',
    name: 'COPPICE DUB',
    tagline: 'Brian Grainger Inspired Hypnotic Velvet Dub-Drone',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'COPPICE DUB',
      { bpm: 68, timbreMode: 'soft', chordType: 'min7', noiseColor: 'pink' },
      {
        filter: { cutoff: 1320, resonance: 3.4 },
        delay: { tapeTime: 0.44, feedback: 0.72, wowFlut: 0.35 },
      },
      [0, 0, 0, 0, 0, 0, 0, 0],
      0
    ),
  },
  {
    id: 'silk-rain',
    name: 'SILK RAIN',
    tagline: '5-Engine Biosphere Storm, Shoreline Waves & Silk Harmonics',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'SILK RAIN',
      {
        bpm: 56,
        timbreMode: 'soft',
        chordType: 'unison',
        noiseColor: 'pink',
        activePattern: 'C',
      },
      {
        biosphere: {
          rainLvl: 0.74,
          rainSize: 0.68,
          waterFlow: 0.56,
          wavesLvl: 0.68,
          windGust: 0.54,
          stormProb: 0.45,
        },
      },
      [1, 2, 6, 6, 3, 3, 1, 1],
      1
    ),
  },
  {
    id: 'tape-decay',
    name: 'TAPE DECAY',
    tagline: 'Degrading Reel-to-Reel Echoes, Vinyl Dust & Chaos Swells',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'TAPE DECAY',
      { bpm: 74, timbreMode: 'soft', chordType: 'min9', noiseColor: 'hiss' },
      {
        noise: { vinylDust: 0.72, tapeHiss: 0.58, noiseLevel: 0.48 },
        delay: { tapeTime: 0.56, feedback: 0.84, wowFlut: 0.64, echoWet: 0.65 },
      },
      [3, 3, 2, 1, 1, 1, 3, 4],
      4
    ),
  },
  {
    id: 'moss-cathedral',
    name: 'MOSS CATHEDRAL',
    tagline: 'Deep Cavern Reverb, Sustained Minor 9th Pads & Sub Pedal',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'MOSS CATHEDRAL',
      {
        bpm: 60,
        timbreMode: 'soft',
        chordType: 'min9',
        noiseColor: 'brown',
        activePattern: 'C',
      },
      {
        mixer: { cavernRev: 0.82, ch1Drone: 0.85 },
        filter: { cutoff: 980, resonance: 2.8 },
      },
      [4, 6, 8, 8, 3, 5, 8, 6],
      2
    ),
  },
  {
    id: 'foghorn-harbor',
    name: 'FOGHORN HARBOR',
    tagline: 'Slow Coastal Sub-Swells, Mist Plucks & Shoreline Tide',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'FOGHORN HARBOR',
      { bpm: 52, timbreMode: 'soft', chordType: 'fifth', noiseColor: 'brown' },
      {
        biosphere: { wavesLvl: 0.78, windGust: 0.48, waterFlow: 0.4 },
        delay: { tapeTime: 0.62, feedback: 0.76 },
      },
      [8, 4, 3, 4, 8, 4, 4, 7],
      5
    ),
  },
  {
    id: 'velvet-submarine',
    name: 'VELVET SUBMARINE',
    tagline: 'Deep Sonar Pings, Warm Dub Chords & Hydrophone Pressure',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'VELVET SUBMARINE',
      { bpm: 70, timbreMode: 'soft', chordType: 'min7', noiseColor: 'pink' },
      {
        pulse: { subPitch: 42, vactrolDec: 0.84, lpgWarmth: 0.82 },
        filter: { cutoff: 1120, resonance: 4.1 },
      },
      [6, 0, 1, 2, 5, 2, 0, 7],
      3
    ),
  },
  {
    id: 'analog-twilight',
    name: 'ANALOG TWILIGHT',
    tagline: 'Sunset Tape Drift, Polyrhythmic Wood Toms & Fretless Glide',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'ANALOG TWILIGHT',
      {
        bpm: 78,
        timbreMode: 'soft',
        chordType: 'min9',
        noiseColor: 'hiss',
        activePattern: 'B',
      },
      {
        delay: { tapeTime: 0.38, feedback: 0.7, wowFlut: 0.45 },
      },
      [5, 1, 5, 3, 4, 6, 2, 2],
      8
    ),
  },
  {
    id: 'cloudchamber',
    name: 'CLOUDCHAMBER',
    tagline: 'Zero-Gravity Harmonic Swarm, Glass Harmonica & Starlight Arp',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'CLOUDCHAMBER',
      {
        bpm: 64,
        timbreMode: 'soft',
        chordType: 'min9',
        noiseColor: 'white',
        activePattern: 'C',
      },
      {
        filter: { cutoff: 1850, resonance: 2.4 },
        mixer: { cavernRev: 0.78 },
      },
      [2, 8, 7, 5, 6, 5, 9, 9],
      6
    ),
  },
  {
    id: 'driftwood-echo',
    name: 'DRIFTWOOD ECHO',
    tagline: 'Organic Lo-Fi Dub Delay, Brook Water & Kalimantan Plucks',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'DRIFTWOOD ECHO',
      { bpm: 72, timbreMode: 'soft', chordType: 'min7', noiseColor: 'pink' },
      {
        biosphere: { waterFlow: 0.72, brookBub: 0.65, rainLvl: 0.25 },
        delay: { tapeTime: 0.48, feedback: 0.78, echoWet: 0.58 },
      },
      [7, 5, 3, 5, 7, 7, 7, 5],
      7
    ),
  },
  {
    id: 'midnight-botanica',
    name: 'MIDNIGHT BOTANICA',
    tagline: 'Subtle Forest Rain, Warm 808 Glide & Sustained Velvet Pad',
    modeTag: 'soft',
    patch: buildFactoryPatch(
      'MIDNIGHT BOTANICA',
      { bpm: 66, timbreMode: 'soft', chordType: 'unison', noiseColor: 'pink' },
      {
        biosphere: { rainLvl: 0.55, windGust: 0.35 },
        filter: { cutoff: 1260, resonance: 3.0 },
      },
      [9, 9, 9, 7, 9, 8, 5, 0],
      9
    ),
  },

  // ==========================================================================
  // 10 HARSH MODE SAMPLE PATCHES
  // ==========================================================================
  {
    id: 'subterranean',
    name: 'SUBTERRANEAN',
    tagline: 'Polyrhythmic Vactrol Sub-Pulse & Harsh West-Coast Fold',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'SUBTERRANEAN',
      {
        bpm: 84,
        timbreMode: 'harsh',
        chordType: 'fifth',
        noiseColor: 'brown',
        activePattern: 'B',
      },
      {
        filter: { cutoff: 2200, resonance: 5.4, satDrive: 0.62 },
        pulse: { subPitch: 38, punchDrop: 0.82, vactrolDec: 0.92 },
      },
      [12, 15, 11, 15, 12, 14, 11, 12],
      10
    ),
  },
  {
    id: 'reactor-core',
    name: 'REACTOR CORE',
    tagline: 'Industrial Overdrive Kick, Acid Squelch & Wavefold Swarm',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'REACTOR CORE',
      { bpm: 112, timbreMode: 'harsh', chordType: 'unison', noiseColor: 'white' },
      {
        fx: { wavefold: 0.78, bitCrush: 0.45, fxMix: 0.65 },
        filter: { cutoff: 3400, resonance: 6.8, satDrive: 0.75 },
      },
      [10, 10, 13, 12, 14, 10, 12, 15],
      11
    ),
  },
  {
    id: 'buchla-thunder',
    name: 'BUCHLA THUNDER',
    tagline: 'Chaotic Low-Pass Gate Strikes, Cross-FM & Storm Lightning',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'BUCHLA THUNDER',
      {
        bpm: 96,
        timbreMode: 'harsh',
        chordType: 'min7',
        noiseColor: 'brown',
        activePattern: 'B',
      },
      {
        biosphere: { stormProb: 0.78, windGust: 0.82, rainLvl: 0.68 },
        fx: { wavefold: 0.72, toneFilt: 4200 },
      },
      [13, 15, 14, 14, 15, 12, 14, 12],
      18
    ),
  },
  {
    id: 'iron-foundry',
    name: 'IRON FOUNDRY',
    tagline: 'Metallic Anvil Percussion, Bitcrushed Leads & Heavy Sub',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'IRON FOUNDRY',
      { bpm: 104, timbreMode: 'harsh', chordType: 'fifth', noiseColor: 'hiss' },
      {
        fx: { wavefold: 0.68, bitCrush: 0.62, fxMix: 0.58 },
        delay: { tapeTime: 0.28, feedback: 0.74 },
      },
      [18, 17, 11, 11, 18, 13, 16, 15],
      13
    ),
  },
  {
    id: 'acid-monolith',
    name: 'ACID MONOLITH',
    tagline: 'Resonant 303 Devilfish Basslines & Harsh Sawtooth Swarm',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'ACID MONOLITH',
      { bpm: 122, timbreMode: 'harsh', chordType: 'min7', noiseColor: 'pink' },
      {
        filter: { cutoff: 2850, resonance: 8.5, satDrive: 0.68 },
      },
      [11, 11, 10, 13, 10, 10, 17, 10],
      12
    ),
  },
  {
    id: 'voltage-riot',
    name: 'VOLTAGE RIOT',
    tagline: 'Fast Polyrhythmic Triggers, Ring-Mod Cymbals & S&H Chaos',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'VOLTAGE RIOT',
      {
        bpm: 128,
        timbreMode: 'harsh',
        chordType: 'min9',
        noiseColor: 'white',
        activePattern: 'B',
      },
      {
        mod: { lfo1Hz: 1.4, lfo2Hz: 3.2, chaosSlew: 0.15 },
        fx: { wavefold: 0.82, bitCrush: 0.52 },
      },
      [15, 12, 15, 16, 17, 15, 19, 19],
      14
    ),
  },
  {
    id: 'cybernetic-swarm',
    name: 'CYBERNETIC SWARM',
    tagline: 'Detuned Unison Drone, Neurofunk Reese Sustains & Glitch Arp',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'CYBERNETIC SWARM',
      { bpm: 116, timbreMode: 'harsh', chordType: 'unison', noiseColor: 'hiss' },
      {
        filter: { cutoff: 3800, resonance: 4.8, satDrive: 0.58 },
      },
      [19, 14, 19, 10, 11, 16, 15, 13],
      15
    ),
  },
  {
    id: 'seismic-fault',
    name: 'SEISMIC FAULT',
    tagline: 'Tectonic Sub-Bass Multi-Beat Sustains & Crushed Tape Feedback',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'SEISMIC FAULT',
      {
        bpm: 76,
        timbreMode: 'harsh',
        chordType: 'fifth',
        noiseColor: 'brown',
        activePattern: 'C',
      },
      {
        delay: { tapeTime: 0.52, feedback: 0.88, wowFlut: 0.72 },
        mixer: { beatPump: 0.75, cavernRev: 0.7 },
      },
      [14, 18, 17, 17, 18, 14, 18, 16],
      16
    ),
  },
  {
    id: 'static-transmitter',
    name: 'STATIC TRANSMITTER',
    tagline: 'Shortwave Hiss, Notch-Filter Sweeps & Sharp Laser Plucks',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'STATIC TRANSMITTER',
      {
        bpm: 108,
        timbreMode: 'harsh',
        chordType: 'min9',
        filterType: 'notch',
        noiseColor: 'hiss',
      },
      {
        noise: { vinylDust: 0.84, tapeHiss: 0.76, noiseLevel: 0.62 },
      },
      [17, 16, 16, 18, 19, 18, 14, 17],
      17
    ),
  },
  {
    id: 'doom-engine',
    name: 'DOOM ENGINE',
    tagline: 'Slow Heavy Industrial Stomp, Screaming Resonance & Sub Wall',
    modeTag: 'harsh',
    patch: buildFactoryPatch(
      'DOOM ENGINE',
      {
        bpm: 64,
        timbreMode: 'harsh',
        chordType: 'fifth',
        noiseColor: 'brown',
        activePattern: 'C',
      },
      {
        filter: { cutoff: 1650, resonance: 7.4, satDrive: 0.85 },
        fx: { wavefold: 0.88, bitCrush: 0.4, fxMix: 0.7 },
      },
      [14, 19, 17, 17, 18, 11, 12, 18],
      19
    ),
  },
];
