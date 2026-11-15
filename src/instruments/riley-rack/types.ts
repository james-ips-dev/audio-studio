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

export type VoiceFxSyncRate = 'free' | '1/16' | '1/8' | '1/4' | '1/2' | '1-bar' | '2-bar' | '4-bar';

export interface VoiceFxEcho {
  enabled: boolean;
  sync: boolean;
  syncRate: VoiceFxSyncRate;
  timeMs: number; // 20ms .. 1000ms
  feedback: number; // 0 .. 0.85
  toneHz: number; // 300Hz .. 8000Hz
  mix: number; // 0 .. 1.0
}

export interface VoiceFxDelay {
  enabled: boolean;
  sync: boolean;
  syncRate: VoiceFxSyncRate;
  timeMs: number; // 50ms .. 1600ms
  feedback: number; // 0 .. 0.88
  crossfeed: number; // 0 .. 0.5
  mix: number; // 0 .. 1.0
}

export interface VoiceFxFlanger {
  enabled: boolean;
  sync: boolean;
  syncRate: VoiceFxSyncRate;
  rateHz: number; // 0.05Hz .. 8Hz
  depthMs: number; // 0.5ms .. 8ms
  feedback: number; // -0.85 .. +0.85
  mix: number; // 0 .. 1.0
}

export interface VoiceFxPhaser {
  enabled: boolean;
  sync: boolean;
  syncRate: VoiceFxSyncRate;
  rateHz: number; // 0.05Hz .. 8Hz
  depth: number; // 0 .. 1.0
  feedback: number; // 0 .. 0.85
  stages: 4 | 8;
  mix: number; // 0 .. 1.0
}

export interface VoiceFxCompressor {
  enabled: boolean;
  thresholdDb: number; // -48dB .. 0dB
  ratio: number; // 1 .. 20
  attackSec: number; // 0.001s .. 0.1s
  releaseSec: number; // 0.02s .. 0.8s
  gainDb: number; // 0dB .. +18dB
}

export interface VoiceFxRack {
  echo: VoiceFxEcho;
  delay: VoiceFxDelay;
  flanger: VoiceFxFlanger;
  phaser: VoiceFxPhaser;
  compressor: VoiceFxCompressor;
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
  fx: VoiceFxRack;
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

export type BiosphereModRate = 'free' | '1/16' | '1/8' | '1/4' | '1/2' | '1-bar' | '2-bar' | '4-bar' | '8-bar';

export interface BiosphereState {
  enabled: boolean;
  clockSync: boolean;
  masterVol: number; // 0.0 .. 2.0 (scaled & boosted)

  // Individual generators with calibrated preamps & LFO modulations
  rain: number; // 0.0 .. 1.0
  rainPreamp: number; // 0.2 .. 3.0 (default 1.0)
  rainHeavy: boolean; // false = soft, true = heavy
  rainDropletSync: boolean; // Polyrhythmic droplets on tick % 3 === 0 || tick % 5 === 0
  rainModDepth: number; // 0.0 .. 1.0
  rainModRate: BiosphereModRate;

  stream: number; // 0.0 .. 1.0
  streamPreamp: number; // 0.2 .. 3.0 (default 1.0)
  streamModDepth: number; // 0.0 .. 1.0
  streamModRate: BiosphereModRate;

  waves: number; // 0.0 .. 1.0
  wavesPreamp: number; // 0.2 .. 3.0 (default 1.0)
  waveSyncBars: 0 | 4 | 8; // 0 = continuous/free, 4 or 8 = bar-locked swell envelope
  wavesModDepth: number; // 0.0 .. 1.0
  wavesModRate: BiosphereModRate;

  wind: number; // 0.0 .. 1.0
  windPreamp: number; // 0.2 .. 3.0 (default 1.0)
  windModDepth: number; // 0.0 .. 1.0
  windModRate: BiosphereModRate;

  thunderProb: number; // 0.0 .. 1.0 (bar-level evaluation)
  thunderPreamp: number; // 0.2 .. 3.0 (default 1.0)
}

export interface PatchCable {
  id: string;
  from: string; // e.g., 'clk-div-1', 'v1-cv', 'v1-seq-trig'
  to: string;   // e.g., 'v1-clk', 'tla-in-l', 'bio-thunder-trig'
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
