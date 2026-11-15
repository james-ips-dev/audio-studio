/**
 * src/instruments/aether8/types.ts
 *
 * Complete TypeScript Data Schema for AETHER-8 Modular Dub-Drone Synthesizer v4
 * Upgraded with 8 Polyrhythmic X0X Tracks, Full Studio Synth Engine per Track,
 * Multi-Beat Extendable Tied Notes, 20 Presets per Engine, and 20 Sample Patches.
 */

export type SignalDomain = 'audio' | 'cv' | 'trig';
export type TimbreCharacter = 'harsh' | 'soft';
export type BeatVoiceKey =
  | 'kick'
  | 'rim'
  | 'hat'
  | 'tom'
  | 'bass'
  | 'lead'
  | 'chord'
  | 'arp';
export type PatternBankId = 'A' | 'B' | 'C' | 'D';

export type ChordVoicingType = 'unison' | 'fifth' | 'min7' | 'min9';
export type NoiseSpectrumColor = 'white' | 'pink' | 'brown' | 'hiss';
export type ZdfFilterMode = 'lp24' | 'lp12' | 'bandpass' | 'notch';

export type AetherOscWave =
  | 'sine'
  | 'triangle'
  | 'sawtooth'
  | 'square'
  | 'pwm'
  | 'supersaw';

export type AetherFilterType = 'lp12' | 'lp24' | 'bp12' | 'hp12' | 'notch';
export type AetherVoiceMode = 'mono' | 'poly' | 'unison';

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
  trackLengths: number[]; // 8 tracks polyrhythmic step length (4..16 per bar)
  steps: number[][]; // 8 tracks x 64 steps: 0 = off, 1..16 = gate duration in steps (extendable across beats without retriggering)
  notes?: number[][]; // 8 tracks x 64 steps: MIDI note number per step (default per track)
}

/**
 * Full Studio Synth Engine configuration for each of the 8 AETHER-8 Beat/Synth Tracks
 * (Same studio synthesis architecture as Groovebox Studio + classic percussion controls).
 */
export interface BeatVoiceSynthConfig {
  presetName: string;
  wave: 'sine' | 'triangle' | 'sawtooth' | 'square';
  filterType: 'lowpass' | 'bandpass' | 'highpass';
  freq: number; // 28..900 Hz base fundamental
  pEnvAmt: number; // 0..1 pitch envelope depth
  pEnvDec: number; // 0.008..0.45 s
  noiseMix: number; // 0..1
  cutoff: number; // 40..18000 Hz
  res: number; // 0.5..18 Q
  filtEnv: number; // -4500..+6500 Hz
  drive: number; // 0..1
  attack: number; // 0.001..0.5 s
  decay: number; // 0.02..1.5 s
  sustain: number; // 0..1
  release: number; // 0.02..2.0 s

  // Full Studio Multi-Oscillator + Sub + Noise + Dual Envelope + LFO + Unison Engine
  osc1: {
    wave: AetherOscWave;
    coarse: number; // -24..+24 semitones
    fine: number; // -100..+100 cents
    pwm: number; // 0.05..0.95
    level: number; // 0..1
  };
  osc2: {
    wave: AetherOscWave;
    coarse: number; // -24..+24 semitones
    fine: number; // -100..+100 cents
    fmDepth: number; // 0..1 Osc2 -> Osc1 FM
    ringMod: number; // 0..1
    hardSync: boolean;
    level: number; // 0..1
  };
  sub1: {
    wave: 'sine' | 'square';
    level: number; // 0..1 (-12st)
  };
  sub2: {
    wave: 'sine' | 'triangle';
    semitoneOffset: -24 | -12 | 7;
    level: number; // 0..1
  };
  noise: {
    type: NoiseSpectrumColor;
    filterCutoff: number;
    level: number; // 0..1
  };
  filter: {
    type: AetherFilterType;
    cutoff: number; // 40..18000 Hz
    resonance: number; // 0.5..18 Q
    drive: number; // 0..1
    envDepth: number; // -1..+1
    keyTracking: number; // 0..1
    velocityTimbre: number; // 0..1
  };
  ampEnv: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filterEnv: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  modEnv: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    pitchDepth: number; // -1..+1
  };
  lfo1: {
    shape: 'sine' | 'triangle' | 'sawtooth' | 'square' | 's&h';
    rateHz: number;
    depth: number;
  };
  lfo2: {
    shape: 'sine' | 'triangle' | 'sawtooth' | 'square' | 's&h';
    rateHz: number;
    depth: number;
  };
  voice: {
    mode: AetherVoiceMode;
    unisonVoices: number; // 1..4
    unisonDetune: number; // 0..65 cents
    stereoSpread: number; // 0..1
    glideTime: number; // 0..500 ms
    analogSlop: number; // 0..1
  };
  macros: {
    cutoff: number; // 0..1
    resonance: number; // 0..1
    fmDirt: number; // 0..1
    ampDecay: number; // 0..1
    pitchEnv: number; // -1..+1
    detune: number; // 0..1
  };
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
  from: string; // e.g., 'xox:trig1'..'xox:trig8', 'xox:cv1'..'xox:cv8', 'beats:kickOut'..'beats:arpOut'
  to: string; // e.g., 'beats:kickIn'..'beats:arpIn', 'mod:lfoResetIn', 'pulse:trigIn'
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
  bpm: number; // 30..160 BPM
  masterVol: number; // 0..1
  timbreMode: TimbreCharacter; // 'harsh' | 'soft'
  chordType: ChordVoicingType;
  dronePresetName?: string;
  noiseColor: NoiseSpectrumColor;
  filterType: ZdfFilterMode;
  activePattern: PatternBankId;
  ecoMode?: boolean;
  patternChainEnabled: boolean;
  xoxAutoFollow: boolean;
  xoxPatterns: Record<PatternBankId, XoxPatternBank>;
  xoxMuted: boolean[]; // 8 track mute flags
  xoxNormLink: boolean[]; // 8 normalled internal trigger links
  clockExtStepMode: boolean; // True when driven by external beat step triggers
  beatVoices: Record<BeatVoiceKey, BeatVoiceSynthConfig>;
  outputMixer: Record<DirectOutputChannelKey, OutputChannelFxConfig>;
  params: Record<string, Record<string, number>>;
  cables: PatchCable[];
  matrixSlots: ModMatrixSlot[];
}
