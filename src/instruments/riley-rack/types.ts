export type ScaleId = 'mixolydian' | 'dorian' | 'pentatonic' | 'bhairav';
export type RileyModel = 'organ' | 'pluck' | 'pad';
export type EngineMode = 'ORIGINAL_RILEY' | 'FULL_SYNTH_SUITE';
export type OscWave = 'sawtooth' | 'square' | 'triangle' | 'sine';
export type FilterMode = 'LP24' | 'LP12' | 'BP12' | 'HP12';
export type LfoWave = 'sine' | 'triangle' | 'square' | 'sh';
export type LfoDest = 'cutoff' | 'pitch' | 'detune' | 'pan';

export interface StepCell {
  degree: number; // Scale degree index (0..scaleLength-1)
  active: boolean; // True = Gate ON, False = Rest
}

export interface ADSR {
  attack: number;  // 0.004s .. 1.4s
  decay: number;   // 0.004s .. 1.4s
  sustain: number; // 0.005 .. 1.0
  release: number; // 0.004s .. 1.4s
}

export interface RileyVoiceParams {
  model: RileyModel;
  cutoff: number;     // 180Hz .. 8500Hz
  resonance: number;  // 0.5 .. 12.0
  attack: number;     // 0.005s .. 0.45s
  release: number;    // 0.06s .. 1.4s
  brightness: number; // 0.05 .. 1.0
}

export interface FullSynthParams {
  osc1Wave: OscWave;
  osc1Coarse: number; // -24 .. +24 semitones
  osc1Detune: number; // -50 .. +50 cents
  osc2Wave: OscWave;
  osc2Coarse: number; // -24 .. +24 semitones
  osc2Detune: number; // -50 .. +50 cents
  wavefold: number;   // 0.0 .. 1.0 (West Coast sinusoidal folder)
  oscMix: number;     // 0.0 (100% Osc1) .. 1.0 (100% Osc2)
  subOctave: -1 | -2;
  subLevel: number;   // 0.0 .. 1.0
  noiseType: 'white' | 'pink';
  noiseLevel: number; // 0.0 .. 0.5
  filterMode: FilterMode;
  cutoff: number;         // 40Hz .. 14000Hz
  resonance: number;      // 0.5 .. 16.0
  filterEnvDepth: number; // -1.0 .. +1.0
  keyTrack: number;       // 0.0 .. 1.0
  ampEnv: ADSR;
  filterEnv: ADSR;
  lfoWave: LfoWave;
  lfoSync: boolean;
  lfoRate: number;  // 0.25 .. 12.0 (Hz in Free mode, beat multiplier in Sync mode)
  lfoDepth: number; // 0.0 .. 1.0
  lfoDest: LfoDest;
}

export interface VoiceTrack {
  id: string;
  index: number; // 0..7
  color: string;
  mode: EngineMode;
  length: number; // 3..16 active steps (polymetric loop boundary)
  speed: number;  // 0.5, 1, 1.5, 2 (overridden if CLK IN jack is patched)
  octave: number; // -1, 0, 1, 2
  steps: StepCell[]; // Fixed length 16 array; indices >= length are dimmed/inactive
  riley: RileyVoiceParams;
  synth: FullSynthParams;
  volume: number;   // 0.0 .. 1.0
  pan: number;      // -1.0 .. +1.0
  tapeSend: number; // 0.0 .. 0.7
  mute: boolean;
  solo: boolean;
}

export interface TapeDelayState {
  delayLMs: number;  // 120ms .. 1400ms
  delayRMs: number;  // 150ms .. 1600ms
  feedback: number;  // 0.0 .. 0.64 (strictly capped)
  crossFeed: number; // 0.0 .. 0.14 (strictly capped)
  toneHz: number;    // 400Hz .. 2200Hz
  mix: number;       // 0.0 .. 0.70
}

export interface BiosphereState {
  enabled: boolean;
  clockSync: boolean;
  masterVol: number;       // 0.0 .. 1.0
  rain: number;            // 0.0 .. 1.0
  rainHeavy: boolean;      // false = 3400Hz soft, true = 2100Hz heavy
  rainDropletSync: boolean;// Polyrhythmic droplets on tick % 3 === 0 || tick % 5 === 0
  stream: number;          // 0.0 .. 1.0
  waves: number;           // 0.0 .. 1.0
  waveSyncBars: 0 | 4 | 8; // 0 = continuous, 4 or 8 = bar-locked swell envelope
  wind: number;            // 0.0 .. 1.0
  thunderProb: number;     // 0.0 .. 1.0
}

export interface PatchCable {
  id: string;
  from: string; // e.g., 'clk-div-1', 'v1-cv'
  to: string;   // e.g., 'v1-clk', 'tla-in-l'
  color: string;
}

export interface EvolveState {
  enabled: boolean;
  intervalBars: 4 | 8 | 16 | 32 | 64;
  pitchDrift: boolean;
  rhythmLength: boolean;
  timbreMorph: boolean;
  currentBar: number;
  lastEvent: string;
}

export interface RileySongPatch {
  id: string;
  name: string;
  nameJa?: string;
  vibe?: string;
  vibeJa?: string;
  author?: string;
  createdAt: number;
  isFactory: boolean;
  bpm: number;
  scaleId: ScaleId;
  rootMidi: number;
  justIntonation: boolean;
  ecoMode?: boolean;
  masterVol?: number;
  delay: TapeDelayState;
  biosphere: BiosphereState;
  evolve: Omit<EvolveState, 'currentBar' | 'lastEvent'>;
  cables: PatchCable[];
  voices: VoiceTrack[];
}
