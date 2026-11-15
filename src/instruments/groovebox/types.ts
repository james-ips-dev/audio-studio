/**
 * src/instruments/groovebox/types.ts
 *
 * Exhaustive TypeScript Data Schema for Groovebox v4
 * (Section 6 of Groovebox v4 Complete Technical & Product Specification)
 */

export type AppMode = 'beginner' | 'pro';
export type VoiceMode = 'mono' | 'poly' | 'unison';
export type NotePriority = 'last' | 'low' | 'high';
export type GlideTrigger = 'always' | 'legato';
export type GlideCurve = 'linear' | 'exponential';

export type OscillatorWave =
  | 'sine'
  | 'triangle'
  | 'sawtooth'
  | 'square'
  | 'pwm'
  | 'supersaw';
export type FilterType = 'lp12' | 'lp24' | 'bp12' | 'hp12' | 'notch';
export type LfoWave = 'sine' | 'triangle' | 'saw' | 'square' | 'sample-hold';
export type RatchetCurve = 'flat' | 'fade-out' | 'swell' | 'bouncing-ball';
export type TrigCondition =
  | 'ALWAYS'
  | '1:2'
  | '2:2'
  | '1:4'
  | '2:4'
  | '3:4'
  | '4:4'
  | 'FILL'
  | 'PRE'
  | '!PRE';

export type LaunchQuantize =
  | 'immediate'
  | '1/16'
  | '1-beat'
  | '1-bar'
  | '2-bars';
export type CrossfadeCurveMode =
  | 'dj-eq-blend'
  | 'filter-morph'
  | 'step-probability-morph';

export type Subdivision =
  | '1/4'
  | '1/8'
  | '1/16'
  | '1/32'
  | '1/64'
  | '1/4T'
  | '1/8T'
  | '1/16T'
  | '1/32T'
  | '1/8D'
  | '1/16D';

export type GrooveDeckTab =
  | 'synth'
  | 'mixer'
  | 'pads'
  | 'kaoss'
  | 'performance'
  | 'pianoroll';

export type PunchInFxType =
  | 'none'
  | 'tape-stop'
  | 'beat-repeat'
  | 'dub-wash'
  | 'sub-drop'
  | 'hpf-riser';

// Standardized Parameter Dot-Path Convention: e.g. "tracks.4.synth.filter.cutoff"
export type ParameterDotPath = string;

export interface PerformanceSessionState {
  activeTrackPatterns: string[]; // 8 pattern IDs (one per track 0..7)
  queuedTrackPatterns: (string | null)[]; // Pending quantized clip switches per track
  launchQuantize: LaunchQuantize;
  legatoPhaseLock: boolean; // Preserves current step offset when switching clips mid-bar
  deckA: string[]; // 8-track pattern assignment snapshot for Crossfader Deck A
  deckB: string[]; // 8-track pattern assignment snapshot for Crossfader Deck B
  crossfaderPosition: number; // 0.0 (100% Deck A) to 1.0 (100% Deck B)
  crossfadeMode: CrossfadeCurveMode;
  activePunchInFx: PunchInFxType;
}

export type ModMatrixSource =
  | 'lfo1'
  | 'lfo2'
  | 'filterEnv'
  | 'modEnv'
  | 'modSeq'
  | 'velocity'
  | 'keyTrack'
  | 'voiceRandom'
  | 'osc2Fm'
  | 'kaossX'
  | 'kaossY'
  | 'macro1'
  | 'macro2';

export type ModMatrixDestination =
  | 'cutoff'
  | 'resonance'
  | 'drive'
  | 'osc1Pitch'
  | 'osc2Pitch'
  | 'pwm'
  | 'fmCrossMod'
  | 'osc1Level'
  | 'osc2Level'
  | 'sub1Level'
  | 'sub2Level'
  | 'noiseLevel'
  | 'pan'
  | 'stereoWidth'
  | 'unisonDetune'
  | 'glideTime'
  | 'ampAttack'
  | 'ampDecay'
  | 'filterEnvAmt'
  | 'lfo1Rate'
  | 'lfo2Rate'
  | 'insert1Param1'
  | 'insert1Param2'
  | 'reverbSend'
  | 'delaySend';

export interface ModMatrixSlot {
  id: number; // 0..7
  enabled: boolean;
  source: ModMatrixSource;
  curve: 'linear' | 'exponential' | 's-curve' | 'stepped';
  depth: number; // -1.0 to +1.0
  destination: ModMatrixDestination;
}

export interface ProSynthConfig {
  // Voice Allocation, Unison, Portamento & Analog Imperfection
  voice: {
    mode: VoiceMode;
    legato: boolean;
    priority: NotePriority;
    polyVoices: number; // 4..8
    unisonVoices: number; // 2..4
    unisonDetune: number; // 0..100 cents
    unisonSpread: number; // 0..1 stereo width
    glideTime: number; // 0..1000 ms
    glideTrigger: GlideTrigger;
    glideCurve: GlideCurve;
    analogSlop: number; // 0..1 per-voice pitch/filter/env organic drift
    keyTunedDrum: boolean; // Auto-tunes Kick/Perc fundamental to global Song Key
  };

  // 2 Primary Oscillators + 2 Sub-Oscillators + Noise
  osc1: {
    wave: OscillatorWave;
    coarse: number;
    fine: number;
    pwm: number;
    keySync: boolean;
    keyTrack: boolean;
    level: number;
  };
  osc2: {
    wave: OscillatorWave;
    coarse: number;
    fine: number;
    hardSync: boolean;
    fmDepth: number;
    keySync: boolean;
    keyTrack: boolean;
    level: number;
  };
  sub1: {
    wave: 'sine' | 'square';
    octaveOffset: -12;
    keySync: boolean;
    level: number;
  };
  sub2: {
    wave: 'sine' | 'triangle' | 'square';
    semitoneOffset: -24 | -12 | 7;
    keySync: boolean;
    level: number;
  };
  noise: {
    type: 'white' | 'pink' | 'metallic';
    ringMod: boolean;
    level: number;
  };

  // Multi-mode Filter & Drive
  filter: {
    type: FilterType;
    cutoff: number; // 20..20000 Hz
    resonance: number; // 0.5..20 Q
    drive: number; // 0..1
    keyTrack: number; // 0..1
    envDepth: number; // -1..1
    velocityTimbre: number; // 0..1 built-in Acoustic Touch Response depth
  };

  // 3 Independent Envelopes
  ampEnv: { attack: number; decay: number; sustain: number; release: number };
  filterEnv: { attack: number; decay: number; sustain: number; release: number };
  modEnv: {
    delay: number;
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    loop: boolean;
  };

  // Dual LFOs + 16-Step Mod Sequencer + 8-Slot Mod Matrix
  lfo1: {
    wave: LfoWave;
    sync: boolean;
    rateHz: number;
    rateDiv: Subdivision;
    fadeIn: number;
    retrigger: boolean;
  };
  lfo2: {
    wave: LfoWave;
    sync: boolean;
    rateHz: number;
    rateDiv: Subdivision;
    fadeIn: number;
    retrigger: boolean;
  };
  modSequencer: {
    enabled: boolean;
    subdivision: Subdivision;
    steps: number[]; // 16 values (-1..1)
  };
  modMatrix: ModMatrixSlot[];

  // Beginner Mode 6-Macro Snapshot (mapped dynamically to Pro params)
  beginnerMacros: {
    cutoff: number; // 0..1 ("Brightness ☀️")
    resonance: number; // 0..1 ("Laser Squelch 🛸")
    fmDirt: number; // 0..1 ("Robot Grit 🤖")
    ampDecay: number; // 0..1 ("Tail Length ☄️")
    pitchEnv: number; // -1..1 ("Zap Punch ⚡")
    detune: number; // 0..1 ("Super Wide 🌈")
  };
}

export type InsertFxType =
  | 'drive'
  | 'transientShaper'
  | 'bitcrusher'
  | 'chorusTape'
  | 'eq4'
  | 'sidechainComp';

export interface InsertFxUnit {
  type: InsertFxType;
  enabled: boolean;
  params: Record<string, number>;
  sidechainSourceTrack?: number; // e.g., 0 (Kick)
}

export interface NoteEvent {
  midiNote: number;
  velocity: number; // 0.01..1.0 (edited in Visual Velocity Lane)
  durationSteps: number; // >= 1 (1 = single step, >1 = extended multi-step tie pill)
  glide: boolean;
}

export interface StepData {
  active: boolean;
  notes: NoteEvent[]; // Single notes, drum hits, or voice-led polyphonic chords
  velocity: number; // Step-level velocity (0.01..1.0)
  microTiming: number; // -0.50 to +0.50 step offset
  ratchet: 1 | 2 | 3 | 4 | 6;
  ratchetCurve: RatchetCurve;
  probability: number; // 0.0..1.0
  condition: TrigCondition;
  pLocks: Record<string, number>;
}

export interface TrackConfig {
  index: number;
  name: string;
  icon: string;
  color: string;
  isDrum: boolean;
  presetName: string;
  synth: ProSynthConfig;
  insertFx: InsertFxUnit[];
  voiceLeading: boolean; // Smooth chord inversions (Track 7)
  chordStrumMs: number; // 0..60 ms strum spread
  mixer: {
    volume: number;
    pan: number;
    stereoWidth: number; // 0..2.0 (0 = mono, 1 = normal, 2 = extra wide)
    bassMonoHz: number; // 0..200 Hz mono-maker cutoff (default 120 Hz)
    reverbSend: number;
    delaySend: number;
    mute: boolean;
    solo: boolean;
  };
  recordArmed: boolean;
  recordLocked: boolean;
}

export interface PatternTrackSequence {
  trackIndex: number;
  lengthSteps: number; // 1..64 (polymetric length per bar/phrase)
  phraseResetBars: 0 | 2 | 4; // Resets polymeters cleanly every 2 or 4 bars
  subdivision: Subdivision;
  steps: StepData[]; // 64 steps allocated per pattern
}

export interface Pattern {
  id: string;
  bars: 1 | 2 | 3 | 4;
  tracks: PatternTrackSequence[];
}

export interface PerformanceMacro {
  id: number; // 0..7
  name: string;
  value: number; // 0..1
  mappings: { path: ParameterDotPath; min: number; max: number }[];
}

export interface MidiCcMapping {
  cc: number;
  channel: number;
  targetPath: ParameterDotPath;
}

export interface SongBlock {
  id: string;
  patternId: string;
  repeats: number;
  mutedTracks: number[];
  masterFilterCutoff?: number;
}

export interface GrooveboxProject {
  id: string;
  name: string;
  updatedAt: number;
  mode: AppMode;
  ecoMode: boolean;
  safeLockEnabled: boolean; // Kid-safe parent lock
  bpm: number;
  grooveTemplate: string;
  swing: number;
  rootNote: number; // 0 = C, 1 = C#, ..., 11 = B
  scaleName: string;
  activePatternId: string;
  tracks: TrackConfig[];
  patterns: Record<string, Pattern>;
  performance: PerformanceSessionState;
  songTimeline: SongBlock[];
  macros: PerformanceMacro[];
  sceneA: Record<ParameterDotPath, number>;
  sceneB: Record<ParameterDotPath, number>;
  sceneCrossfader: number; // 0.0 (Scene A) to 1.0 (Scene B)
  midiMappings: MidiCcMapping[];
  globalFx: {
    reverbSize: number;
    reverbDamp: number;
    reverbReturn: number;
    delayDiv: Subdivision;
    delayFeedback: number;
    delayReturn: number;
    masterFilterCutoff: number;
    masterCompressorThreshold: number;
    masterCompressorRatio: number;
    masterTiltEq: number;
    masterLimiterCeilingDb: number; // -0.3 dBFS
    masterVolume: number;
  };
}
