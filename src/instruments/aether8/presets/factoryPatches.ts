/**
 * src/instruments/aether8/presets/factoryPatches.ts
 *
 * - Complete 12-Module Patch Jack Registry (`PATCH_JACK_REGISTRY`)
 * - 10 Direct Output Channel Strip Definitions
 * - X0X Pattern Generators (`DUB GROOVE`, `MINIMAL`, `CLEAR`)
 * - 4 Signature Factory Patches:
 *   1. COPPICE DUB
 *   2. SUBTERRANEAN
 *   3. TAPE DECAY
 *   4. SILK RAIN
 */

import type {
  Aether8PatchV4,
  BeatVoiceKey,
  BeatVoiceSynthConfig,
  DirectOutputChannelKey,
  OutputChannelFxConfig,
  PatchJackDef,
  PatternBankId,
  XoxPatternBank,
} from '../types';

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
  { key: 'beatBus', code: '07', label: 'BEAT BUS', color: '#FB7185' },
  { key: 'foldFx', code: '08', label: 'FOLD FX', color: '#EC4899' },
  { key: 'tapeDly', code: '09', label: 'TAPE DLY', color: '#818CF8' },
  { key: 'biosphere', code: '10', label: 'BIOSPHERE', color: '#34D399' },
];

export const PATCH_JACK_REGISTRY: PatchJackDef[] = [
  // 01 // X0X UNDERTONE SEQUENCER
  { id: 'xox:trig1', moduleId: '01', label: 'TRK 1 TRG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig2', moduleId: '01', label: 'TRK 2 TRG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig3', moduleId: '01', label: 'TRK 3 TRG', direction: 'out', domain: 'trig' },
  { id: 'xox:trig4', moduleId: '01', label: 'TRK 4 TRG', direction: 'out', domain: 'trig' },
  { id: 'xox:stepClk', moduleId: '01', label: 'STEP CLK', direction: 'out', domain: 'trig' },
  { id: 'xox:barTrig', moduleId: '01', label: 'BAR 1 TRG', direction: 'out', domain: 'trig' },

  // 02 // ANALOG BEAT SYNTH
  { id: 'beats:kickIn', moduleId: '02', label: 'KICK IN', direction: 'in', domain: 'trig' },
  { id: 'beats:rimIn', moduleId: '02', label: 'RIM IN', direction: 'in', domain: 'trig' },
  { id: 'beats:hatIn', moduleId: '02', label: 'HAT IN', direction: 'in', domain: 'trig' },
  { id: 'beats:tomIn', moduleId: '02', label: 'TOM IN', direction: 'in', domain: 'trig' },
  { id: 'beats:ptchCv', moduleId: '02', label: 'PTCH CV', direction: 'in', domain: 'cv' },
  { id: 'beats:filtCv', moduleId: '02', label: 'FILT CV', direction: 'in', domain: 'cv' },
  { id: 'beats:kickOut', moduleId: '02', label: 'KICK', direction: 'out', domain: 'audio' },
  { id: 'beats:rimOut', moduleId: '02', label: 'RIM', direction: 'out', domain: 'audio' },
  { id: 'beats:hatOut', moduleId: '02', label: 'HAT', direction: 'out', domain: 'audio' },
  { id: 'beats:tomOut', moduleId: '02', label: 'TOM', direction: 'out', domain: 'audio' },
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

export function createDefaultBeatVoices(): Record<BeatVoiceKey, BeatVoiceSynthConfig> {
  return {
    kick: {
      wave: 'sine',
      filterType: 'lowpass',
      freq: 48,
      pEnvAmt: 0.72,
      pEnvDec: 0.085,
      noiseMix: 0.06,
      cutoff: 260,
      res: 2.2,
      filtEnv: 850,
      drive: 0.38,
      attack: 0.002,
      decay: 0.42,
      sustain: 0.0,
      release: 0.18,
    },
    rim: {
      wave: 'triangle',
      filterType: 'bandpass',
      freq: 340,
      pEnvAmt: 0.42,
      pEnvDec: 0.025,
      noiseMix: 0.35,
      cutoff: 1850,
      res: 4.5,
      filtEnv: 1400,
      drive: 0.28,
      attack: 0.001,
      decay: 0.14,
      sustain: 0.0,
      release: 0.08,
    },
    hat: {
      wave: 'square',
      filterType: 'highpass',
      freq: 680,
      pEnvAmt: 0.15,
      pEnvDec: 0.018,
      noiseMix: 0.88,
      cutoff: 5400,
      res: 3.1,
      filtEnv: 1200,
      drive: 0.18,
      attack: 0.001,
      decay: 0.09,
      sustain: 0.0,
      release: 0.06,
    },
    tom: {
      wave: 'sine',
      filterType: 'lowpass',
      freq: 118,
      pEnvAmt: 0.55,
      pEnvDec: 0.11,
      noiseMix: 0.12,
      cutoff: 920,
      res: 3.8,
      filtEnv: 1100,
      drive: 0.32,
      attack: 0.003,
      decay: 0.32,
      sustain: 0.0,
      release: 0.15,
    },
  };
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
    beatBus: makeCh(0.74, 0, 0.28),
    foldFx: makeCh(0.35, -0.2, 0.42),
    tapeDly: makeCh(0.58, 0.2, 0.62),
    biosphere: makeCh(0.48, 0, 0.52),
  };
}

export function createXoxPatternFromStyle(
  style: 'dub' | 'minimal' | 'polyrhythm' | 'clear',
  barCount: 1 | 2 | 4 = 2,
  trackLengths: [number, number, number, number] = [16, 16, 16, 16]
): XoxPatternBank {
  const steps: number[][] = Array.from({ length: 4 }, () =>
    new Array(64).fill(0)
  );

  if (style === 'clear') {
    return { barCount, trackLengths, steps };
  }

  for (let bar = 0; bar < 4; bar++) {
    const offset = bar * 16;
    if (style === 'dub') {
      // Sub Kick on 0, 6, 10
      [0, 6, 10].forEach((s) => (steps[0][offset + s] = 1));
      // Dub Rim on 4, 12, and ghost on 15 in Bar 2/4
      [4, 12].forEach((s) => (steps[1][offset + s] = 1));
      if (bar % 2 === 1) steps[1][offset + 15] = 1;
      // Dust Hat offbeats & dub shuffles
      [2, 5, 6, 10, 13, 14].forEach((s) => (steps[2][offset + s] = 1));
      // Wood Tom syncopated undertone
      [3, 11, 14].forEach((s) => (steps[3][offset + s] = 1));
    } else if (style === 'minimal') {
      [0, 8].forEach((s) => (steps[0][offset + s] = 1));
      [4, 12].forEach((s) => (steps[1][offset + s] = 1));
      [2, 6, 10, 14].forEach((s) => (steps[2][offset + s] = 1));
      [7, 15].forEach((s) => (steps[3][offset + s] = 1));
    } else if (style === 'polyrhythm') {
      [0, 5, 10].forEach((s) => (steps[0][offset + s] = 1));
      [3, 7, 11].forEach((s) => (steps[1][offset + s] = 1));
      [0, 2, 4, 7, 9, 11].forEach((s) => (steps[2][offset + s] = 1));
      [1, 4, 8, 10].forEach((s) => (steps[3][offset + s] = 1));
    }
  }

  return { barCount, trackLengths, steps };
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
      ch2Beat: 0.72,
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
  patch: Aether8PatchV4;
}

function buildFactoryPatch(
  name: string,
  overrides: Partial<Aether8PatchV4>,
  paramOverrides?: Record<string, Partial<Record<string, number>>>
): Aether8PatchV4 {
  const baseParams = createDefaultParams();
  if (paramOverrides) {
    for (const [modKey, modVals] of Object.entries(paramOverrides)) {
      baseParams[modKey] = {
        ...baseParams[modKey],
        ...(modVals as Record<string, number>),
      };
    }
  }

  const xoxPatterns: Record<PatternBankId, XoxPatternBank> = {
    A: createXoxPatternFromStyle('dub', 2, [16, 16, 16, 16]),
    B: createXoxPatternFromStyle('polyrhythm', 2, [16, 16, 13, 11]),
    C: createXoxPatternFromStyle('minimal', 1, [16, 16, 16, 16]),
    D: createXoxPatternFromStyle('dub', 4, [16, 12, 16, 14]),
  };

  return {
    version: 'AETHER-8-v4',
    name,
    savedAt: new Date().toISOString(),
    bpm: 68,
    masterVol: 0.8,
    timbreMode: 'soft',
    chordType: 'min7',
    noiseColor: 'pink',
    filterType: 'lp24',
    activePattern: 'A',
    ecoMode: false,
    patternChainEnabled: false,
    xoxAutoFollow: true,
    xoxPatterns,
    xoxMuted: [false, false, false, false],
    xoxNormLink: [true, true, true, true],
    clockExtStepMode: false,
    beatVoices: createDefaultBeatVoices(),
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

export const AETHER8_FACTORY_PATCHES: FactoryPatchMeta[] = [
  {
    id: 'coppice-dub',
    name: 'COPPICE DUB',
    tagline: 'Brian Grainger Inspired Hypnotic Velvet Dub-Drone',
    patch: buildFactoryPatch(
      'COPPICE DUB',
      {
        bpm: 68,
        timbreMode: 'soft',
        chordType: 'min7',
        noiseColor: 'pink',
      },
      {
        drone: { baseFreq: 55, driftDetune: 16, subLevel: 0.78 },
        filter: { cutoff: 1320, resonance: 3.4 },
        delay: { tapeTime: 0.44, feedback: 0.72, wowFlut: 0.35 },
      }
    ),
  },
  {
    id: 'subterranean',
    name: 'SUBTERRANEAN',
    tagline: 'Polyrhythmic Vactrol Sub-Pulse & Harsh West-Coast Fold',
    patch: buildFactoryPatch(
      'SUBTERRANEAN',
      {
        bpm: 58,
        timbreMode: 'harsh',
        chordType: 'fifth',
        noiseColor: 'brown',
        activePattern: 'B',
      },
      {
        drone: { baseFreq: 41.2, waveFold: 0.62, subLevel: 0.88 },
        filter: { cutoff: 860, resonance: 5.2, satDrive: 0.58 },
        pulse: { subPitch: 38, punchDrop: 0.82, vactrolDec: 0.92 },
      }
    ),
  },
  {
    id: 'tape-decay',
    name: 'TAPE DECAY',
    tagline: 'Degrading Reel-to-Reel Echoes, Vinyl Dust & Chaos Swells',
    patch: buildFactoryPatch(
      'TAPE DECAY',
      {
        bpm: 74,
        timbreMode: 'soft',
        chordType: 'min9',
        noiseColor: 'hiss',
      },
      {
        noise: { vinylDust: 0.72, tapeHiss: 0.58, noiseLevel: 0.48 },
        delay: { tapeTime: 0.56, feedback: 0.84, wowFlut: 0.64, echoWet: 0.65 },
        fx: { wavefold: 0.42, bitCrush: 0.35 },
      }
    ),
  },
  {
    id: 'silk-rain',
    name: 'SILK RAIN',
    tagline: '5-Engine Biosphere Storm, Shoreline Waves & Silk Harmonics',
    patch: buildFactoryPatch(
      'SILK RAIN',
      {
        bpm: 52,
        timbreMode: 'soft',
        chordType: 'unison',
        noiseColor: 'pink',
        activePattern: 'C',
      },
      {
        drone: { baseFreq: 65.41, driftDetune: 22, swarmLevel: 0.84 },
        biosphere: {
          rainLvl: 0.74,
          rainSize: 0.68,
          waterFlow: 0.56,
          wavesLvl: 0.68,
          windGust: 0.54,
          stormProb: 0.45,
        },
      }
    ),
  },
];
