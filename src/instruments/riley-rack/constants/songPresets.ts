import type {
  BiosphereState,
  EngineMode,
  PatchCable,
  RileySongPatch,
  ScaleId,
  StepCell,
  TapeDelayState,
  VoiceFxRack,
  VoiceTrack,
} from '../types';
import {
  FULL_SYNTH_VOICE_PRESETS,
  ORIGINAL_RILEY_VOICE_PRESETS,
} from './voicePresets';

export const VOICE_TRACK_COLORS: string[] = [
  '#F59E0B', // Voice 1: Amber
  '#38BDF8', // Voice 2: Sky
  '#10B981', // Voice 3: Emerald
  '#F43F5E', // Voice 4: Rose
  '#A855F7', // Voice 5: Purple
  '#EC4899', // Voice 6: Pink
  '#06B6D4', // Voice 7: Cyan
  '#84CC16', // Voice 8: Lime
];

export function createDefaultVoiceFxRack(): VoiceFxRack {
  return {
    echo: {
      enabled: false,
      sync: true,
      syncRate: '1/8',
      timeMs: 240,
      feedback: 0.35,
      toneHz: 2800,
      mix: 0.35,
    },
    delay: {
      enabled: false,
      sync: true,
      syncRate: '1/4',
      timeMs: 380,
      feedback: 0.45,
      crossfeed: 0.15,
      mix: 0.4,
    },
    flanger: {
      enabled: false,
      sync: true,
      syncRate: '1-bar',
      rateHz: 0.4,
      depthMs: 3.5,
      feedback: 0.45,
      mix: 0.4,
    },
    phaser: {
      enabled: false,
      sync: true,
      syncRate: '2-bar',
      rateHz: 0.25,
      depth: 0.65,
      feedback: 0.5,
      stages: 4,
      mix: 0.45,
    },
    compressor: {
      enabled: false,
      thresholdDb: -18,
      ratio: 4,
      attackSec: 0.015,
      releaseSec: 0.18,
      gainDb: 3,
    },
  };
}

export function createDefaultBiosphereState(): BiosphereState {
  return {
    enabled: true,
    clockSync: true,
    masterVol: 0.85,
    rain: 0.35,
    rainPreamp: 1.0,
    rainHeavy: false,
    rainDropletSync: true,
    rainModDepth: 0.25,
    rainModRate: '4-bar',

    stream: 0.4,
    streamPreamp: 1.2,
    streamModDepth: 0.3,
    streamModRate: '2-bar',

    waves: 0.45,
    wavesPreamp: 1.1,
    waveSyncBars: 4,
    wavesModDepth: 0.4,
    wavesModRate: '8-bar',

    wind: 0.3,
    windPreamp: 1.0,
    windModDepth: 0.35,
    windModRate: '4-bar',

    thunderProb: 0.15,
    thunderPreamp: 1.2,
  };
}

/**
 * Matches the low-spec machine detection in Groovebox and AETHER-8:
 * Enables Eco Mode automatically when hardwareConcurrency <= 4 or on Android/CrOS/Chromebook/tablet.
 */
export function detectLowSpecDevice(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
        /Android|CrOS|Chromebook|tablet/i.test(navigator.userAgent)
    )
  );
}

function buildSteps(pattern: Array<number | null>): StepCell[] {
  const cells: StepCell[] = [];
  for (let i = 0; i < 16; i++) {
    const val = pattern[i % pattern.length];
    if (val === null || val === undefined || val < 0) {
      cells.push({ degree: 0, active: false });
    } else {
      cells.push({ degree: val, active: true });
    }
  }
  return cells;
}

interface VoiceSpec {
  mode: EngineMode;
  length: number;
  speed: number;
  octave: number;
  rileyPresetIdx: number;
  synthPresetIdx: number;
  volume: number;
  pan: number;
  tapeSend: number;
  pattern: Array<number | null>;
  fx?: Partial<VoiceFxRack>;
}

function createVoicesFromSpecs(specs: VoiceSpec[]): VoiceTrack[] {
  return specs.map((s, idx) => {
    const rileyPreset =
      ORIGINAL_RILEY_VOICE_PRESETS[
        s.rileyPresetIdx % ORIGINAL_RILEY_VOICE_PRESETS.length
      ];
    const synthPreset =
      FULL_SYNTH_VOICE_PRESETS[
        s.synthPresetIdx % FULL_SYNTH_VOICE_PRESETS.length
      ];

    const defaultFx = createDefaultVoiceFxRack();
    const mergedFx: VoiceFxRack = {
      echo: { ...defaultFx.echo, ...(s.fx?.echo ?? {}) },
      delay: { ...defaultFx.delay, ...(s.fx?.delay ?? {}) },
      flanger: { ...defaultFx.flanger, ...(s.fx?.flanger ?? {}) },
      phaser: { ...defaultFx.phaser, ...(s.fx?.phaser ?? {}) },
      compressor: { ...defaultFx.compressor, ...(s.fx?.compressor ?? {}) },
    };

    return {
      id: `voice-${idx + 1}`,
      index: idx,
      color: VOICE_TRACK_COLORS[idx % VOICE_TRACK_COLORS.length],
      mode: s.mode,
      length: s.length,
      speed: s.speed,
      octave: s.octave,
      steps: buildSteps(s.pattern),
      riley: JSON.parse(JSON.stringify(rileyPreset.params)),
      synth: JSON.parse(JSON.stringify(synthPreset.params)),
      fx: mergedFx,
      volume: s.volume,
      pan: s.pan,
      tapeSend: s.tapeSend,
      mute: false,
      solo: false,
    };
  });
}

function buildFactorySong(config: {
  id: string;
  name: string;
  nameJa: string;
  vibe: string;
  vibeJa: string;
  bpm: number;
  scaleId: ScaleId;
  rootMidi: number;
  justIntonation: boolean;
  delay: TapeDelayState;
  biosphere: BiosphereState;
  evolve: RileySongPatch['evolve'];
  cables: PatchCable[];
  voices: VoiceSpec[];
}): RileySongPatch {
  return {
    id: config.id,
    name: config.name,
    nameJa: config.nameJa,
    vibe: config.vibe,
    vibeJa: config.vibeJa,
    author: 'Terry Riley / Studio Archive',
    createdAt: 1700000000000,
    isFactory: true,
    bpm: config.bpm,
    scaleId: config.scaleId,
    rootMidi: config.rootMidi,
    justIntonation: config.justIntonation,
    ecoMode: detectLowSpecDevice(),
    masterVol: 0.85,
    delay: config.delay,
    biosphere: config.biosphere,
    evolve: config.evolve,
    cables: config.cables,
    voices: createVoicesFromSpecs(config.voices),
  };
}

/**
 * Section 8: The 10 Factory Song Presets
 */
export const RILEY_FACTORY_SONG_PRESETS: RileySongPatch[] = [
  // 1. 01. In C (Terry Riley 1964)
  buildFactorySong({
    id: 'factory-01-in-c',
    name: '01. In C (Terry Riley 1964)',
    nameJa: '01. In C（テリー・ライリー 1964）',
    vibe: "Iconic interlocking cells inspired by Riley's 1964 In C, blending Combo Organ pulses, West Coast plucks, and Glass Marimba counterpoint.",
    vibeJa: '1964年の名作『In C』に着想を得た、コンボオルガン・ウェストコーストプラック・グラスマリンバが織りなすポリメトリック対位法。',
    bpm: 118,
    scaleId: 'mixolydian',
    rootMidi: 60, // C
    justIntonation: true,
    delay: {
      delayLMs: 380,
      delayRMs: 510,
      feedback: 0.44,
      crossFeed: 0.1,
      toneHz: 1550,
      mix: 0.34,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: false,
      masterVol: 0.5,
      rain: 0.1,
      stream: 0.25,
      waves: 0.3,
      wind: 0.2,
      thunderProb: 0.05,
    },
    evolve: {
      enabled: true,
      intervalBars: 8,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: false,
    },
    cables: [
      { id: 'c-inc-1', from: 'clk-div-1', to: 'v1-clk', color: '#F59E0B' },
      { id: 'c-inc-2', from: 'clk-div-2', to: 'v6-clk', color: '#EC4899' },
      { id: 'c-inc-3', from: 'v3-cv', to: 'tla-in-l', color: '#10B981' },
      { id: 'c-inc-4', from: 'v1-seq-trig', to: 'bio-thunder-trig', color: '#F43F5E' },
    ],
    voices: [
      {
        mode: 'ORIGINAL_RILEY',
        length: 5,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 0, // Vox Continental Organ
        synthPresetIdx: 0,
        volume: 0.78,
        pan: -0.35,
        tapeSend: 0.25,
        pattern: [0, 2, 0, 2, 4, null, 0, 2],
        fx: {
          echo: { enabled: true, sync: true, syncRate: '1/8', timeMs: 254, feedback: 0.3, toneHz: 3200, mix: 0.25 },
        },
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 7,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2, // Buchla Vactrol Pluck
        synthPresetIdx: 0,
        volume: 0.74,
        pan: 0.35,
        tapeSend: 0.32,
        pattern: [2, 3, 4, null, 2, 4, 5],
        fx: {
          delay: { enabled: true, sync: true, syncRate: '1/4', timeMs: 380, feedback: 0.35, crossfeed: 0.2, mix: 0.3 },
        },
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 8,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 3,
        synthPresetIdx: 2, // Glass Marimba
        volume: 0.68,
        pan: -0.5,
        tapeSend: 0.38,
        pattern: [0, 0, 0, 2, 4, 2, 4, null],
        fx: {
          phaser: { enabled: true, sync: true, syncRate: '2-bar', rateHz: 0.3, depth: 0.6, feedback: 0.45, stages: 4, mix: 0.35 },
        },
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 9,
        speed: 1,
        octave: -1,
        rileyPresetIdx: 3, // Sine Sub Marimba
        synthPresetIdx: 3,
        volume: 0.82,
        pan: 0.0,
        tapeSend: 0.15,
        pattern: [0, null, 0, 4, 0, null, 6, 4, 0],
        fx: {
          compressor: { enabled: true, thresholdDb: -16, ratio: 4, attackSec: 0.01, releaseSec: 0.15, gainDb: 2 },
        },
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 11,
        speed: 1.5,
        octave: 1,
        rileyPresetIdx: 6,
        synthPresetIdx: 0, // Bell Pluck
        volume: 0.64,
        pan: 0.55,
        tapeSend: 0.42,
        pattern: [4, 5, 6, 4, null, 2, 4, 6, null, 5, 4],
        fx: {
          flanger: { enabled: true, sync: true, syncRate: '1-bar', rateHz: 0.5, depthMs: 2.8, feedback: 0.35, mix: 0.3 },
        },
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 12,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4, // Time-Lag Harmonic Pad
        synthPresetIdx: 7,
        volume: 0.6,
        pan: -0.25,
        tapeSend: 0.48,
        pattern: [0, null, null, 4, null, null, 2, null, null, 6, null, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 13,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 1, // Yamaha YC-45D Reed
        synthPresetIdx: 4,
        volume: 0.66,
        pan: 0.25,
        tapeSend: 0.35,
        pattern: [2, 4, 2, 3, 4, null, 4, 6, 5, 4, 2, null, 0],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 15,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9,
        synthPresetIdx: 3, // Deep Bass
        volume: 0.76,
        pan: 0.0,
        tapeSend: 0.12,
        pattern: [0, null, null, 0, null, 4, null, null, 3, null, null, 6, null, 4, null],
      },
    ],
  }),

  // 2. 02. A Rainbow in Curved Air
  buildFactorySong({
    id: 'factory-02-rainbow-curved-air',
    name: '02. A Rainbow in Curved Air',
    nameJa: '02. A Rainbow in Curved Air（虹の屈折）',
    vibe: 'Rapid 2x rotary Combo Organ arpeggios cascading over deep Dorian pedal tones and shimmering stereo tape echoes.',
    vibeJa: '深いドリアン・ペダル音の上を2倍速ロータリー・コンボオルガンのアルペジオが駆け巡る名演再現パッチ。',
    bpm: 132,
    scaleId: 'dorian',
    rootMidi: 62, // D
    justIntonation: true,
    delay: {
      delayLMs: 340,
      delayRMs: 455,
      feedback: 0.52,
      crossFeed: 0.12,
      toneHz: 1750,
      mix: 0.42,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: true,
      masterVol: 0.6,
      rain: 0.1,
      stream: 0.45,
      waves: 0.2,
      wind: 0.4,
      thunderProb: 0.08,
    },
    evolve: {
      enabled: true,
      intervalBars: 8,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: true,
    },
    cables: [
      { id: 'c-rb-1', from: 'clk-div-1', to: 'v1-clk', color: '#F59E0B' },
      { id: 'c-rb-2', from: 'clk-div-3', to: 'v5-clk', color: '#A855F7' },
      { id: 'c-rb-3', from: 'v1-cv', to: 'tla-in-l', color: '#38BDF8' },
      { id: 'c-rb-4', from: 'v2-cv', to: 'tla-in-r', color: '#10B981' },
    ],
    voices: [
      {
        mode: 'ORIGINAL_RILEY',
        length: 7,
        speed: 2,
        octave: 1,
        rileyPresetIdx: 1, // Yamaha YC-45D Reed
        synthPresetIdx: 5,
        volume: 0.76,
        pan: -0.45,
        tapeSend: 0.46,
        pattern: [0, 2, 4, 5, 6, 4, 2],
        fx: {
          phaser: { enabled: true, sync: true, syncRate: '1-bar', rateHz: 0.5, depth: 0.7, feedback: 0.55, stages: 8, mix: 0.4 },
        },
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 9,
        speed: 2,
        octave: 1,
        rileyPresetIdx: 0, // Vox Continental Organ
        synthPresetIdx: 0,
        volume: 0.72,
        pan: 0.45,
        tapeSend: 0.44,
        pattern: [4, 6, 5, 4, 2, 3, 4, 2, 0],
        fx: {
          flanger: { enabled: true, sync: true, syncRate: '2-bar', rateHz: 0.35, depthMs: 4.2, feedback: 0.5, mix: 0.35 },
        },
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 8,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 5, // Just Intonation Drone
        synthPresetIdx: 3,
        volume: 0.84,
        pan: 0.0,
        tapeSend: 0.2,
        pattern: [0, null, null, null, 4, null, null, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 11,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2,
        synthPresetIdx: 5, // Shimmer Lead
        volume: 0.65,
        pan: -0.3,
        tapeSend: 0.4,
        pattern: [0, 3, 4, null, 6, 5, 4, null, 2, 3, 0],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 13,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4,
        synthPresetIdx: 1, // Warm Brass
        volume: 0.62,
        pan: 0.3,
        tapeSend: 0.45,
        pattern: [2, null, 4, null, 5, null, 4, null, 3, null, 2, null, 0],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 6,
        speed: 1.5,
        octave: 1,
        rileyPresetIdx: 7, // Koto Wavefold Pluck
        synthPresetIdx: 0,
        volume: 0.64,
        pan: 0.6,
        tapeSend: 0.38,
        pattern: [0, 4, 2, 6, 4, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 10,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 3,
        synthPresetIdx: 6, // West Coast Buchla Bongos
        volume: 0.68,
        pan: -0.55,
        tapeSend: 0.28,
        pattern: [0, null, 4, 0, null, 2, 5, null, 4, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 16,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9, // Velvet Bass Organ
        synthPresetIdx: 3,
        volume: 0.8,
        pan: 0.0,
        tapeSend: 0.15,
        pattern: [0, null, 0, null, 4, null, 3, null, 0, null, 6, null, 4, null, 2, null],
      },
    ],
  }),

  // 3. 03. Persian Surgery Dervishes
  buildFactorySong({
    id: 'factory-03-persian-dervishes',
    name: '03. Persian Surgery Dervishes',
    nameJa: '03. Persian Surgery Dervishes（ペルシャ旋回舞踏）',
    vibe: 'Hypnotic Hindustani/Persian modal phrasing with microtonal Just Intonation intervals (16/15, 8/5, 15/8) and hollow reed organ drones.',
    vibeJa: '純正律微分音（16/15, 8/5, 15/8）と中空リードオルガンのドローンが渦巻くヒンドゥスターニー／ペルシャ催眠旋法。',
    bpm: 124,
    scaleId: 'bhairav',
    rootMidi: 60, // C
    justIntonation: true,
    delay: {
      delayLMs: 420,
      delayRMs: 630,
      feedback: 0.56,
      crossFeed: 0.13,
      toneHz: 1320,
      mix: 0.45,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: true,
      masterVol: 0.7,
      rain: 0.0,
      stream: 0.1,
      waves: 0.3,
      waveSyncBars: 8,
      wind: 0.65,
      thunderProb: 0.12,
    },
    evolve: {
      enabled: true,
      intervalBars: 16,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: true,
    },
    cables: [
      { id: 'c-psd-1', from: 'clk-div-2', to: 'v3-clk', color: '#10B981' },
      { id: 'c-psd-2', from: 'clk-div-5', to: 'v6-clk', color: '#EC4899' },
      { id: 'c-psd-3', from: 'v1-cv', to: 'tla-in-l', color: '#F59E0B' },
      { id: 'c-psd-4', from: 'v6-seq-trig', to: 'bio-thunder-trig', color: '#38BDF8' },
    ],
    voices: [
      {
        mode: 'ORIGINAL_RILEY',
        length: 5,
        speed: 1.5,
        octave: 1,
        rileyPresetIdx: 6, // Soprano Raga Pipe
        synthPresetIdx: 4,
        volume: 0.75,
        pan: -0.35,
        tapeSend: 0.48,
        pattern: [0, 1, 2, 1, 0],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 7,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 6,
        synthPresetIdx: 4, // Hollow Reed
        volume: 0.72,
        pan: 0.35,
        tapeSend: 0.45,
        pattern: [2, 3, 4, 5, 4, 2, 1],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 8,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 5, // Just Intonation Drone
        synthPresetIdx: 3,
        volume: 0.85,
        pan: 0.0,
        tapeSend: 0.25,
        pattern: [0, null, null, 4, 0, null, null, 4],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 9,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 1, // Yamaha YC-45D Reed
        synthPresetIdx: 4,
        volume: 0.68,
        pan: -0.5,
        tapeSend: 0.4,
        pattern: [4, 5, 6, 0, 6, 5, 4, 2, 1],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 11,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 7,
        synthPresetIdx: 8, // Gamelan Gong
        volume: 0.6,
        pan: 0.55,
        tapeSend: 0.42,
        pattern: [0, null, 4, null, 5, 4, null, 2, 1, null, 0],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 12,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4, // Time-Lag Harmonic Pad
        synthPresetIdx: 7,
        volume: 0.64,
        pan: -0.2,
        tapeSend: 0.5,
        pattern: [0, null, 1, null, 2, null, 4, null, 5, null, 6, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 13,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2,
        synthPresetIdx: 6, // West Coast Buchla Bongos
        volume: 0.66,
        pan: 0.25,
        tapeSend: 0.28,
        pattern: [0, 4, null, 0, 1, null, 4, 5, null, 4, 2, null, 1],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 16,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9, // Velvet Bass Organ
        synthPresetIdx: 3,
        volume: 0.8,
        pan: 0.0,
        tapeSend: 0.18,
        pattern: [0, null, 0, null, 4, null, 0, null, 1, null, 2, null, 4, null, 0, null],
      },
    ],
  }),

  // 4. 04. Dorian Tape Mirage
  buildFactorySong({
    id: 'factory-04-dorian-tape-mirage',
    name: '04. Dorian Tape Mirage',
    nameJa: '04. Dorian Tape Mirage（ドリアン・テープミラージュ）',
    vibe: 'Dual-Revox style asymmetric stereo delays (520ms L / 780ms R) weaving sparse bell plucks with warm brass swells.',
    vibeJa: 'デュアルRevox風非対称ステレオテープ遅延（520ms L / 780ms R）がベル・プラックとブラス・スウェルを織り上げる幻想曲。',
    bpm: 108,
    scaleId: 'dorian',
    rootMidi: 62, // D
    justIntonation: false,
    delay: {
      delayLMs: 520,
      delayRMs: 780,
      feedback: 0.58,
      crossFeed: 0.14,
      toneHz: 1180,
      mix: 0.52,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: true,
      masterVol: 0.75,
      rain: 0.35,
      stream: 0.4,
      waves: 0.45,
      wind: 0.3,
      thunderProb: 0.05,
    },
    evolve: {
      enabled: true,
      intervalBars: 8,
      pitchDrift: true,
      rhythmLength: false,
      timbreMorph: true,
    },
    cables: [
      { id: 'c-dtm-1', from: 'v1-cv', to: 'tla-in-l', color: '#F59E0B' },
      { id: 'c-dtm-2', from: 'v2-cv', to: 'tla-in-r', color: '#38BDF8' },
      { id: 'c-div-3', from: 'clk-div-3', to: 'v4-clk', color: '#F43F5E' },
    ],
    voices: [
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 6,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 2,
        synthPresetIdx: 0, // Bell Pluck
        volume: 0.72,
        pan: -0.5,
        tapeSend: 0.58,
        pattern: [0, null, 2, 4, null, 5],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 9,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4,
        synthPresetIdx: 1, // Warm Brass
        volume: 0.74,
        pan: 0.45,
        tapeSend: 0.54,
        pattern: [0, null, null, 2, null, 4, null, 6, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 8,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2, // Buchla Vactrol Pluck
        synthPresetIdx: 0,
        volume: 0.68,
        pan: -0.25,
        tapeSend: 0.48,
        pattern: [4, null, 2, 0, null, 6, 4, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 11,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4, // Time-Lag Harmonic Pad
        synthPresetIdx: 7,
        volume: 0.66,
        pan: 0.25,
        tapeSend: 0.56,
        pattern: [0, null, 4, null, null, 5, null, 2, null, null, 6],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 13,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 8,
        synthPresetIdx: 2, // Glass Marimba
        volume: 0.62,
        pan: -0.6,
        tapeSend: 0.5,
        pattern: [2, 4, null, 6, 5, null, 4, 2, null, 0, null, 4, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 7,
        speed: 1,
        octave: -1,
        rileyPresetIdx: 3, // Sine Sub Marimba
        synthPresetIdx: 3,
        volume: 0.78,
        pan: 0.0,
        tapeSend: 0.22,
        pattern: [0, null, 4, 0, null, 3, 2],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 15,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 8,
        synthPresetIdx: 9, // Analog String Ensemble
        volume: 0.64,
        pan: 0.55,
        tapeSend: 0.52,
        pattern: [4, null, null, 6, null, null, 5, null, null, 2, null, null, 0, null, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 12,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9,
        synthPresetIdx: 3, // Deep Bass
        volume: 0.76,
        pan: 0.0,
        tapeSend: 0.16,
        pattern: [0, null, null, 0, null, null, 4, null, null, 2, null, null],
      },
    ],
  }),

  // 5. 05. Shri Camel — Desert Mirage
  buildFactorySong({
    id: 'factory-05-shri-camel',
    name: '05. Shri Camel — Desert Mirage',
    nameJa: '05. Shri Camel — 砂漠の陽炎',
    vibe: "Inspired by Riley's Shri Camel—intricate soprano raga ornaments over a drone bass and gentle desert wind in the Biosphere.",
    vibeJa: '名盤『Shri Camel』へのオマージュ。純正律ドローンベースと砂漠の風の上に緻密なソプラノ・ラーガ装飾音が舞う。',
    bpm: 114,
    scaleId: 'mixolydian',
    rootMidi: 67, // G
    justIntonation: true,
    delay: {
      delayLMs: 460,
      delayRMs: 690,
      feedback: 0.5,
      crossFeed: 0.12,
      toneHz: 1480,
      mix: 0.4,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: true,
      masterVol: 0.8,
      rain: 0.0,
      stream: 0.2,
      waves: 0.0,
      wind: 0.75,
      windPreamp: 1.4,
      thunderProb: 0.12,
    },
    evolve: {
      enabled: true,
      intervalBars: 8,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: true,
    },
    cables: [
      { id: 'c-sc-1', from: 'clk-div-1', to: 'v1-clk', color: '#F59E0B' },
      { id: 'c-sc-2', from: 'clk-div-5', to: 'v3-clk', color: '#10B981' },
      { id: 'c-sc-3', from: 'v5-cv', to: 'tla-in-r', color: '#A855F7' },
    ],
    voices: [
      {
        mode: 'ORIGINAL_RILEY',
        length: 7,
        speed: 1.5,
        octave: 1,
        rileyPresetIdx: 6, // Soprano Raga Pipe
        synthPresetIdx: 4,
        volume: 0.76,
        pan: -0.4,
        tapeSend: 0.46,
        pattern: [0, 2, 4, 3, 2, 0, 6],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 11,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 1, // Yamaha YC-45D Reed
        synthPresetIdx: 5,
        volume: 0.72,
        pan: 0.4,
        tapeSend: 0.42,
        pattern: [4, 5, 4, 2, 0, null, 6, 0, 2, 4, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 8,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 5, // Just Intonation Drone
        synthPresetIdx: 3,
        volume: 0.84,
        pan: 0.0,
        tapeSend: 0.2,
        pattern: [0, null, 4, null, 0, null, 6, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 13,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 7,
        synthPresetIdx: 5, // Shimmer Lead
        volume: 0.65,
        pan: -0.55,
        tapeSend: 0.44,
        pattern: [2, 4, 6, null, 5, 4, 2, null, 0, 2, 4, null, 6],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 5,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 7, // Koto Wavefold Pluck
        synthPresetIdx: 0,
        volume: 0.68,
        pan: 0.55,
        tapeSend: 0.4,
        pattern: [0, 4, 2, 6, 4],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 14,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2,
        synthPresetIdx: 6, // West Coast Buchla Bongos
        volume: 0.66,
        pan: -0.25,
        tapeSend: 0.25,
        pattern: [0, null, 4, 0, null, 2, null, 4, 6, null, 0, 4, null, 2],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 9,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 0, // Vox Continental Organ
        synthPresetIdx: 1,
        volume: 0.64,
        pan: 0.25,
        tapeSend: 0.36,
        pattern: [0, 2, null, 4, 5, null, 4, 2, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 16,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9,
        synthPresetIdx: 3, // Deep Bass
        volume: 0.78,
        pan: 0.0,
        tapeSend: 0.14,
        pattern: [0, null, 0, null, 4, null, 0, null, 6, null, 4, null, 2, null, 0, null],
      },
    ],
  }),

  // 6. 06. Poppy Nogood's Phantom Band
  buildFactorySong({
    id: 'factory-06-poppy-nogood',
    name: "06. Poppy Nogood's Phantom Band",
    nameJa: '06. Poppy Nogood — 亡霊楽団のタイムラグ',
    vibe: 'Saxophone-like Hollow Reed synth leads feeding long 680ms / 940ms Time Lag Accumulator loops.',
    vibeJa: 'ソプラノ・サックス風の中空リード音が680ms / 940msの長尺タイムラグ・テープループへ溶け込む傑作再現。',
    bpm: 126,
    scaleId: 'dorian',
    rootMidi: 70, // Bb
    justIntonation: true,
    delay: {
      delayLMs: 680,
      delayRMs: 940,
      feedback: 0.62,
      crossFeed: 0.14,
      toneHz: 1120,
      mix: 0.56,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: false,
      masterVol: 0.6,
      rain: 0.1,
      stream: 0.2,
      waves: 0.35,
      wind: 0.45,
      thunderProb: 0.08,
    },
    evolve: {
      enabled: true,
      intervalBars: 16,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: true,
    },
    cables: [
      { id: 'c-pn-1', from: 'v1-cv', to: 'tla-in-l', color: '#F59E0B' },
      { id: 'c-pn-2', from: 'v2-cv', to: 'tla-in-r', color: '#38BDF8' },
      { id: 'c-pn-3', from: 'clk-div-2', to: 'v5-clk', color: '#A855F7' },
    ],
    voices: [
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 4,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 6,
        synthPresetIdx: 4, // Hollow Reed
        volume: 0.78,
        pan: -0.35,
        tapeSend: 0.62,
        pattern: [0, 2, 4, 3],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 7,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 6, // Soprano Raga Pipe
        synthPresetIdx: 4,
        volume: 0.74,
        pan: 0.35,
        tapeSend: 0.6,
        pattern: [4, 6, 5, 4, null, 2, 0],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 9,
        speed: 1,
        octave: -1,
        rileyPresetIdx: 0, // Vox Continental Organ
        synthPresetIdx: 1,
        volume: 0.72,
        pan: -0.2,
        tapeSend: 0.44,
        pattern: [0, 0, 4, 4, 2, 2, 6, 6, 4],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 11,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4,
        synthPresetIdx: 1, // Warm Brass
        volume: 0.68,
        pan: 0.25,
        tapeSend: 0.55,
        pattern: [0, null, 2, null, 4, null, 6, null, 5, null, 4],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 13,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 5, // Just Intonation Drone
        synthPresetIdx: 3,
        volume: 0.82,
        pan: 0.0,
        tapeSend: 0.3,
        pattern: [0, null, null, 4, null, null, 0, null, null, 6, null, null, 4],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 15,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4, // Time-Lag Harmonic Pad
        synthPresetIdx: 7,
        volume: 0.64,
        pan: -0.5,
        tapeSend: 0.58,
        pattern: [2, null, null, 4, null, null, 6, null, null, 5, null, null, 0, null, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 6,
        speed: 1.5,
        octave: 1,
        rileyPresetIdx: 2,
        synthPresetIdx: 0, // Bell Pluck
        volume: 0.6,
        pan: 0.55,
        tapeSend: 0.48,
        pattern: [4, null, 6, 4, null, 2],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 8,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9, // Velvet Bass Organ
        synthPresetIdx: 3,
        volume: 0.78,
        pan: 0.0,
        tapeSend: 0.2,
        pattern: [0, null, 0, 4, 0, null, 6, 4],
      },
    ],
  }),

  // 7. 07. Descending Moonshine Dervishes
  buildFactorySong({
    id: 'factory-07-moonshine-dervishes',
    name: '07. Descending Moonshine Dervishes',
    nameJa: '07. Descending Moonshine Dervishes（月光の螺旋階段）',
    vibe: 'Accelerating polyrhythmic staircase (consecutive integers 5 through 12) creating a continuous spiral of harmonic phase shifts.',
    vibeJa: '5から12までの連続整数ステップ長が織りなすポリリズムの螺旋階段。終わりなき位相シフトの万華鏡。',
    bpm: 138,
    scaleId: 'bhairav',
    rootMidi: 64, // E
    justIntonation: true,
    delay: {
      delayLMs: 310,
      delayRMs: 465,
      feedback: 0.5,
      crossFeed: 0.11,
      toneHz: 1680,
      mix: 0.38,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: true,
      masterVol: 0.6,
      rain: 0.0,
      stream: 0.3,
      waves: 0.1,
      wind: 0.5,
      thunderProb: 0.08,
    },
    evolve: {
      enabled: true,
      intervalBars: 16,
      pitchDrift: true,
      rhythmLength: false, // Preserve the 5..12 staircase by default
      timbreMorph: true,
    },
    cables: [
      { id: 'c-dmd-1', from: 'clk-div-1', to: 'v1-clk', color: '#F59E0B' },
      { id: 'c-dmd-2', from: 'clk-div-2', to: 'v8-clk', color: '#84CC16' },
      { id: 'c-dmd-3', from: 'v4-cv', to: 'tla-in-l', color: '#F43F5E' },
    ],
    voices: [
      {
        mode: 'ORIGINAL_RILEY',
        length: 5,
        speed: 1.5,
        octave: 1,
        rileyPresetIdx: 0, // Vox Continental Organ
        synthPresetIdx: 0,
        volume: 0.74,
        pan: -0.6,
        tapeSend: 0.38,
        pattern: [6, 5, 4, 2, 0],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 6,
        speed: 1.5,
        octave: 1,
        rileyPresetIdx: 1, // Yamaha YC-45D Reed
        synthPresetIdx: 4,
        volume: 0.72,
        pan: 0.6,
        tapeSend: 0.38,
        pattern: [6, 5, 4, 3, 2, 1],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 7,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2,
        synthPresetIdx: 5, // Shimmer Lead
        volume: 0.7,
        pan: -0.4,
        tapeSend: 0.4,
        pattern: [0, 6, 5, 4, 2, 1, 0],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 8,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 6, // Soprano Raga Pipe
        synthPresetIdx: 4,
        volume: 0.7,
        pan: 0.4,
        tapeSend: 0.42,
        pattern: [4, 3, 2, 1, 0, 6, 5, 4],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 9,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 7,
        synthPresetIdx: 2, // Glass Marimba
        volume: 0.68,
        pan: -0.25,
        tapeSend: 0.35,
        pattern: [0, 2, 4, 5, 6, 5, 4, 2, 1],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 10,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2, // Buchla Vactrol Pluck
        synthPresetIdx: 0,
        volume: 0.68,
        pan: 0.25,
        tapeSend: 0.34,
        pattern: [4, null, 2, 1, 0, null, 6, 5, 4, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 11,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 5, // Just Intonation Drone
        synthPresetIdx: 3,
        volume: 0.8,
        pan: -0.1,
        tapeSend: 0.22,
        pattern: [0, null, 4, null, 0, null, 5, null, 4, null, 1],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 12,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9,
        synthPresetIdx: 3, // Deep Bass
        volume: 0.82,
        pan: 0.1,
        tapeSend: 0.18,
        pattern: [0, null, null, 4, null, null, 1, null, null, 4, null, null],
      },
    ],
  }),

  // 8. 08. Olson III — Celestial Choir
  buildFactorySong({
    id: 'factory-08-olson-celestial-choir',
    name: '08. Olson III — Celestial Choir',
    nameJa: '08. Olson III — 天上の聖堂合唱団',
    vibe: 'Slow, cathedral-like Harmonic Pads and Celestial Choir voices synced with 8-bar ocean wave swells in the Biosphere.',
    vibeJa: 'バイオスフィアの8小節周期の波のうねりと同期する、大聖堂のような倍音パッドと天上のクワイア・アンサンブル。',
    bpm: 92,
    scaleId: 'pentatonic',
    rootMidi: 65, // F
    justIntonation: true,
    delay: {
      delayLMs: 640,
      delayRMs: 880,
      feedback: 0.58,
      crossFeed: 0.14,
      toneHz: 1240,
      mix: 0.5,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: true,
      masterVol: 0.95,
      rain: 0.25,
      stream: 0.45,
      waves: 0.9,
      waveSyncBars: 8,
      wind: 0.55,
      thunderProb: 0.05,
    },
    evolve: {
      enabled: true,
      intervalBars: 8,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: true,
    },
    cables: [
      { id: 'c-ol-1', from: 'clk-div-2', to: 'v1-clk', color: '#F59E0B' },
      { id: 'c-ol-2', from: 'clk-div-3', to: 'v2-clk', color: '#38BDF8' },
      { id: 'c-ol-3', from: 'v1-cv', to: 'tla-in-l', color: '#10B981' },
      { id: 'c-ol-4', from: 'v2-cv', to: 'tla-in-r', color: '#EC4899' },
    ],
    voices: [
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 8,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4,
        synthPresetIdx: 7, // Celestial Choir
        volume: 0.78,
        pan: -0.45,
        tapeSend: 0.56,
        pattern: [0, null, 2, null, 3, null, 4, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 10,
        speed: 0.5,
        octave: 1,
        rileyPresetIdx: 8,
        synthPresetIdx: 7, // Celestial Choir
        volume: 0.74,
        pan: 0.45,
        tapeSend: 0.56,
        pattern: [2, null, 4, null, 3, null, 1, null, 0, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 12,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4, // Time-Lag Harmonic Pad
        synthPresetIdx: 9,
        volume: 0.72,
        pan: -0.25,
        tapeSend: 0.52,
        pattern: [0, null, null, 3, null, null, 2, null, null, 4, null, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 14,
        speed: 0.5,
        octave: 1,
        rileyPresetIdx: 8, // Glass Harmonica
        synthPresetIdx: 0,
        volume: 0.66,
        pan: 0.3,
        tapeSend: 0.54,
        pattern: [4, null, 3, null, 2, null, null, 4, null, 1, null, 0, null, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 9,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 2,
        synthPresetIdx: 0, // Bell Pluck
        volume: 0.62,
        pan: -0.55,
        tapeSend: 0.48,
        pattern: [0, 2, 3, null, 4, 3, 2, null, 1],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 11,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4,
        synthPresetIdx: 9, // Analog String Ensemble
        volume: 0.68,
        pan: 0.5,
        tapeSend: 0.5,
        pattern: [1, null, 3, null, 4, null, 2, null, 0, null, 3],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 13,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 5, // Just Intonation Drone
        synthPresetIdx: 3,
        volume: 0.82,
        pan: 0.0,
        tapeSend: 0.25,
        pattern: [0, null, null, null, 3, null, null, null, 2, null, null, 4, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 15,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9, // Velvet Bass Organ
        synthPresetIdx: 3,
        volume: 0.78,
        pan: 0.0,
        tapeSend: 0.18,
        pattern: [0, null, null, 0, null, null, 3, null, null, 2, null, null, 0, null, null],
      },
    ],
  }),

  // 9. 09. Salome Dances for Peace
  buildFactorySong({
    id: 'factory-09-salome-dances',
    name: '09. Salome Dances for Peace',
    nameJa: '09. Salome Dances for Peace（平和のためのサロメの舞）',
    vibe: 'Chamber-quartet counterpoint pairing String Ensemble voices with Plucked Harp and Marimba ostinatos.',
    vibeJa: '弦楽アンサンブルとハープ・プラック、マリンバ・オスティナートが緻密に対話する室内楽ポリメトリック四重奏。',
    bpm: 120,
    scaleId: 'dorian',
    rootMidi: 69, // A
    justIntonation: false,
    delay: {
      delayLMs: 360,
      delayRMs: 540,
      feedback: 0.42,
      crossFeed: 0.09,
      toneHz: 1620,
      mix: 0.34,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: false,
      masterVol: 0.55,
      rain: 0.0,
      stream: 0.3,
      waves: 0.1,
      wind: 0.25,
      thunderProb: 0.05,
    },
    evolve: {
      enabled: true,
      intervalBars: 8,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: false,
    },
    cables: [
      { id: 'c-sal-1', from: 'clk-div-1', to: 'v3-clk', color: '#10B981' },
      { id: 'c-sal-2', from: 'clk-div-2', to: 'v1-clk', color: '#F59E0B' },
      { id: 'c-sal-3', from: 'v5-cv', to: 'tla-in-l', color: '#A855F7' },
    ],
    voices: [
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 7,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4,
        synthPresetIdx: 9, // Analog String Ensemble
        volume: 0.76,
        pan: -0.45,
        tapeSend: 0.38,
        pattern: [0, 2, 4, null, 5, 4, 2],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 8,
        speed: 0.5,
        octave: 1,
        rileyPresetIdx: 8,
        synthPresetIdx: 9, // Analog String Ensemble
        volume: 0.72,
        pan: 0.45,
        tapeSend: 0.4,
        pattern: [4, null, 6, 5, 4, null, 2, 3],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 11,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 7, // Koto Wavefold Pluck
        synthPresetIdx: 0,
        volume: 0.7,
        pan: -0.3,
        tapeSend: 0.34,
        pattern: [0, 4, 2, 6, 4, null, 2, 5, 4, 2, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 12,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 3,
        synthPresetIdx: 2, // Glass Marimba
        volume: 0.68,
        pan: 0.3,
        tapeSend: 0.36,
        pattern: [0, 2, 4, 2, 5, 4, 2, 0, 6, 4, 2, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 13,
        speed: 1,
        octave: 0,
        rileyPresetIdx: 2, // Buchla Vactrol Pluck
        synthPresetIdx: 0,
        volume: 0.66,
        pan: -0.55,
        tapeSend: 0.32,
        pattern: [4, null, 2, 0, null, 4, 5, null, 6, 4, null, 2, 0],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 16,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 3, // Sine Sub Marimba
        synthPresetIdx: 3,
        volume: 0.8,
        pan: 0.0,
        tapeSend: 0.16,
        pattern: [0, null, 4, null, 0, null, 3, null, 2, null, 6, null, 4, null, 0, null],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 5,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 2,
        synthPresetIdx: 0, // Bell Pluck
        volume: 0.6,
        pan: 0.55,
        tapeSend: 0.42,
        pattern: [0, 4, 6, null, 4],
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 9,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 9,
        synthPresetIdx: 3, // Deep Bass
        volume: 0.78,
        pan: 0.0,
        tapeSend: 0.15,
        pattern: [0, null, null, 4, null, 2, null, 6, null],
      },
    ],
  }),

  // 10. 10. Kyoto Rain & Modular Bells
  buildFactorySong({
    id: 'factory-10-kyoto-rain-bells',
    name: '10. Kyoto Rain & Modular Bells',
    nameJa: '10. Kyoto Rain & Modular Bells（京都の雨とモジュラー梵鐘）',
    vibe: 'Ambient generative meditation pairing Gamelan Gong, Glass Marimba, and Koto Pluck with clock-synced rain droplets and distant thunder.',
    vibeJa: 'ガムラン・ゴング、グラスマリンバ、箏プラックに、クロック同期した雨雫と遠雷が重なる京都庭園の生成瞑想パッチ。',
    bpm: 96,
    scaleId: 'pentatonic',
    rootMidi: 60, // C
    justIntonation: true,
    delay: {
      delayLMs: 480,
      delayRMs: 720,
      feedback: 0.54,
      crossFeed: 0.13,
      toneHz: 1420,
      mix: 0.46,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: true,
      masterVol: 0.9,
      rain: 0.85,
      rainPreamp: 1.4,
      rainDropletSync: true,
      stream: 0.7,
      streamPreamp: 1.3,
      waves: 0.5,
      wind: 0.45,
      thunderProb: 0.28,
      thunderPreamp: 1.5,
    },
    evolve: {
      enabled: true,
      intervalBars: 8,
      pitchDrift: true,
      rhythmLength: true,
      timbreMorph: true,
    },
    cables: [
      { id: 'c-kyo-1', from: 'clk-div-3', to: 'v1-clk', color: '#F59E0B' },
      { id: 'c-kyo-2', from: 'clk-div-5', to: 'v5-clk', color: '#A855F7' },
      { id: 'c-kyo-3', from: 'v3-cv', to: 'tla-in-l', color: '#10B981' },
      { id: 'c-kyo-4', from: 'v4-cv', to: 'tla-in-r', color: '#F43F5E' },
      { id: 'c-kyo-5', from: 'v1-seq-trig', to: 'bio-thunder-trig', color: '#EC4899' },
    ],
    voices: [
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 7,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 7,
        synthPresetIdx: 8, // Gamelan Gong
        volume: 0.74,
        pan: -0.45,
        tapeSend: 0.52,
        pattern: [0, null, 3, null, 2, null, 4],
        fx: {
          delay: { enabled: true, sync: true, syncRate: '1/2', timeMs: 625, feedback: 0.48, crossfeed: 0.25, mix: 0.4 },
        },
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 9,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 3,
        synthPresetIdx: 2, // Glass Marimba
        volume: 0.7,
        pan: 0.4,
        tapeSend: 0.48,
        pattern: [0, 2, 3, null, 4, 2, null, 1, null],
        fx: {
          echo: { enabled: true, sync: true, syncRate: '1/8', timeMs: 312, feedback: 0.4, toneHz: 3400, mix: 0.35 },
        },
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 11,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 7, // Koto Wavefold Pluck
        synthPresetIdx: 0,
        volume: 0.72,
        pan: -0.35,
        tapeSend: 0.5,
        pattern: [4, 3, 2, null, 0, 1, 2, null, 3, 4, null],
        fx: {
          phaser: { enabled: true, sync: true, syncRate: '1-bar', rateHz: 0.4, depth: 0.65, feedback: 0.5, stages: 4, mix: 0.4 },
        },
      },
      {
        mode: 'FULL_SYNTH_SUITE',
        length: 13,
        speed: 1,
        octave: 1,
        rileyPresetIdx: 2,
        synthPresetIdx: 0, // Bell Pluck
        volume: 0.66,
        pan: 0.5,
        tapeSend: 0.52,
        pattern: [2, null, 4, 3, null, 1, 0, null, 3, 2, null, 4, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 15,
        speed: 0.5,
        octave: 1,
        rileyPresetIdx: 8, // Glass Harmonica
        synthPresetIdx: 7,
        volume: 0.64,
        pan: -0.2,
        tapeSend: 0.54,
        pattern: [0, null, null, 3, null, null, 4, null, null, 2, null, null, 1, null, null],
        fx: {
          flanger: { enabled: true, sync: true, syncRate: '2-bar', rateHz: 0.2, depthMs: 5.5, feedback: 0.55, mix: 0.4 },
        },
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 8,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 3, // Sine Sub Marimba
        synthPresetIdx: 3,
        volume: 0.78,
        pan: 0.0,
        tapeSend: 0.24,
        pattern: [0, null, 3, null, 0, null, 2, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 12,
        speed: 0.5,
        octave: 0,
        rileyPresetIdx: 4, // Time-Lag Harmonic Pad
        synthPresetIdx: 7,
        volume: 0.68,
        pan: 0.2,
        tapeSend: 0.5,
        pattern: [0, null, null, 2, null, null, 3, null, null, 4, null, null],
      },
      {
        mode: 'ORIGINAL_RILEY',
        length: 16,
        speed: 0.5,
        octave: -1,
        rileyPresetIdx: 5, // Just Intonation Drone
        synthPresetIdx: 3,
        volume: 0.8,
        pan: 0.0,
        tapeSend: 0.2,
        pattern: [0, null, null, null, 3, null, null, null, 0, null, null, null, 2, null, null, null],
      },
    ],
  }),
];

export function cloneRileySongPatch(patch: RileySongPatch): RileySongPatch {
  return JSON.parse(JSON.stringify(patch)) as RileySongPatch;
}

/**
 * Creates a completely clean, empty initialization patch for RileyRack 800
 * with 0 active steps across all 8 voices, 0 patch cables, and Biosphere/Evolve disabled.
 */
export function createEmptyRileySongPatch(ecoMode?: boolean): RileySongPatch {
  const base = cloneRileySongPatch(RILEY_FACTORY_SONG_PRESETS[0]);
  return {
    ...base,
    id: `user-init-${Date.now()}`,
    name: 'Init Empty Rack',
    nameJa: '初期ブランク・ラック (Empty)',
    vibe: 'Clean initialized rack with 0 active steps and 0 patch cables.',
    vibeJa: '全8ボイスのステップとパッチケーブルを初期化した空のプロジェクト。',
    isFactory: false,
    ecoMode: ecoMode ?? detectLowSpecDevice(),
    cables: [],
    evolve: {
      ...base.evolve,
      enabled: false,
    },
    biosphere: {
      ...createDefaultBiosphereState(),
      enabled: false,
      rain: 0,
      stream: 0,
      waves: 0,
      wind: 0,
      thunderProb: 0,
    },
    voices: base.voices.map((v) => ({
      ...v,
      length: 16,
      speed: 1,
      octave: 0,
      mute: false,
      solo: false,
      pan: 0,
      tapeSend: 0.25,
      fx: createDefaultVoiceFxRack(),
      steps: Array.from({ length: 16 }, () => ({
        degree: 0,
        active: false,
      })),
    })),
  };
}

