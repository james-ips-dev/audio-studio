/**
 * src/instruments/aether8/types.ts
 *
 * Complete TypeScript Data Schema for AETHER-8 Modular Dub-Drone Synthesizer v4
 * (Section 5 of AETHER-8 Modular Dub-Drone Specification v4)
 */

export type SignalDomain = 'audio' | 'cv' | 'trig';
export type TimbreCharacter = 'harsh' | 'soft';
export type BeatVoiceKey = 'kick' | 'rim' | 'hat' | 'tom';
export type PatternBankId = 'A' | 'B' | 'C' | 'D';

export type ChordVoicingType = 'unison' | 'fifth' | 'min7' | 'min9';
export type NoiseSpectrumColor = 'white' | 'pink' | 'brown' | 'hiss';
export type ZdfFilterMode = 'lp24' | 'lp12' | 'bandpass' | 'notch';

export type DirectOutputChannelKey =
  | 'drone'
  | 'subOsc'
  | 'noiseLab'
  | 'zdfFilt'
  | 'subPulse'
  | 'kick'
  | 'beatBus'
  | 'foldFx'
  | 'tapeDly'
  | 'biosphere';

export interface XoxPatternBank {
  barCount: 1 | 2 | 4; // 16, 32, or 64 steps per pattern
  trackLengths: [number, number, number, number]; // Per-track polyrhythmic step length (4..16 per bar)
  steps: number[][]; // 4 tracks x 64 steps (0 | 1)
}

export interface BeatVoiceSynthConfig {
  wave: 'sine' | 'triangle' | 'sawtooth' | 'square';
  filterType: 'lowpass' | 'bandpass' | 'highpass';
  freq: number; // 28..900 Hz
  pEnvAmt: number; // 0..1
  pEnvDec: number; // 0.008..0.45 s
  noiseMix: number; // 0..1
  cutoff: number; // 45..14000 Hz
  res: number; // 0.5..16 Q
  filtEnv: number; // -4500..+6500 Hz
  drive: number; // 0..1
  attack: number; // 0.001..0.22 s
  decay: number; // 0.02..0.95 s
  sustain: number; // 0..1
  release: number; // 0.02..1.4 s
}

export interface OutputChannelFxConfig {
  level: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  fxBypass: boolean;
  fx: {
    satDrive: number;
    crushAmt: number;
    chorusRate: number;
    chorusMix: number;
    hpFreq: number;
    lpFreq: number;
    filtRes: number;
    revSend: number;
  };
}

export interface PatchCable {
  id: string;
  from: string; // e.g., 'xox:stepClk', 'xox:barTrig', 'beats:envOut'
  to: string; // e.g., 'mod:lfoResetIn', 'mod:shTrigIn', 'clock:stepIn'
  type: SignalDomain;
  attenuation: number; // -1.0 to +1.0 (1.0 for 'trig')
}

export type AetherModSource = 'lfo1' | 'lfo2' | 'chaos' | 'sh';
export type AetherModDest =
  | 'filter.cutoff'
  | 'drone.detune'
  | 'drone.morph'
  | 'noise.formant'
  | 'delay.time'
  | 'pulse.decay';

export interface ModMatrixSlot {
  enabled: boolean;
  source: AetherModSource;
  depth: number; // -1.0 to +1.0
  dest: AetherModDest;
}

export interface PatchJackDef {
  id: string;
  moduleId: string;
  label: string;
  direction: 'in' | 'out';
  domain: SignalDomain;
}

export interface Aether8PatchV4 {
  version: 'AETHER-8-v4';
  name?: string;
  savedAt: string;
  bpm: number; // 30..130 BPM
  masterVol: number; // 0..1
  timbreMode: TimbreCharacter; // 'harsh' | 'soft'
  chordType: ChordVoicingType;
  noiseColor: NoiseSpectrumColor;
  filterType: ZdfFilterMode;
  activePattern: PatternBankId;
  ecoMode?: boolean;
  patternChainEnabled: boolean;
  xoxAutoFollow: boolean;
  xoxPatterns: Record<PatternBankId, XoxPatternBank>;
  xoxMuted: boolean[]; // 4 track mute flags
  xoxNormLink: boolean[]; // 4 normalled internal trigger links
  clockExtStepMode: boolean; // True when driven by external beat step triggers
  beatVoices: Record<BeatVoiceKey, BeatVoiceSynthConfig>;
  outputMixer: Record<DirectOutputChannelKey, OutputChannelFxConfig>;
  params: Record<string, Record<string, number>>;
  cables: PatchCable[];
  matrixSlots: ModMatrixSlot[];
}
