/**
 * src/instruments/aether8/audio/Aether8AudioEngine.ts
 *
 * 48kHz Audio-Rate Modular Synthesis Graph, Sample-Accurate Lookahead Master Clock,
 * 5-Engine Biosphere Lab & 10-Channel Direct Output Console for AETHER-8 v4.
 */

import { audioGuard } from '../../../core/audioGuard';
import {
  computeEuclideanSteps,
  DIRECT_OUTPUT_CHANNELS,
} from '../presets/factoryPatches';
import type {
  Aether8PatchV4,
  BeatVoiceKey,
  DirectOutputChannelKey,
  PatternBankId,
} from '../types';

export interface Aether8Telemetry {
  globalStep: number;
  xoxTrackSteps: [number, number, number, number];
  euclidStep: number;
  lfo1Val: number; // -1..+1
  lfo2Val: number; // -1..+1
  chaosVal: number; // -1..+1
  shVal: number; // -1..+1
  beatEnvFollower: number; // 0..1
  activePattern: PatternBankId;
}

export type Aether8TelemetryListener = (telemetry: Aether8Telemetry) => void;

interface DirectChannelNodes {
  input: GainNode;
  satShaper: WaveShaperNode;
  hpFilter: BiquadFilterNode;
  lpFilter: BiquadFilterNode;
  panner: StereoPannerNode;
  fader: GainNode;
  revSend: GainNode;
}

function makeTubeCurve(drive: number): Float32Array<ArrayBuffer> {
  const k = Math.max(0.01, drive) * 42;
  const n = 512;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // Asymmetrical tube/tape saturation
    const asym = x >= 0 ? Math.tanh(x * (1 + k * 0.12)) : Math.tanh(x * (1 + k * 0.08));
    curve[i] = asym;
  }
  return curve;
}

function makeWavefoldCurve(foldAmt: number): Float32Array<ArrayBuffer> {
  const gain = 1 + Math.max(0, foldAmt) * 5.5;
  const n = 512;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = ((i * 2) / n - 1) * gain;
    curve[i] = Math.sin(x * Math.PI * 0.5);
  }
  return curve;
}

function makeCavernImpulse(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2.8);
  const buf = ctx.createBuffer(2, len, sr);
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  for (let i = 0; i < len; i++) {
    const env = Math.pow(1 - i / len, 2.2);
    l[i] = (Math.random() * 2 - 1) * env;
    r[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}

function makeColoredNoiseBuffer(
  ctx: BaseAudioContext,
  color: 'white' | 'pink' | 'brown' | 'hiss'
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * 2;
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let lastBrown = 0;

  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'white') {
      out[i] = white * 0.7;
    } else if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 0.0526913;
      out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    } else if (color === 'brown') {
      lastBrown = (lastBrown + 0.02 * white) / 1.02;
      out[i] = lastBrown * 3.2;
    } else {
      // Tape Hiss: high-frequency biased analog hiss + warm hum
      const hum = Math.sin((2 * Math.PI * 60 * i) / sr) * 0.06;
      out[i] = (white - b0 * 0.5) * 0.35 + hum;
      b0 = white;
    }
  }
  return buf;
}

export class Aether8AudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private silkMasterFilter: BiquadFilterNode | null = null;
  private masterTapeSaturator: WaveShaperNode | null = null;
  private masterSidechainGain: GainNode | null = null;
  private cavernReverbSend: ConvolverNode | null = null;
  private cavernReverbReturn: GainNode | null = null;

  // Continuous Drone, Noise, Filter, Delay & Biosphere Nodes
  private droneOscs: OscillatorNode[] = [];
  private droneGains: GainNode[] = [];
  private subOsc1: OscillatorNode | null = null;
  private subOsc2: OscillatorNode | null = null;
  private subBusGain: GainNode | null = null;
  private droneWavefolder: WaveShaperNode | null = null;
  private droneBusGain: GainNode | null = null;

  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFormantFilter: BiquadFilterNode | null = null;
  private noiseBusGain: GainNode | null = null;
  private noiseBuffers: Record<
    'white' | 'pink' | 'brown' | 'hiss',
    AudioBuffer
  > | null = null;

  private zdfFilter1: BiquadFilterNode | null = null;
  private zdfFilter2: BiquadFilterNode | null = null;
  private zdfDriveShaper: WaveShaperNode | null = null;
  private zdfBusGain: GainNode | null = null;

  private foldFxShaper: WaveShaperNode | null = null;
  private foldFxFilter: BiquadFilterNode | null = null;
  private foldFxBusGain: GainNode | null = null;

  private tapeDelayNode: DelayNode | null = null;
  private tapeDelayDamp: BiquadFilterNode | null = null;
  private tapeDelayFeedback: GainNode | null = null;
  private tapeDelayWet: GainNode | null = null;

  // Biosphere Continuous Engines
  private bioRainGain: GainNode | null = null;
  private bioWaterGain: GainNode | null = null;
  private bioWavesFilter: BiquadFilterNode | null = null;
  private bioWavesGain: GainNode | null = null;
  private bioWindFilter: BiquadFilterNode | null = null;
  private bioWindGain: GainNode | null = null;
  private bioMasterBus: GainNode | null = null;

  private directChannels: Record<DirectOutputChannelKey, DirectChannelNodes> | null =
    null;

  private patchRef: Aether8PatchV4;
  private isPlaying: boolean = false;
  private schedulerTimer: number | null = null;
  private modLoopTimer: number | null = null;
  private nextStepTime: number = 0;

  private currentGlobalStep: number = 0;
  private euclidStepCounter: number = 0;
  private lfo1Phase: number = 0;
  private lfo2Phase: number = 0;
  private chaosState: number = 0.15;
  private shTarget: number = 0;
  private shCurrent: number = 0;
  private beatEnvValue: number = 0;
  private queuedPatternId: PatternBankId | null = null;

  private telemetryListeners: Set<Aether8TelemetryListener> = new Set();

  constructor(initialPatch: Aether8PatchV4) {
    this.patchRef = initialPatch;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  public getMasterAnalyser(): AnalyserNode | null {
    return this.masterAnalyser;
  }

  public isEnginePlaying(): boolean {
    return this.isPlaying;
  }

  public onTelemetry(listener: Aether8TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public updatePatch(patch: Aether8PatchV4): void {
    const prevNoiseColor = this.patchRef.noiseColor;
    this.patchRef = patch;
    if (prevNoiseColor !== patch.noiseColor && this.audioCtx) {
      this.rebuildNoiseSource();
    }
    this.syncContinuousNodes();
  }

  public queuePatternSwitch(bankId: PatternBankId): void {
    if (!this.isPlaying) {
      this.patchRef.activePattern = bankId;
      this.queuedPatternId = null;
      return;
    }
    this.queuedPatternId = bankId;
  }

  public ensureInitialized(): AudioContext {
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      return this.audioCtx;
    }

    const { audioCtx, masterGain } =
      audioGuard.createIsolatedAudioContext('aether8');
    this.audioCtx = audioCtx;
    this.masterGain = masterGain;

    this.noiseBuffers = {
      white: makeColoredNoiseBuffer(audioCtx, 'white'),
      pink: makeColoredNoiseBuffer(audioCtx, 'pink'),
      brown: makeColoredNoiseBuffer(audioCtx, 'brown'),
      hiss: makeColoredNoiseBuffer(audioCtx, 'hiss'),
    };

    // Master Chain: Sidechain Bus -> Silk/Harsh Filter -> Reel-to-Reel Tape Saturator -> Compressor/Limiter -> Analyser -> Master Gain
    const sidechainBus = audioCtx.createGain();
    const silkFilter = audioCtx.createBiquadFilter();
    silkFilter.type = 'lowpass';
    silkFilter.frequency.value =
      this.patchRef.timbreMode === 'soft' ? 3100 : 16500;

    const tapeSat = audioCtx.createWaveShaper();
    tapeSat.curve = makeTubeCurve(0.35);
    tapeSat.oversample = '2x';

    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -2.0;
    limiter.ratio.value = 12.0;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.08;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;

    const cavernConv = audioCtx.createConvolver();
    cavernConv.buffer = makeCavernImpulse(audioCtx);
    const cavernRet = audioCtx.createGain();
    cavernRet.gain.value = 0.35;
    cavernConv.connect(cavernRet);
    cavernRet.connect(silkFilter);

    sidechainBus.connect(silkFilter);
    silkFilter.connect(tapeSat);
    tapeSat.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(masterGain);

    this.masterSidechainGain = sidechainBus;
    this.silkMasterFilter = silkFilter;
    this.masterTapeSaturator = tapeSat;
    this.masterAnalyser = analyser;
    this.cavernReverbSend = cavernConv;
    this.cavernReverbReturn = cavernRet;

    // Build 10 Direct Output Channel Strips with 4-Stage Granular FX
    const directMap = {} as Record<DirectOutputChannelKey, DirectChannelNodes>;
    for (const chMeta of DIRECT_OUTPUT_CHANNELS) {
      const input = audioCtx.createGain();
      const satShaper = audioCtx.createWaveShaper();
      satShaper.curve = makeTubeCurve(0.22);

      const hpFilter = audioCtx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = 30;

      const lpFilter = audioCtx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 14000;

      const panner = audioCtx.createStereoPanner();
      const fader = audioCtx.createGain();
      const revSend = audioCtx.createGain();

      input.connect(satShaper);
      satShaper.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lpFilter.connect(panner);
      panner.connect(fader);

      // Kick & Beat Bus bypass sidechain ducking; Drone/Echo/Atmosphere flow into sidechain bus
      if (chMeta.key === 'kick' || chMeta.key === 'beatBus') {
        fader.connect(silkFilter);
      } else {
        fader.connect(sidechainBus);
      }
      fader.connect(revSend);
      revSend.connect(cavernConv);

      directMap[chMeta.key] = {
        input,
        satShaper,
        hpFilter,
        lpFilter,
        panner,
        fader,
        revSend,
      };
    }
    this.directChannels = directMap;

    // Module 04 // Harmonic Drone Bank (4-VCO Analog Swarm + Dual Subs)
    const droneWavefolder = audioCtx.createWaveShaper();
    droneWavefolder.curve = makeWavefoldCurve(0.24);
    const droneBus = audioCtx.createGain();
    droneWavefolder.connect(droneBus);

    this.droneOscs = [];
    this.droneGains = [];
    for (let i = 0; i < 4; i++) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      g.gain.value = 0.18;
      osc.connect(g);
      g.connect(droneWavefolder);
      osc.start();
      this.droneOscs.push(osc);
      this.droneGains.push(g);
    }

    const sub1 = audioCtx.createOscillator();
    sub1.type = 'sine';
    const sub2 = audioCtx.createOscillator();
    sub2.type = 'triangle';
    const subBus = audioCtx.createGain();
    sub1.connect(subBus);
    sub2.connect(subBus);
    sub1.start();
    sub2.start();

    this.subOsc1 = sub1;
    this.subOsc2 = sub2;
    this.subBusGain = subBus;
    this.droneWavefolder = droneWavefolder;
    this.droneBusGain = droneBus;

    // Module 06 // ZDF Analog Filter (Cascaded 24dB Ladder Filter + Tube Drive)
    const zdfDrive = audioCtx.createWaveShaper();
    zdfDrive.curve = makeTubeCurve(0.32);
    const zdf1 = audioCtx.createBiquadFilter();
    zdf1.type = 'lowpass';
    const zdf2 = audioCtx.createBiquadFilter();
    zdf2.type = 'lowpass';
    const zdfBus = audioCtx.createGain();

    droneBus.connect(zdfDrive);
    zdfDrive.connect(zdf1);
    zdf1.connect(zdf2);
    zdf2.connect(zdfBus);

    this.zdfDriveShaper = zdfDrive;
    this.zdfFilter1 = zdf1;
    this.zdfFilter2 = zdf2;
    this.zdfBusGain = zdfBus;

    // Route Drone, Sub & ZDF Filter to Direct Output Console
    droneBus.connect(directMap.drone.input);
    subBus.connect(directMap.subOsc.input);
    zdfBus.connect(directMap.zdfFilt.input);

    // Module 09 // Wavefold & Lo-Fi FX
    const foldShaper = audioCtx.createWaveShaper();
    foldShaper.curve = makeWavefoldCurve(0.35);
    const foldFilt = audioCtx.createBiquadFilter();
    foldFilt.type = 'lowpass';
    const foldBus = audioCtx.createGain();
    zdfBus.connect(foldShaper);
    foldShaper.connect(foldFilt);
    foldFilt.connect(foldBus);
    foldBus.connect(directMap.foldFx.input);

    this.foldFxShaper = foldShaper;
    this.foldFxFilter = foldFilt;
    this.foldFxBusGain = foldBus;

    // Module 10 // Dub Tape Delay
    const dly = audioCtx.createDelay(2.5);
    const dlyDamp = audioCtx.createBiquadFilter();
    dlyDamp.type = 'lowpass';
    const dlyFb = audioCtx.createGain();
    const dlyWet = audioCtx.createGain();

    zdfBus.connect(dly);
    foldBus.connect(dly);
    dly.connect(dlyDamp);
    dlyDamp.connect(dlyFb);
    dlyFb.connect(dly);
    dlyDamp.connect(dlyWet);
    dlyWet.connect(directMap.tapeDly.input);

    this.tapeDelayNode = dly;
    this.tapeDelayDamp = dlyDamp;
    this.tapeDelayFeedback = dlyFb;
    this.tapeDelayWet = dlyWet;

    // Module 05 // Textura Noise Lab
    this.rebuildNoiseSource();

    // Module 12 // 5-Engine Biosphere & Weather Synthesis Lab
    this.initBiosphereLab(audioCtx, directMap.biosphere.input);

    this.syncContinuousNodes();
    return audioCtx;
  }

  private rebuildNoiseSource(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.noiseBuffers || !this.directChannels) return;

    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {
        // Ignore
      }
    }

    const src = ctx.createBufferSource();
    src.buffer =
      this.noiseBuffers[this.patchRef.noiseColor] ?? this.noiseBuffers.pink;
    src.loop = true;

    const formant =
      this.noiseFormantFilter ?? ctx.createBiquadFilter();
    formant.type = 'bandpass';
    const nGain = this.noiseBusGain ?? ctx.createGain();

    src.connect(formant);
    if (!this.noiseFormantFilter) {
      formant.connect(nGain);
      nGain.connect(this.directChannels.noiseLab.input);
      if (this.zdfDriveShaper) {
        nGain.connect(this.zdfDriveShaper);
      }
    }
    src.start();

    this.noiseSource = src;
    this.noiseFormantFilter = formant;
    this.noiseBusGain = nGain;
  }

  private initBiosphereLab(ctx: AudioContext, destination: AudioNode): void {
    if (!this.noiseBuffers) return;
    const bioBus = ctx.createGain();
    bioBus.connect(destination);
    this.bioMasterBus = bioBus;

    // 1. Rain Engine (Pink noise highpassed)
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuffers.pink;
    rainSrc.loop = true;
    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 1800;
    const rainGain = ctx.createGain();
    rainSrc.connect(rainHp);
    rainHp.connect(rainGain);
    rainGain.connect(bioBus);
    rainSrc.start();
    this.bioRainGain = rainGain;

    // 2. Flowing Water Engine (Resonant bandpass brook)
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = this.noiseBuffers.brown;
    waterSrc.loop = true;
    const waterFilt = ctx.createBiquadFilter();
    waterFilt.type = 'bandpass';
    waterFilt.frequency.value = 480;
    waterFilt.Q.value = 2.5;
    const waterGain = ctx.createGain();
    waterSrc.connect(waterFilt);
    waterFilt.connect(waterGain);
    waterGain.connect(bioBus);
    waterSrc.start();
    this.bioWaterGain = waterGain;

    // 3. Lapping Shoreline Waves (Swept lowpass pink noise)
    const waveSrc = ctx.createBufferSource();
    waveSrc.buffer = this.noiseBuffers.pink;
    waveSrc.loop = true;
    const waveFilt = ctx.createBiquadFilter();
    waveFilt.type = 'lowpass';
    waveFilt.frequency.value = 360;
    const waveGain = ctx.createGain();
    waveSrc.connect(waveFilt);
    waveFilt.connect(waveGain);
    waveGain.connect(bioBus);
    waveSrc.start();
    this.bioWavesFilter = waveFilt;
    this.bioWavesGain = waveGain;

    // 4. Howling Wind (High-Q resonant bandpass whistle)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffers.white;
    windSrc.loop = true;
    const windFilt = ctx.createBiquadFilter();
    windFilt.type = 'bandpass';
    windFilt.frequency.value = 620;
    windFilt.Q.value = 9.5;
    const windGain = ctx.createGain();
    windSrc.connect(windFilt);
    windFilt.connect(windGain);
    windGain.connect(bioBus);
    windSrc.start();
    this.bioWindFilter = windFilt;
    this.bioWindGain = windGain;
  }

  public syncContinuousNodes(): void {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const p = this.patchRef;
    const prm = p.params;

    // Global Harsh / Soft Silk Mastering Character
    const isSilk = p.timbreMode === 'soft';
    if (this.silkMasterFilter) {
      this.silkMasterFilter.frequency.setTargetAtTime(
        isSilk ? 3100 : 16500,
        now,
        0.04
      );
    }
    if (this.masterTapeSaturator) {
      this.masterTapeSaturator.curve = makeTubeCurve(isSilk ? 0.22 : 0.65);
    }
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.isPlaying ? p.masterVol : 0.0001,
        now,
        0.03
      );
    }
    if (this.cavernReverbReturn) {
      this.cavernReverbReturn.gain.setTargetAtTime(
        (prm.mixer?.cavernRev ?? 0.5) * 0.65,
        now,
        0.04
      );
    }

    // Module 04 // Harmonic Drone Bank Voicing Ratios
    const baseFreq = prm.drone?.baseFreq ?? 55;
    const detuneCents = prm.drone?.driftDetune ?? 14;
    const ratios =
      p.chordType === 'fifth'
        ? [1, 1.4983, 2, 2.9966]
        : p.chordType === 'min7'
          ? [1, 1.1892, 1.4983, 1.7818]
          : p.chordType === 'min9'
            ? [1, 1.1892, 1.4983, 2.2449]
            : [1, 1.002, 0.998, 2];

    for (let i = 0; i < this.droneOscs.length; i++) {
      const osc = this.droneOscs[i];
      osc.frequency.setTargetAtTime(baseFreq * ratios[i], now, 0.04);
      const spread = (i - 1.5) * detuneCents;
      osc.detune.setTargetAtTime(spread, now, 0.04);
    }
    if (this.subOsc1 && this.subOsc2 && this.subBusGain) {
      this.subOsc1.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);
      this.subOsc2.frequency.setTargetAtTime(baseFreq * 0.25, now, 0.04);
      this.subBusGain.gain.setTargetAtTime(
        (prm.drone?.subLevel ?? 0.7) * 0.4,
        now,
        0.04
      );
    }
    if (this.droneWavefolder && this.droneBusGain) {
      const foldAmt = (prm.drone?.waveFold ?? 0.24) * (isSilk ? 0.5 : 1.0);
      this.droneWavefolder.curve = makeWavefoldCurve(foldAmt);
      this.droneBusGain.gain.setTargetAtTime(
        (prm.drone?.swarmLevel ?? 0.75) * (prm.mixer?.ch1Drone ?? 0.78) * 0.45,
        now,
        0.04
      );
    }

    // Module 05 // Textura Noise Lab
    if (this.noiseFormantFilter && this.noiseBusGain) {
      this.noiseFormantFilter.frequency.setTargetAtTime(
        prm.noise?.formant ?? 920,
        now,
        0.04
      );
      this.noiseFormantFilter.Q.setTargetAtTime(
        prm.noise?.resonance ?? 3.4,
        now,
        0.04
      );
      this.noiseBusGain.gain.setTargetAtTime(
        (prm.noise?.noiseLevel ?? 0.36) * 0.4,
        now,
        0.04
      );
    }

    // Module 06 // ZDF Analog Filter
    if (this.zdfFilter1 && this.zdfFilter2 && this.zdfBusGain) {
      const fMode =
        p.filterType === 'bandpass'
          ? 'bandpass'
          : p.filterType === 'notch'
            ? 'notch'
            : 'lowpass';
      this.zdfFilter1.type = fMode;
      this.zdfFilter2.type = fMode;
      const cut = prm.filter?.cutoff ?? 1450;
      const res = (prm.filter?.resonance ?? 3.2) * (isSilk ? 0.65 : 1.0);
      this.zdfFilter1.frequency.setTargetAtTime(cut, now, 0.03);
      this.zdfFilter2.frequency.setTargetAtTime(
        p.filterType === 'lp24' ? cut : Math.min(18000, cut * 2.5),
        now,
        0.03
      );
      this.zdfFilter1.Q.setTargetAtTime(res, now, 0.03);
      this.zdfBusGain.gain.setTargetAtTime(
        prm.filter?.filtLevel ?? 0.82,
        now,
        0.03
      );
    }

    // Module 09 // Wavefold & Lo-Fi FX
    if (this.foldFxShaper && this.foldFxFilter && this.foldFxBusGain) {
      this.foldFxShaper.curve = makeWavefoldCurve(prm.fx?.wavefold ?? 0.35);
      this.foldFxFilter.frequency.setTargetAtTime(
        prm.fx?.toneFilt ?? 2800,
        now,
        0.03
      );
      this.foldFxFilter.Q.setTargetAtTime(prm.fx?.filtRes ?? 2.1, now, 0.03);
      this.foldFxBusGain.gain.setTargetAtTime(
        (prm.fx?.fxMix ?? 0.4) * (prm.mixer?.ch3Aux ?? 0.54) * 0.5,
        now,
        0.03
      );
    }

    // Module 10 // Dub Tape Delay
    if (
      this.tapeDelayNode &&
      this.tapeDelayDamp &&
      this.tapeDelayFeedback &&
      this.tapeDelayWet
    ) {
      this.tapeDelayNode.delayTime.setTargetAtTime(
        Math.min(2.0, Math.max(0.05, prm.delay?.tapeTime ?? 0.42)),
        now,
        0.04
      );
      this.tapeDelayDamp.frequency.setTargetAtTime(
        prm.delay?.tapeDamp ?? 2400,
        now,
        0.04
      );
      this.tapeDelayFeedback.gain.setTargetAtTime(
        Math.min(0.92, prm.delay?.feedback ?? 0.68),
        now,
        0.04
      );
      this.tapeDelayWet.gain.setTargetAtTime(
        (prm.delay?.echoWet ?? 0.48) * (prm.mixer?.ch4Echo ?? 0.62),
        now,
        0.04
      );
    }

    // Module 12 // Biosphere Lab Levels
    if (
      this.bioRainGain &&
      this.bioWaterGain &&
      this.bioWavesGain &&
      this.bioWindGain
    ) {
      this.bioRainGain.gain.setTargetAtTime(
        (prm.biosphere?.rainLvl ?? 0.35) * 0.22,
        now,
        0.05
      );
      this.bioWaterGain.gain.setTargetAtTime(
        (prm.biosphere?.waterFlow ?? 0.28) * 0.25,
        now,
        0.05
      );
      this.bioWavesGain.gain.setTargetAtTime(
        (prm.biosphere?.wavesLvl ?? 0.45) * 0.26,
        now,
        0.05
      );
      this.bioWindGain.gain.setTargetAtTime(
        (prm.biosphere?.windGust ?? 0.32) * 0.18,
        now,
        0.05
      );
    }

    // 10-Channel Direct Output Console & 4-Stage FX Racks
    if (this.directChannels) {
      const anySolo = Object.values(p.outputMixer).some((ch) => ch.solo);
      for (const chMeta of DIRECT_OUTPUT_CHANNELS) {
        const cfg = p.outputMixer[chMeta.key];
        const nodes = this.directChannels[chMeta.key];
        if (!cfg || !nodes) continue;

        const audible = anySolo ? cfg.solo : !cfg.mute;
        nodes.fader.gain.setTargetAtTime(
          audible ? cfg.level : 0.0,
          now,
          0.02
        );
        nodes.panner.pan.setTargetAtTime(cfg.pan, now, 0.02);
        nodes.revSend.gain.setTargetAtTime(
          audible && !cfg.fxBypass ? cfg.fx.revSend * 0.5 : 0.0,
          now,
          0.02
        );

        if (cfg.fxBypass) {
          nodes.hpFilter.frequency.setTargetAtTime(20, now, 0.02);
          nodes.lpFilter.frequency.setTargetAtTime(18000, now, 0.02);
          nodes.lpFilter.Q.setTargetAtTime(0.7, now, 0.02);
        } else {
          nodes.hpFilter.frequency.setTargetAtTime(cfg.fx.hpFreq, now, 0.02);
          nodes.lpFilter.frequency.setTargetAtTime(cfg.fx.lpFreq, now, 0.02);
          nodes.lpFilter.Q.setTargetAtTime(cfg.fx.filtRes, now, 0.02);
        }
      }
    }
  }

  public async start(): Promise<void> {
    const ctx = this.ensureInitialized();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Handled on subsequent user gesture
      }
    }
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentGlobalStep = 0;
    this.euclidStepCounter = 0;
    this.nextStepTime = ctx.currentTime + 0.03;
    this.syncContinuousNodes();

    // 30ms Sample-Accurate Lookahead Clock
    this.schedulerTimer = window.setInterval(() => this.schedulerTick(), 30);

    // 45ms Continuous LFO, Chaos, Vinyl Dust & Biosphere Modulation Loop
    this.modLoopTimer = window.setInterval(() => this.modulationTick(), 45);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.modLoopTimer !== null) {
      window.clearInterval(this.modLoopTimer);
      this.modLoopTimer = null;
    }
    this.syncContinuousNodes();
  }

  private schedulerTick(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.isPlaying) return;

    const lookaheadSec = 0.12;
    if (this.nextStepTime < ctx.currentTime - 0.1) {
      this.nextStepTime = ctx.currentTime + 0.02;
    }

    while (this.nextStepTime < ctx.currentTime + lookaheadSec) {
      this.scheduleBeatStep(this.currentGlobalStep, this.nextStepTime);
      this.advanceMasterStep();
    }
  }

  private advanceMasterStep(): void {
    const p = this.patchRef;
    const bank = p.xoxPatterns[p.activePattern];
    const totalSteps = (bank?.barCount ?? 2) * 16;
    const stepSec = 60 / Math.max(30, p.bpm) / 4;

    this.nextStepTime += stepSec;
    this.currentGlobalStep++;

    if (this.currentGlobalStep >= totalSteps) {
      this.currentGlobalStep = 0;

      // Bar-quantized pattern switch or CHAIN (A->B->C->D) advance
      if (this.queuedPatternId) {
        p.activePattern = this.queuedPatternId;
        this.queuedPatternId = null;
      } else if (p.patternChainEnabled) {
        const order: PatternBankId[] = ['A', 'B', 'C', 'D'];
        const curIdx = order.indexOf(p.activePattern);
        p.activePattern = order[(curIdx + 1) % order.length];
      }
    }
  }

  private isPatched(fromId: string, toId: string): boolean {
    return this.patchRef.cables.some(
      (c) => c.from === fromId && c.to === toId
    );
  }

  private scheduleBeatStep(globalStep: number, time: number): void {
    const p = this.patchRef;
    const bank = p.xoxPatterns[p.activePattern];
    if (!bank) return;

    const trackSteps: [number, number, number, number] = [0, 0, 0, 0];
    const voiceKeys: BeatVoiceKey[] = ['kick', 'rim', 'hat', 'tom'];
    const xoxTrigOuts = ['xox:trig1', 'xox:trig2', 'xox:trig3', 'xox:trig4'];
    const beatTrigIns = [
      'beats:kickIn',
      'beats:rimIn',
      'beats:hatIn',
      'beats:tomIn',
    ];

    let anyBeatStepFired = false;

    for (let t = 0; t < 4; t++) {
      const polyLen = Math.max(4, Math.min(16, bank.trackLengths[t] || 16));
      const barIdx = Math.floor(globalStep / 16);
      const stepInBar = (globalStep % 16) % polyLen;
      const absIdx = barIdx * 16 + stepInBar;
      trackSteps[t] = absIdx;

      const active = bank.steps[t]?.[absIdx] === 1 && !p.xoxMuted[t];
      if (!active) continue;

      anyBeatStepFired = true;

      // Trigger Module 02 Analog Beat Synth if normalled LNK is ON or patched via cable
      if (
        p.xoxNormLink[t] ||
        this.isPatched(xoxTrigOuts[t], beatTrigIns[t])
      ) {
        this.triggerBeatSynthVoice(voiceKeys[t], time);
      }

      // Check if this X0X track is patched into Vactrol Sub-Pulse (`pulse:trigIn`)
      if (this.isPatched(xoxTrigOuts[t], 'pulse:trigIn')) {
        this.triggerVactrolPing(time);
      }

      // Check if this X0X track is patched into LFO Hard Phase Reset (`mod:lfoResetIn`)
      if (this.isPatched(xoxTrigOuts[t], 'mod:lfoResetIn')) {
        this.lfo1Phase = 0;
        this.lfo2Phase = 0;
      }

      // Check if this X0X track is patched into S&H Trigger (`mod:shTrigIn`)
      if (this.isPatched(xoxTrigOuts[t], 'mod:shTrigIn')) {
        this.advanceSampleAndHold();
      }
    }

    // `xox:barTrig` fires on Step 0 of Bar 1
    if (globalStep === 0) {
      if (this.isPatched('xox:barTrig', 'mod:lfoResetIn')) {
        this.lfo1Phase = 0;
        this.lfo2Phase = 0;
      }
      if (this.isPatched('xox:barTrig', 'clock:resetIn')) {
        this.euclidStepCounter = 0;
      }
    }

    // Module 03 // Euclidean & Time Divider advancement (`INT BPM` vs `EXT STEP`)
    const shouldAdvanceEuclid = p.clockExtStepMode
      ? (anyBeatStepFired && this.isPatched('xox:stepClk', 'clock:stepIn')) ||
        xoxTrigOuts.some(
          (out, i) =>
            bank.steps[i]?.[trackSteps[i]] === 1 &&
            this.isPatched(out, 'clock:stepIn')
        )
      : true;

    if (shouldAdvanceEuclid) {
      const stepsA = Math.round(p.params.euclid?.stepsA ?? 16);
      const hitsA = Math.round(p.params.euclid?.hitsA ?? 5);
      const hitsB = Math.round(p.params.euclid?.hitsB ?? 3);

      const eIdx = this.euclidStepCounter % stepsA;
      const patA = computeEuclideanSteps(stepsA, hitsA, 0);
      const patB = computeEuclideanSteps(stepsA, hitsB, 2);

      if (patA[eIdx] && this.isPatched('clock:euclidA', 'pulse:trigIn')) {
        this.triggerVactrolPing(time);
      }
      if (patB[eIdx] && this.isPatched('clock:euclidB', 'bio:thndrTrg')) {
        this.triggerThunderStrike(time);
      }
      this.euclidStepCounter++;
    }

    // Default internal S&H clock if no cable is patched into `mod:shTrigIn`
    const hasShCable = p.cables.some((c) => c.to === 'mod:shTrigIn');
    if (!hasShCable && globalStep % 2 === 0) {
      this.advanceSampleAndHold();
    }
  }

  private advanceSampleAndHold(): void {
    this.shTarget = Math.random() * 2 - 1;
    const stepDelta = (Math.random() - 0.5) * 0.45;
    this.chaosState = Math.max(-1, Math.min(1, this.chaosState + stepDelta));
  }

  private modulationTick(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.isPlaying) return;
    const now = ctx.currentTime;
    const p = this.patchRef;
    const dt = 0.045;

    const lfo1Hz = p.params.mod?.lfo1Hz ?? 0.18;
    const lfo2Hz = p.params.mod?.lfo2Hz ?? 0.65;
    const slew = p.params.mod?.chaosSlew ?? 0.45;

    this.lfo1Phase = (this.lfo1Phase + lfo1Hz * dt) % 1.0;
    this.lfo2Phase = (this.lfo2Phase + lfo2Hz * dt) % 1.0;

    const lfo1Val = Math.sin(this.lfo1Phase * Math.PI * 2);
    const lfo2Val = 1 - 4 * Math.abs(Math.round(this.lfo2Phase - 0.25) - (this.lfo2Phase - 0.25));
    this.shCurrent += (this.shTarget - this.shCurrent) * (1 - slew * 0.85);
    this.beatEnvValue *= 0.82;

    // Apply Mod Matrix & CV Patch Cables to ZDF Filter Cutoff
    if (this.zdfFilter1) {
      let cutOffset = 0;
      for (const slot of p.matrixSlots) {
        if (!slot.enabled) continue;
        const srcVal =
          slot.source === 'lfo1'
            ? lfo1Val
            : slot.source === 'lfo2'
              ? lfo2Val
              : slot.source === 'chaos'
                ? this.chaosState
                : this.shCurrent;
        if (slot.dest === 'filter.cutoff') {
          cutOffset += srcVal * slot.depth * 1800;
        }
      }
      const baseCut = p.params.filter?.cutoff ?? 1450;
      this.zdfFilter1.frequency.setTargetAtTime(
        Math.min(14000, Math.max(40, baseCut + cutOffset)),
        now,
        0.04
      );
    }

    // Biosphere Lapping Waves & Wind Gust organic modulation
    if (this.bioWavesFilter && this.bioWindFilter) {
      const tideSpeed = p.params.biosphere?.tideSpeed ?? 0.22;
      const waveSweep = 220 + (Math.sin(now * tideSpeed * 2) * 0.5 + 0.5) * 650;
      this.bioWavesFilter.frequency.setTargetAtTime(waveSweep, now, 0.05);

      const windSweep = 420 + (lfo1Val * 0.5 + 0.5) * 580;
      this.bioWindFilter.frequency.setTargetAtTime(windSweep, now, 0.05);
    }

    // Stochastic Vinyl Dust Crackle impulses
    const dustProb = (p.params.noise?.vinylDust ?? 0.4) * 0.35;
    if (Math.random() < dustProb) {
      this.triggerVinylDustImpulse(now);
    }

    // Stochastic Raindrop pings
    const rainProb = (p.params.biosphere?.rainLvl ?? 0.35) * 0.45;
    if (Math.random() < rainProb) {
      this.triggerRaindropPing(now);
    }

    const bank = p.xoxPatterns[p.activePattern];
    const polyLens = bank?.trackLengths ?? [16, 16, 16, 16];
    const barIdx = Math.floor(this.currentGlobalStep / 16);
    const xoxTrackSteps: [number, number, number, number] = [
      barIdx * 16 + ((this.currentGlobalStep % 16) % polyLens[0]),
      barIdx * 16 + ((this.currentGlobalStep % 16) % polyLens[1]),
      barIdx * 16 + ((this.currentGlobalStep % 16) % polyLens[2]),
      barIdx * 16 + ((this.currentGlobalStep % 16) % polyLens[3]),
    ];

    const telemetry: Aether8Telemetry = {
      globalStep: this.currentGlobalStep,
      xoxTrackSteps,
      euclidStep:
        this.euclidStepCounter %
        Math.max(1, Math.round(p.params.euclid?.stepsA ?? 16)),
      lfo1Val,
      lfo2Val,
      chaosVal: this.chaosState,
      shVal: this.shCurrent,
      beatEnvFollower: this.beatEnvValue,
      activePattern: p.activePattern,
    };

    for (const listener of this.telemetryListeners) {
      listener(telemetry);
    }
  }

  /**
   * Module 02 // Analog Beat Synth (4 Independent Full-Synth Percussion Voices)
   */
  public triggerBeatSynthVoice(voiceKey: BeatVoiceKey, time?: number): void {
    const ctx = this.ensureInitialized();
    if (!this.directChannels) return;
    const t = time ?? ctx.currentTime;
    const cfg = this.patchRef.beatVoices[voiceKey];
    if (!cfg) return;

    const osc = ctx.createOscillator();
    osc.type = cfg.wave;

    const startFreq = cfg.freq * (1 + cfg.pEnvAmt * 3.8);
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(24, cfg.freq),
      t + Math.max(0.008, cfg.pEnvDec)
    );

    const filter = ctx.createBiquadFilter();
    filter.type = cfg.filterType;
    const envTargetCut = Math.min(
      16000,
      Math.max(40, cfg.cutoff + cfg.filtEnv)
    );
    filter.frequency.setValueAtTime(envTargetCut, t);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, cfg.cutoff),
      t + Math.max(0.02, cfg.decay)
    );
    filter.Q.setValueAtTime(cfg.res, t);

    const vca = ctx.createGain();
    const totalDur = cfg.attack + cfg.decay + cfg.release;
    const beatMixLvl = this.patchRef.params.mixer?.ch2Beat ?? 0.72;
    const peak = 0.55 * beatMixLvl;

    vca.gain.setValueAtTime(0.0001, t);
    vca.gain.linearRampToValueAtTime(peak, t + Math.max(0.001, cfg.attack));
    vca.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peak * cfg.sustain + 0.0001),
      t + cfg.attack + cfg.decay
    );
    vca.gain.exponentialRampToValueAtTime(0.0001, t + totalDur);

    osc.connect(filter);

    if (cfg.noiseMix > 0.02 && this.noiseBuffers) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffers.white;
      const nGain = ctx.createGain();
      nGain.gain.value = cfg.noiseMix * 0.6;
      nSrc.connect(nGain);
      nGain.connect(filter);
      nSrc.start(t);
      nSrc.stop(t + totalDur + 0.02);
    }

    filter.connect(vca);
    if (voiceKey === 'kick') {
      vca.connect(this.directChannels.kick.input);
    }
    vca.connect(this.directChannels.beatBus.input);

    osc.start(t);
    osc.stop(t + totalDur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      vca.disconnect();
    };

    // Update Beat Envelope Follower & trigger `BEAT PUMP` sidechain ducking
    this.beatEnvValue = 1.0;
    if (voiceKey === 'kick' && this.masterSidechainGain) {
      const pumpDepth = this.patchRef.params.mixer?.beatPump ?? 0.48;
      if (pumpDepth > 0.02) {
        this.masterSidechainGain.gain.cancelScheduledValues(t);
        this.masterSidechainGain.gain.setValueAtTime(1.0, t);
        this.masterSidechainGain.gain.linearRampToValueAtTime(
          1.0 - pumpDepth * 0.78,
          t + 0.012
        );
        this.masterSidechainGain.gain.exponentialRampToValueAtTime(
          1.0,
          t + 0.28
        );
      }
    }
  }

  /**
   * Module 07 // Vactrol Sub-Pulse (Organic Low-Pass-Gate Bass Pulse)
   */
  public triggerVactrolPing(time?: number): void {
    const ctx = this.ensureInitialized();
    if (!this.directChannels) return;
    const t = time ?? ctx.currentTime;
    const prm = this.patchRef.params.pulse;

    const pitch = prm?.subPitch ?? 46;
    const punch = prm?.punchDrop ?? 0.65;
    const dec = Math.max(0.08, (prm?.vactrolDec ?? 0.68) * 1.4);
    const warmth = prm?.lpgWarmth ?? 0.72;
    const level = prm?.pulseLevel ?? 0.7;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch * (1 + punch * 1.8), t);
    osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.065);

    const lpg = ctx.createBiquadFilter();
    lpg.type = 'lowpass';
    lpg.frequency.setValueAtTime(120 + warmth * 950, t);
    lpg.frequency.exponentialRampToValueAtTime(42, t + dec);

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0.0001, t);
    vca.gain.linearRampToValueAtTime(0.6 * level, t + 0.008);
    vca.gain.exponentialRampToValueAtTime(0.0001, t + dec);

    osc.connect(lpg);
    lpg.connect(vca);
    vca.connect(this.directChannels.subPulse.input);

    osc.start(t);
    osc.stop(t + dec + 0.02);
    osc.onended = () => {
      osc.disconnect();
      lpg.disconnect();
      vca.disconnect();
    };
  }

  /**
   * Module 12 // Thunder & Lightning Strike Generator
   */
  public triggerThunderStrike(time?: number): void {
    const ctx = this.ensureInitialized();
    if (!this.noiseBuffers || !this.bioMasterBus) return;
    const t = time ?? ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffers.brown;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.exponentialRampToValueAtTime(65, t + 2.4);

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0.0001, t);
    vca.gain.linearRampToValueAtTime(0.75, t + 0.04);
    vca.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);

    src.connect(lp);
    lp.connect(vca);
    vca.connect(this.bioMasterBus);
    if (this.cavernReverbSend) {
      vca.connect(this.cavernReverbSend);
    }

    src.start(t);
    src.stop(t + 2.55);
    src.onended = () => {
      src.disconnect();
      lp.disconnect();
      vca.disconnect();
    };
  }

  private triggerVinylDustImpulse(t: number): void {
    if (!this.audioCtx || !this.directChannels) return;
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800 + Math.random() * 3200, t);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);
    osc.connect(g);
    g.connect(this.directChannels.noiseLab.input);
    osc.start(t);
    osc.stop(t + 0.007);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private triggerRaindropPing(t: number): void {
    if (!this.audioCtx || !this.bioMasterBus) return;
    const size = this.patchRef.params.biosphere?.rainSize ?? 0.5;
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400 + (1 - size) * 2200 + Math.random() * 900, t);
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    osc.connect(g);
    g.connect(this.bioMasterBus);
    osc.start(t);
    osc.stop(t + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  public async dispose(): Promise<void> {
    this.stop();
    this.telemetryListeners.clear();
    const ctx = this.audioCtx;
    const gain = this.masterGain;
    this.audioCtx = null;
    this.masterGain = null;
    await audioGuard.gracefulCloseContext(ctx, gain, 20);
  }
}
