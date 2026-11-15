import { audioGuard } from '../../../core/audioGuard';
import { quantizeScaleFrequency, RILEY_SCALES } from '../constants/scales';
import type {
  BiosphereModRate,
  BiosphereState,
  EvolveState,
  RileySongPatch,
  TapeDelayState,
  VoiceFxRack,
  VoiceFxSyncRate,
  VoiceTrack,
} from '../types';

export interface PlayheadStepUpdate {
  steps: number[]; // Current active step index (0..15) per voice (0..7)
  bar: number;
  tick: number;
}

export type PlayheadListener = (update: PlayheadStepUpdate) => void;
export type EvolveMutationListener = (
  mutatedPatch: RileySongPatch,
  evolveTelemetry: Pick<EvolveState, 'currentBar' | 'lastEvent'>
) => void;

interface ActiveVoiceHandle {
  ampGain: GainNode;
  stopAt: (time: number) => void;
}

/**
 * Calculates note duration in seconds for tempo-synced FX and LFOs
 */
function getSyncDurationSec(rate: VoiceFxSyncRate | BiosphereModRate, bpm: number): number {
  const quarterSec = 60 / Math.max(20, bpm);
  switch (rate) {
    case '1/16':
      return quarterSec * 0.25;
    case '1/8':
      return quarterSec * 0.5;
    case '1/4':
      return quarterSec * 1.0;
    case '1/2':
      return quarterSec * 2.0;
    case '1-bar':
      return quarterSec * 4.0;
    case '2-bar':
      return quarterSec * 8.0;
    case '4-bar':
      return quarterSec * 16.0;
    case '8-bar':
      return quarterSec * 32.0;
    default:
      return quarterSec;
  }
}

function makeWestCoastWavefoldCurve(foldAmount: number): Float32Array<ArrayBuffer> {
  const n = 512;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const drive = 1 + Math.max(0, Math.min(1, foldAmount)) * 5.2;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    // West Coast Buchla-style sinusoidal folder blended with linear dry path
    const folded = Math.sin(x * drive * Math.PI * 0.5);
    curve[i] = x * (1 - foldAmount * 0.75) + folded * (foldAmount * 0.75);
  }
  return curve;
}

function createNoiseBuffer(
  ctx: BaseAudioContext,
  type: 'white' | 'pink' | 'brown',
  durationSec: number = 3.0
): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * durationSec);
  const buffer = ctx.createBuffer(1, length, sr);
  const data = buffer.getChannelData(0);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let lastBrown = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      data[i] = white * 0.55;
    } else if (type === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 0.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    } else {
      lastBrown = (lastBrown + 0.02 * white) / 1.02;
      data[i] = lastBrown * 2.8;
    }
  }
  return buffer;
}

export class RileyModularEngine {
  private ctx: AudioContext | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  // Runaway-Proof Stereo Time Lag Accumulator (Magnetic Tape Loop)
  private tapeInL: GainNode | null = null;
  private tapeInR: GainNode | null = null;
  private delayL: DelayNode | null = null;
  private delayR: DelayNode | null = null;
  private lpL: BiquadFilterNode | null = null;
  private lpR: BiquadFilterNode | null = null;
  private fbL: GainNode | null = null;
  private fbR: GainNode | null = null;
  private crossLR: GainNode | null = null;
  private crossRL: GainNode | null = null;
  private tapeWetMix: GainNode | null = null;
  private wowLfoL: OscillatorNode | null = null;
  private wowLfoR: OscillatorNode | null = null;
  private wowGainL: GainNode | null = null;
  private wowGainR: GainNode | null = null;

  // Global Eco Mode shared Organ Vibrato LFO bus
  private globalOrganVibLfo: OscillatorNode | null = null;
  private globalOrganVibGain: GainNode | null = null;

  // Noise Buffers
  private noiseBuffers: Record<'white' | 'pink' | 'brown', AudioBuffer> | null =
    null;

  // Biosphere Soundscape Nodes
  private bioMasterGain: GainNode | null = null;
  private bioRainSource: AudioBufferSourceNode | null = null;
  private bioRainFilter: BiquadFilterNode | null = null;
  private bioRainGain: GainNode | null = null;
  private bioStreamSource: AudioBufferSourceNode | null = null;
  private bioStreamGain: GainNode | null = null;
  private bioWavesSource: AudioBufferSourceNode | null = null;
  private bioWavesGain: GainNode | null = null;
  private bioWindSource: AudioBufferSourceNode | null = null;
  private bioWindGain: GainNode | null = null;
  private bioRainLfo: OscillatorNode | null = null;
  private bioStreamLfo: OscillatorNode | null = null;
  private bioWindLfo: OscillatorNode | null = null;
  private bioWavesLfo: OscillatorNode | null = null;
  private currentBioEcoMode: boolean | null = null;

  // State & Polymetric Scheduler
  private patch: RileySongPatch;
  private ecoMode: boolean;
  private isPlaying: boolean = false;
  private schedulerIntervalId: number | null = null;
  private pendingTimeouts: Set<number> = new Set();
  private nextNoteTime: number = 0;
  private masterTick: number = 0;
  private currentBarCounter: number = 0;
  private cursors: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private accumulators: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private visualSteps: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private lastEcoUiNotifyMs: number = 0;

  // Active Voice Allocator for Eco Mode Strict Monophonic Retrigger & 8-Voice Cap
  private activeVoicesByTrack: Map<number, ActiveVoiceHandle> = new Map();

  // Listeners
  private playheadListeners: Set<PlayheadListener> = new Set();
  private evolveListeners: Set<EvolveMutationListener> = new Set();

  constructor(initialPatch: RileySongPatch) {
    this.patch = initialPatch;
    this.ecoMode = Boolean(initialPatch.ecoMode);
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
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

  public onPlayhead(listener: PlayheadListener): () => void {
    this.playheadListeners.add(listener);
    return () => {
      this.playheadListeners.delete(listener);
    };
  }

  public onEvolveMutation(listener: EvolveMutationListener): () => void {
    this.evolveListeners.add(listener);
    return () => {
      this.evolveListeners.delete(listener);
    };
  }

  public setPatch(nextPatch: RileySongPatch): void {
    const prevEco = this.ecoMode;
    this.patch = nextPatch;
    this.ecoMode = Boolean(nextPatch.ecoMode);

    if (this.ctx && this.ctx.state !== 'closed') {
      if (prevEco !== this.ecoMode) {
        this.rebuildBiosphereGraph();
        if (this.isPlaying) {
          this.restartSchedulerLoop();
        }
      }
      this.syncTapeDelayParams(nextPatch.delay);
      this.syncBiosphereParams(nextPatch.biosphere);
      if (this.masterGain) {
        const targetMaster = nextPatch.masterVol ?? 0.85;
        this.masterGain.gain.setTargetAtTime(
          targetMaster,
          this.ctx.currentTime,
          0.025
        );
      }
    }
  }

  public setEcoMode(enabled: boolean): void {
    if (this.ecoMode === enabled) return;
    this.ecoMode = enabled;
    this.patch = { ...this.patch, ecoMode: enabled };
    if (this.ctx && this.ctx.state !== 'closed') {
      this.syncTapeDelayParams(this.patch.delay);
      this.rebuildBiosphereGraph();
      this.syncBiosphereParams(this.patch.biosphere);
      if (this.isPlaying) {
        this.restartSchedulerLoop();
      }
    }
  }

  /**
   * Lazily initializes the dedicated private AudioContext inside a user gesture handler
   * (`RUN`, `TEST THUNDER`, `PREVIEW`, or `REC .WAV`).
   */
  public ensureContext(): AudioContext {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    const isMobileOrCrOS =
      typeof navigator !== 'undefined' &&
      /Android|CrOS|Chromebook|tablet/i.test(navigator.userAgent);

    let ctx: AudioContext;
    try {
      ctx = new AudioCtx({
        latencyHint: isMobileOrCrOS || this.ecoMode ? 'playback' : 'interactive',
      });
    } catch {
      ctx = new AudioCtx();
    }

    this.ctx = ctx;

    // Section 5.1: Master Bus & Brickwall Limiter
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-6, ctx.currentTime);
    limiter.knee.setValueAtTime(10, ctx.currentTime);
    limiter.ratio.setValueAtTime(12, ctx.currentTime);
    limiter.attack.setValueAtTime(0.003, ctx.currentTime);
    limiter.release.setValueAtTime(0.16, ctx.currentTime);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.patch.masterVol ?? 0.85, ctx.currentTime);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    limiter.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    this.masterLimiter = limiter;
    this.masterGain = masterGain;
    this.masterAnalyser = analyser;

    // Register with studio audioGuard so top-bar telemetry and outer tab switches are tracked
    audioGuard.registerContext('riley-rack', ctx, masterGain);

    // Pre-build shared noise buffers
    this.noiseBuffers = {
      white: createNoiseBuffer(ctx, 'white', 3.0),
      pink: createNoiseBuffer(ctx, 'pink', 3.0),
      brown: createNoiseBuffer(ctx, 'brown', 3.0),
    };

    // Global vibrato LFO bus for Eco Mode Organ voices
    const orgVibLfo = ctx.createOscillator();
    orgVibLfo.type = 'sine';
    orgVibLfo.frequency.setValueAtTime(5.4, ctx.currentTime);
    const orgVibGain = ctx.createGain();
    orgVibGain.gain.setValueAtTime(7.5, ctx.currentTime); // +/- 7.5 cents
    orgVibLfo.connect(orgVibGain);
    orgVibLfo.start();
    this.globalOrganVibLfo = orgVibLfo;
    this.globalOrganVibGain = orgVibGain;

    // Build Stereo Time Lag Accumulator (Magnetic Tape Loop)
    this.buildTapeDelayGraph(ctx, limiter);

    // Build Biosphere Soundscape
    this.rebuildBiosphereGraph();
    this.syncBiosphereParams(this.patch.biosphere);

    return ctx;
  }

  /**
   * Section 5.2: Runaway-Proof Stereo Time Lag Accumulator (Magnetic Tape Loop)
   */
  private buildTapeDelayGraph(
    ctx: AudioContext,
    destination: AudioNode
  ): void {
    const tapeInL = ctx.createGain();
    const tapeInR = ctx.createGain();

    const delayL = ctx.createDelay(4.0);
    const delayR = ctx.createDelay(4.0);

    // 120 Hz 2-pole High-Pass Filters prevent sub-bass mud accumulation
    const hpL = ctx.createBiquadFilter();
    hpL.type = 'highpass';
    hpL.frequency.setValueAtTime(120, ctx.currentTime);
    hpL.Q.setValueAtTime(0.707, ctx.currentTime);

    const hpR = ctx.createBiquadFilter();
    hpR.type = 'highpass';
    hpR.frequency.setValueAtTime(120, ctx.currentTime);
    hpR.Q.setValueAtTime(0.707, ctx.currentTime);

    // 400 Hz – 2200 Hz 2-pole Low-Pass Filters roll off highs like aging oxide tape
    const lpL = ctx.createBiquadFilter();
    lpL.type = 'lowpass';
    lpL.Q.setValueAtTime(0.707, ctx.currentTime);

    const lpR = ctx.createBiquadFilter();
    lpR.type = 'lowpass';
    lpR.Q.setValueAtTime(0.707, ctx.currentTime);

    const fbL = ctx.createGain();
    const fbR = ctx.createGain();
    const crossLR = ctx.createGain();
    const crossRL = ctx.createGain();

    const wetPanL = ctx.createStereoPanner();
    wetPanL.pan.setValueAtTime(-0.78, ctx.currentTime);
    const wetPanR = ctx.createStereoPanner();
    wetPanR.pan.setValueAtTime(0.78, ctx.currentTime);

    const tapeWetMix = ctx.createGain();

    // Forward delay paths
    tapeInL.connect(delayL);
    delayL.connect(hpL);
    hpL.connect(lpL);

    tapeInR.connect(delayR);
    delayR.connect(hpR);
    hpR.connect(lpR);

    // Feedback & Cross-feed matrix (Zero WaveShapers inside feedback loop)
    lpL.connect(fbL);
    fbL.connect(delayL);
    lpL.connect(crossLR);
    crossLR.connect(delayR);

    lpR.connect(fbR);
    fbR.connect(delayR);
    lpR.connect(crossRL);
    crossRL.connect(delayL);

    // Stereo wet output
    lpL.connect(wetPanL);
    lpR.connect(wetPanR);
    wetPanL.connect(tapeWetMix);
    wetPanR.connect(tapeWetMix);
    tapeWetMix.connect(destination);

    // Dual subtle sine LFOs (0.40 Hz at ±1.6 ms on Left; 0.34 Hz at ±2.0 ms on Right)
    const wowLfoL = ctx.createOscillator();
    wowLfoL.type = 'sine';
    wowLfoL.frequency.setValueAtTime(0.4, ctx.currentTime);
    const wowGainL = ctx.createGain();
    wowLfoL.connect(wowGainL);
    wowGainL.connect(delayL.delayTime);
    wowLfoL.start();

    const wowLfoR = ctx.createOscillator();
    wowLfoR.type = 'sine';
    wowLfoR.frequency.setValueAtTime(0.34, ctx.currentTime);
    const wowGainR = ctx.createGain();
    wowLfoR.connect(wowGainR);
    wowGainR.connect(delayR.delayTime);
    wowLfoR.start();

    this.tapeInL = tapeInL;
    this.tapeInR = tapeInR;
    this.delayL = delayL;
    this.delayR = delayR;
    this.lpL = lpL;
    this.lpR = lpR;
    this.fbL = fbL;
    this.fbR = fbR;
    this.crossLR = crossLR;
    this.crossRL = crossRL;
    this.tapeWetMix = tapeWetMix;
    this.wowLfoL = wowLfoL;
    this.wowLfoR = wowLfoR;
    this.wowGainL = wowGainL;
    this.wowGainR = wowGainR;

    this.syncTapeDelayParams(this.patch.delay);
  }

  private syncTapeDelayParams(delay: TapeDelayState): void {
    if (
      !this.ctx ||
      !this.delayL ||
      !this.delayR ||
      !this.lpL ||
      !this.lpR ||
      !this.fbL ||
      !this.fbR ||
      !this.crossLR ||
      !this.crossRL ||
      !this.tapeWetMix ||
      !this.wowGainL ||
      !this.wowGainR
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    const dL = Math.max(0.12, Math.min(1.4, delay.delayLMs / 1000));
    const dR = Math.max(0.15, Math.min(1.6, delay.delayRMs / 1000));
    const tone = Math.max(400, Math.min(2200, delay.toneHz));

    // Strict Unity-Attenuated Feedback Matrix (Section 5.2.2)
    const clampedFb = Math.max(0, Math.min(0.64, delay.feedback));
    const clampedCross = Math.max(0, Math.min(0.14, delay.crossFeed));
    const rawTotal = clampedFb + clampedCross;
    const scale = rawTotal > 0.78 ? 0.78 / rawTotal : 1.0;
    const safeFb = Math.min(0.64, clampedFb * scale);
    const safeCross = Math.min(0.14, clampedCross * scale);

    this.delayL.delayTime.setTargetAtTime(dL, now, 0.04);
    this.delayR.delayTime.setTargetAtTime(dR, now, 0.04);
    this.lpL.frequency.setTargetAtTime(tone, now, 0.04);
    this.lpR.frequency.setTargetAtTime(tone, now, 0.04);

    this.fbL.gain.setTargetAtTime(safeFb, now, 0.03);
    this.fbR.gain.setTargetAtTime(safeFb, now, 0.03);
    this.crossLR.gain.setTargetAtTime(safeCross, now, 0.03);
    this.crossRL.gain.setTargetAtTime(safeCross, now, 0.03);
    this.tapeWetMix.gain.setTargetAtTime(
      Math.max(0, Math.min(0.7, delay.mix)),
      now,
      0.03
    );

    // Section 6 Eco Mode: Disconnect/zero wow/flutter LFOs in Eco Mode for static delay reads
    this.wowGainL.gain.setTargetAtTime(this.ecoMode ? 0 : 0.0016, now, 0.03);
    this.wowGainR.gain.setTargetAtTime(this.ecoMode ? 0 : 0.002, now, 0.03);
  }

  /**
   * Section 5.2.4: Instant Buffer Purge (`CLEAR TAPE`)
   */
  public clearTape(): void {
    if (
      !this.ctx ||
      !this.fbL ||
      !this.fbR ||
      !this.crossLR ||
      !this.crossRL ||
      !this.tapeWetMix
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    this.fbL.gain.cancelScheduledValues(now);
    this.fbR.gain.cancelScheduledValues(now);
    this.crossLR.gain.cancelScheduledValues(now);
    this.crossRL.gain.cancelScheduledValues(now);
    this.tapeWetMix.gain.cancelScheduledValues(now);

    this.fbL.gain.setValueAtTime(0, now);
    this.fbR.gain.setValueAtTime(0, now);
    this.crossLR.gain.setValueAtTime(0, now);
    this.crossRL.gain.setValueAtTime(0, now);
    this.tapeWetMix.gain.setValueAtTime(0, now);

    const delayMaxMs = Math.max(
      this.patch.delay.delayLMs,
      this.patch.delay.delayRMs
    );
    const restoreTimeout = window.setTimeout(() => {
      this.pendingTimeouts.delete(restoreTimeout);
      this.syncTapeDelayParams(this.patch.delay);
    }, delayMaxMs + 50);
    this.pendingTimeouts.add(restoreTimeout);
  }

  /**
   * Section 6 & 10.4: Biosphere Soundscape (4 loops in Standard Mode, 2 merged loops in Eco Mode)
   */
  private rebuildBiosphereGraph(): void {
    if (!this.ctx || !this.masterLimiter || !this.noiseBuffers) return;
    if (this.currentBioEcoMode === this.ecoMode && this.bioMasterGain) return;

    this.teardownBiosphereGraph();
    this.currentBioEcoMode = this.ecoMode;

    const ctx = this.ctx;
    const bioMaster = ctx.createGain();
    bioMaster.gain.setValueAtTime(0, ctx.currentTime);
    bioMaster.connect(this.masterLimiter);
    this.bioMasterGain = bioMaster;

    // Filters & Gains for Rain, Stream, Waves, Wind
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(3400, ctx.currentTime);
    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0, ctx.currentTime);

    const streamFilter = ctx.createBiquadFilter();
    streamFilter.type = 'bandpass';
    streamFilter.frequency.setValueAtTime(720, ctx.currentTime);
    streamFilter.Q.setValueAtTime(1.4, ctx.currentTime);
    const streamGain = ctx.createGain();
    streamGain.gain.setValueAtTime(0, ctx.currentTime);

    const wavesFilter = ctx.createBiquadFilter();
    wavesFilter.type = 'lowpass';
    wavesFilter.frequency.setValueAtTime(420, ctx.currentTime);
    const wavesGain = ctx.createGain();
    wavesGain.gain.setValueAtTime(0, ctx.currentTime);

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(520, ctx.currentTime);
    windFilter.Q.setValueAtTime(4.2, ctx.currentTime);
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0, ctx.currentTime);

    rainFilter.connect(rainGain);
    rainGain.connect(bioMaster);

    streamFilter.connect(streamGain);
    streamGain.connect(bioMaster);

    wavesFilter.connect(wavesGain);
    wavesGain.connect(bioMaster);

    windFilter.connect(windGain);
    windGain.connect(bioMaster);

    if (this.ecoMode) {
      // Eco Mode: 2 shared noise loops (Rain/Wind merged + Waves/Stream merged)
      const sharedPink = ctx.createBufferSource();
      sharedPink.buffer = this.noiseBuffers.pink;
      sharedPink.loop = true;
      sharedPink.connect(rainFilter);
      sharedPink.connect(windFilter);
      sharedPink.start();
      this.bioRainSource = sharedPink;

      const sharedBrown = ctx.createBufferSource();
      sharedBrown.buffer = this.noiseBuffers.brown;
      sharedBrown.loop = true;
      sharedBrown.connect(wavesFilter);
      sharedBrown.connect(streamFilter);
      sharedBrown.start();
      this.bioWavesSource = sharedBrown;
    } else {
      // Standard Mode: 4 independent continuous filtered noise loops + wind/waves LFOs
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffers.white;
      rainSrc.loop = true;
      rainSrc.connect(rainFilter);
      rainSrc.start();
      this.bioRainSource = rainSrc;

      const streamSrc = ctx.createBufferSource();
      streamSrc.buffer = this.noiseBuffers.pink;
      streamSrc.loop = true;
      streamSrc.connect(streamFilter);
      streamSrc.start();
      this.bioStreamSource = streamSrc;

      const wavesSrc = ctx.createBufferSource();
      wavesSrc.buffer = this.noiseBuffers.brown;
      wavesSrc.loop = true;
      wavesSrc.connect(wavesFilter);
      wavesSrc.start();
      this.bioWavesSource = wavesSrc;

      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffers.pink;
      windSrc.loop = true;
      windSrc.connect(windFilter);
      windSrc.start();
      this.bioWindSource = windSrc;

      const windLfo = ctx.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.setValueAtTime(0.16, ctx.currentTime);
      const windLfoGain = ctx.createGain();
      windLfoGain.gain.setValueAtTime(260, ctx.currentTime);
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);
      windLfo.start();
      this.bioWindLfo = windLfo;

      const wavesLfo = ctx.createOscillator();
      wavesLfo.type = 'sine';
      wavesLfo.frequency.setValueAtTime(0.11, ctx.currentTime);
      const wavesLfoGain = ctx.createGain();
      wavesLfoGain.gain.setValueAtTime(180, ctx.currentTime);
      wavesLfo.connect(wavesLfoGain);
      wavesLfoGain.connect(wavesFilter.frequency);
      wavesLfo.start();
      this.bioWavesLfo = wavesLfo;

      const rainLfo = ctx.createOscillator();
      rainLfo.type = 'sine';
      rainLfo.frequency.setValueAtTime(0.2, ctx.currentTime);
      const rainLfoGain = ctx.createGain();
      rainLfoGain.gain.setValueAtTime(400, ctx.currentTime);
      rainLfo.connect(rainLfoGain);
      rainLfoGain.connect(rainFilter.frequency);
      rainLfo.start();
      this.bioRainLfo = rainLfo;

      const streamLfo = ctx.createOscillator();
      streamLfo.type = 'triangle';
      streamLfo.frequency.setValueAtTime(0.25, ctx.currentTime);
      const streamLfoGain = ctx.createGain();
      streamLfoGain.gain.setValueAtTime(220, ctx.currentTime);
      streamLfo.connect(streamLfoGain);
      streamLfoGain.connect(streamFilter.frequency);
      streamLfo.start();
      this.bioStreamLfo = streamLfo;
    }

    this.bioRainFilter = rainFilter;
    this.bioRainGain = rainGain;
    this.bioStreamGain = streamGain;
    this.bioWavesGain = wavesGain;
    this.bioWindGain = windGain;
  }

  private teardownBiosphereGraph(): void {
    const sources = [
      this.bioRainSource,
      this.bioStreamSource,
      this.bioWavesSource,
      this.bioWindSource,
      this.bioWindLfo,
      this.bioWavesLfo,
      this.bioRainLfo,
      this.bioStreamLfo,
    ];
    for (const s of sources) {
      if (s) {
        try {
          s.stop();
          s.disconnect();
        } catch {
          // Ignore
        }
      }
    }
    if (this.bioMasterGain) {
      try {
        this.bioMasterGain.disconnect();
      } catch {
        // Ignore
      }
    }
    this.bioRainSource = null;
    this.bioStreamSource = null;
    this.bioWavesSource = null;
    this.bioWindSource = null;
    this.bioWindLfo = null;
    this.bioWavesLfo = null;
    this.bioRainLfo = null;
    this.bioStreamLfo = null;
    this.bioMasterGain = null;
  }

  private syncBiosphereParams(bio: BiosphereState): void {
    if (
      !this.ctx ||
      !this.bioMasterGain ||
      !this.bioRainFilter ||
      !this.bioRainGain ||
      !this.bioStreamGain ||
      !this.bioWavesGain ||
      !this.bioWindGain
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    // Calibrated master level (up to 2.0 headroom)
    const master = bio.enabled ? Math.max(0, Math.min(2.0, bio.masterVol)) * 0.42 : 0;
    this.bioMasterGain.gain.setTargetAtTime(master, now, 0.06);

    // Rain: calibrated preamp (default ~1.0) * user volume
    const rainPreamp = bio.rainPreamp ?? 1.0;
    const rainLevel = bio.rain * rainPreamp * 0.32;
    this.bioRainGain.gain.setTargetAtTime(rainLevel, now, 0.06);

    // Rain Heavy toggle: false = 3400Hz soft, true = 2100Hz heavy
    this.bioRainFilter.frequency.setTargetAtTime(
      bio.rainHeavy ? 2100 : 3400,
      now,
      0.08
    );

    // Stream: calibrated preamp * user volume
    const streamPreamp = bio.streamPreamp ?? 1.2;
    const streamLevel = bio.stream * streamPreamp * 0.35;
    this.bioStreamGain.gain.setTargetAtTime(streamLevel, now, 0.06);

    // Waves: calibrated preamp * user volume
    const wavesPreamp = bio.wavesPreamp ?? 1.1;
    const wavesLevel = bio.waves * wavesPreamp * 0.38;
    if (bio.waveSyncBars === 0 || !bio.clockSync || !this.isPlaying) {
      this.bioWavesGain.gain.setTargetAtTime(wavesLevel, now, 0.08);
    }

    // Wind: calibrated preamp * user volume
    const windPreamp = bio.windPreamp ?? 1.0;
    const windLevel = bio.wind * windPreamp * 0.35;
    this.bioWindGain.gain.setTargetAtTime(windLevel, now, 0.06);

    // Sync Biosphere LFO Modulation Rates & Depths
    if (!this.ecoMode) {
      const bpm = this.patch.bpm;
      if (this.bioRainLfo && bio.rainModRate) {
        const rateHz = bio.rainModRate === 'free'
          ? 0.2
          : 1 / Math.max(0.1, getSyncDurationSec(bio.rainModRate, bpm));
        this.bioRainLfo.frequency.setTargetAtTime(rateHz, now, 0.1);
      }
      if (this.bioStreamLfo && bio.streamModRate) {
        const rateHz = bio.streamModRate === 'free'
          ? 0.25
          : 1 / Math.max(0.1, getSyncDurationSec(bio.streamModRate, bpm));
        this.bioStreamLfo.frequency.setTargetAtTime(rateHz, now, 0.1);
      }
      if (this.bioWavesLfo && bio.wavesModRate) {
        const rateHz = bio.wavesModRate === 'free'
          ? 0.11
          : 1 / Math.max(0.1, getSyncDurationSec(bio.wavesModRate, bpm));
        this.bioWavesLfo.frequency.setTargetAtTime(rateHz, now, 0.1);
      }
      if (this.bioWindLfo && bio.windModRate) {
        const rateHz = bio.windModRate === 'free'
          ? 0.16
          : 1 / Math.max(0.1, getSyncDurationSec(bio.windModRate, bpm));
        this.bioWindLfo.frequency.setTargetAtTime(rateHz, now, 0.1);
      }
    }
  }

  /**
   * Triggers a procedural distant thunderclap (`TEST THUNDER`, probabilistic bar trigger, or patchable trigger in).
   */
  public triggerThunder(scheduledTime?: number): void {
    const ctx = this.ensureContext();
    if (!this.masterLimiter || !this.noiseBuffers) return;

    const t = scheduledTime ?? ctx.currentTime + 0.01;
    const bio = this.patch.biosphere;
    const bioPreamp = bio.thunderPreamp ?? 1.2;
    const bioVol = bio.enabled
      ? Math.max(0.25, Math.min(2.0, bio.masterVol)) * bioPreamp
      : 0.55 * bioPreamp;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffers.brown;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280, t);
    lp.frequency.exponentialRampToValueAtTime(68, t + 2.4);
    lp.Q.setValueAtTime(2.6, t);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(bioVol * 0.85, t + 0.06);
    env.gain.exponentialRampToValueAtTime(bioVol * 0.45, t + 0.35);
    env.gain.linearRampToValueAtTime(bioVol * 0.65, t + 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime((Math.random() - 0.5) * 0.7, t);

    src.connect(lp);
    lp.connect(env);
    env.connect(panner);
    panner.connect(this.masterLimiter);

    if (this.tapeInL && this.tapeInR) {
      const send = ctx.createGain();
      send.gain.setValueAtTime(0.18, t);
      env.connect(send);
      send.connect(this.tapeInL);
      send.connect(this.tapeInR);
    }

    src.start(t);
    src.stop(t + 2.9);
  }

  /**
   * Triggers a polyrhythmic procedural sine/bandpass rain droplet (Standard Mode only).
   */
  private triggerRainDroplet(time: number): void {
    if (this.ecoMode || !this.ctx || !this.bioMasterGain) return;
    const bio = this.patch.biosphere;
    if (!bio.enabled || !bio.rainDropletSync || bio.rain < 0.05) return;

    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = 950 + Math.random() * 1450;
    osc.frequency.setValueAtTime(baseFreq, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, time + 0.045);

    const env = ctx.createGain();
    const peak = Math.min(0.16, bio.rain * 0.18);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime((Math.random() - 0.5) * 1.4, time);

    osc.connect(env);
    env.connect(pan);
    pan.connect(this.bioMasterGain);

    osc.start(time);
    osc.stop(time + 0.065);
  }

  /**
   * Starts the sample-accurate polymetric lookahead scheduler.
   */
  public async start(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Will resume on next gesture
      }
    }
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.masterTick = 0;
    this.currentBarCounter = 0;
    this.cursors = [0, 0, 0, 0, 0, 0, 0, 0];
    this.accumulators = [0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999];
    this.visualSteps = [0, 0, 0, 0, 0, 0, 0, 0];
    this.nextNoteTime = ctx.currentTime + 0.03;

    this.syncBiosphereParams(this.patch.biosphere);
    this.restartSchedulerLoop();
  }

  private restartSchedulerLoop(): void {
    if (this.schedulerIntervalId !== null) {
      window.clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    if (!this.isPlaying) return;

    // Section 4: 25ms interval (35ms in Eco Mode)
    const intervalMs = this.ecoMode ? 35 : 25;
    this.schedulerIntervalId = window.setInterval(() => {
      this.schedulerTick();
    }, intervalMs);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.schedulerIntervalId !== null) {
      window.clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }

    for (const tid of this.pendingTimeouts) {
      window.clearTimeout(tid);
    }
    this.pendingTimeouts.clear();

    // Ramp down any active voices
    if (this.ctx && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      for (const handle of this.activeVoicesByTrack.values()) {
        handle.stopAt(now);
      }
    }
    this.activeVoicesByTrack.clear();
  }

  /**
   * Section 4: Sample-Accurate Polymetric Lookahead Scheduler
   */
  private schedulerTick(): void {
    if (!this.ctx || !this.isPlaying) return;

    const lookaheadSec = this.ecoMode ? 0.18 : 0.1;
    if (this.nextNoteTime < this.ctx.currentTime - 0.12) {
      this.nextNoteTime = this.ctx.currentTime + 0.02;
    }

    while (this.nextNoteTime < this.ctx.currentTime + lookaheadSec) {
      this.scheduleMasterSixteenth(this.masterTick, this.nextNoteTime);
      const sixteenthSec = 60 / Math.max(60, Math.min(180, this.patch.bpm)) / 4;
      this.nextNoteTime += sixteenthSec;
      this.masterTick++;
    }
  }

  private scheduleMasterSixteenth(tick: number, time: number): void {
    if (!this.ctx) return;

    const voices = this.patch.voices;
    const cables = this.patch.cables;
    const anySolo = voices.some((v) => v.solo);
    const sixteenthSec = 60 / Math.max(60, Math.min(180, this.patch.bpm)) / 4;

    const stepSnapshot = [...this.visualSteps];

    for (let idx = 0; idx < 8; idx++) {
      const v = voices[idx];
      if (!v) continue;

      // Section 4.1: Check if cables contains a patch terminating at `v${idx + 1}-clk`
      const clkTarget = `v${idx + 1}-clk`;
      const clkCable = cables.find((c) => c.to === clkTarget);
      let speed = v.speed;
      if (clkCable) {
        if (clkCable.from === 'clk-div-1') speed = v.speed;
        else if (clkCable.from === 'clk-div-2') speed = 0.5;
        else if (clkCable.from === 'clk-div-3') speed = 1 / 3;
        else if (clkCable.from === 'clk-div-5') speed = 0.2;
        else if (clkCable.from === 'clk-div-7') speed = 1 / 7;
      }

      this.accumulators[idx] += speed;
      if (this.accumulators[idx] >= 0.999) {
        this.accumulators[idx] -= 1;
        const activeLen = Math.max(3, Math.min(16, v.length));
        const stepPos = this.cursors[idx] % activeLen;
        this.cursors[idx] = (stepPos + 1) % activeLen;
        stepSnapshot[idx] = stepPos;
        this.visualSteps[idx] = stepPos;

        const cell = v.steps[stepPos];
        const isAudible = anySolo ? v.solo : !v.mute;

        if (cell && cell.active && isAudible && v.volume > 0.005) {
          const freq = quantizeScaleFrequency(
            this.patch.scaleId,
            this.patch.rootMidi,
            cell.degree,
            v.octave,
            this.patch.justIntonation
          );
          const gateDur = Math.max(0.04, (sixteenthSec / Math.max(0.2, speed)) * 0.82);
          this.triggerVoiceNote(v, freq, time, gateDur);

          // Check if sequencer trigger jack `v${v.index + 1}-seq-trig` is patched to `bio-thunder-trig`
          const seqTrigId = `v${v.index + 1}-seq-trig`;
          const patchesToThunder = cables.some(
            (c) => c.from === seqTrigId && c.to === 'bio-thunder-trig'
          );
          if (patchesToThunder && this.patch.biosphere.enabled) {
            // Evaluates probability on sequencer trigger
            const prob = this.patch.biosphere.thunderProb ?? 0.15;
            if (Math.random() <= Math.max(0.05, prob)) {
              this.triggerThunder(time + 0.05);
            }
          }
        }
      }
    }

    // Biosphere Polyrhythmic Rain Droplets on tick % 3 === 0 || tick % 5 === 0
    if (
      this.patch.biosphere.enabled &&
      this.patch.biosphere.clockSync &&
      this.patch.biosphere.rainDropletSync &&
      (tick % 3 === 0 || tick % 5 === 0)
    ) {
      this.triggerRainDroplet(time);
    }

    // Biosphere Bar-Locked Ocean Wave Swell Envelope (4 or 8 bars)
    const bio = this.patch.biosphere;
    if (
      bio.enabled &&
      bio.clockSync &&
      bio.waveSyncBars > 0 &&
      this.bioWavesGain &&
      bio.waves > 0.01
    ) {
      const cycleTicks = bio.waveSyncBars * 16;
      const phase = (tick % cycleTicks) / cycleTicks;
      const swell = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
      this.bioWavesGain.gain.setTargetAtTime(
        bio.waves * 0.48 * swell,
        time,
        0.08
      );
    }

    // Bar Boundary (every 16 sixteenth notes): Evolve Engine & Probabilistic Thunder
    const isBarStart = tick > 0 && tick % 16 === 0;
    let barNum = this.currentBarCounter;
    if (isBarStart) {
      this.currentBarCounter++;
      barNum = this.currentBarCounter;

      // Probabilistic Distant Thunder check once every 2 bars
      if (
        bio.enabled &&
        bio.thunderProb > 0.02 &&
        barNum % 2 === 0 &&
        Math.random() < bio.thunderProb * 0.45
      ) {
        this.triggerThunder(time + 0.1);
      }
    }

    // Section 4 UI Playhead Sync via tracked setTimeout (with 250ms batching in Eco Mode)
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    const tid = window.setTimeout(() => {
      this.pendingTimeouts.delete(tid);
      if (!this.isPlaying) return;

      if (isBarStart) {
        this.handleBarBoundaryOnMainThread(barNum);
      }

      const nowMs = performance.now();
      if (this.ecoMode && nowMs - this.lastEcoUiNotifyMs < 250 && !isBarStart) {
        return;
      }
      this.lastEcoUiNotifyMs = nowMs;

      for (const listener of this.playheadListeners) {
        listener({
          steps: stepSnapshot,
          bar: (barNum % Math.max(1, this.patch.evolve.intervalBars)) + 1,
          tick,
        });
      }
    }, delayMs);

    this.pendingTimeouts.add(tid);
  }

  /**
   * Generative Evolve Engine Bar Counter & Mutation Trigger
   */
  private handleBarBoundaryOnMainThread(barCount: number): void {
    const ev = this.patch.evolve;
    const cycleBar = (barCount % ev.intervalBars) + 1;

    if (ev.enabled && barCount > 0 && barCount % ev.intervalBars === 0) {
      this.applyGenerativeMutation();
    } else {
      for (const listener of this.evolveListeners) {
        listener(this.patch, {
          currentBar: cycleBar,
          lastEvent: '',
        });
      }
    }
  }

  /**
   * Manual (`MORPH NOW`) or Bar-Triggered Generative Evolve Mutation
   */
  public triggerManualMorph(): {
    nextPatch: RileySongPatch;
    eventLog: string;
  } {
    return this.applyGenerativeMutation();
  }

  private applyGenerativeMutation(): {
    nextPatch: RileySongPatch;
    eventLog: string;
  } {
    const ev = this.patch.evolve;
    const nextVoices = this.patch.voices.map((v) => ({
      ...v,
      steps: v.steps.map((s) => ({ ...s })),
      riley: { ...v.riley },
      synth: {
        ...v.synth,
        ampEnv: { ...v.synth.ampEnv },
        filterEnv: { ...v.synth.filterEnv },
      },
    }));

    const scale = RILEY_SCALES[this.patch.scaleId] ?? RILEY_SCALES.mixolydian;
    const scaleLen = scale.semitones.length;
    const logs: string[] = [];

    const vIdx = Math.floor(Math.random() * 8);
    const targetVoice = nextVoices[vIdx];

    if (ev.pitchDrift) {
      const stepIdx = Math.floor(Math.random() * targetVoice.length);
      const cell = targetVoice.steps[stepIdx];
      if (cell) {
        const delta = Math.random() < 0.5 ? 1 : -1;
        cell.degree = ((cell.degree + delta) % scaleLen + scaleLen) % scaleLen;
        cell.active = Math.random() < 0.82 ? true : cell.active;
        logs.push(
          `V${vIdx + 1} Step ${stepIdx + 1} → Deg ${scale.degreeLabels[cell.degree] ?? cell.degree + 1}`
        );
      }
    }

    if (ev.rhythmLength) {
      const rIdx = Math.floor(Math.random() * 8);
      const rv = nextVoices[rIdx];
      const deltaLen = Math.random() < 0.5 ? 1 : -1;
      const nextLen = Math.max(3, Math.min(16, rv.length + deltaLen));
      rv.length = nextLen;
      logs.push(`V${rIdx + 1} Loop → ${nextLen}st`);
    }

    if (ev.timbreMorph) {
      const tIdx = Math.floor(Math.random() * 8);
      const tv = nextVoices[tIdx];
      if (tv.mode === 'ORIGINAL_RILEY') {
        const nextCut = Math.round(
          Math.max(280, Math.min(6500, tv.riley.cutoff * (0.85 + Math.random() * 0.32)))
        );
        tv.riley.cutoff = nextCut;
        tv.riley.brightness = Number(
          Math.max(0.1, Math.min(0.95, tv.riley.brightness + (Math.random() - 0.5) * 0.18)).toFixed(2)
        );
        logs.push(`V${tIdx + 1} Riley Cutoff → ${nextCut}Hz`);
      } else {
        const nextCut = Math.round(
          Math.max(240, Math.min(8200, tv.synth.cutoff * (0.85 + Math.random() * 0.32)))
        );
        tv.synth.cutoff = nextCut;
        tv.synth.wavefold = Number(
          Math.max(0.0, Math.min(0.85, tv.synth.wavefold + (Math.random() - 0.5) * 0.14)).toFixed(2)
        );
        logs.push(`V${tIdx + 1} Synth Cutoff → ${nextCut}Hz`);
      }
    }

    const eventLog =
      logs.length > 0 ? logs.join(' • ') : `V${vIdx + 1} Phase Drift`;

    const nextPatch: RileySongPatch = {
      ...this.patch,
      voices: nextVoices,
    };
    this.patch = nextPatch;

    for (const listener of this.evolveListeners) {
      listener(nextPatch, {
        currentBar: 1,
        lastEvent: eventLog,
      });
    }

    return { nextPatch, eventLog };
  }

  /**
   * Auditions a single note on the specified voice immediately (for Voice Editor preview).
   */
  public previewVoice(voiceIndex: number, degree: number = 0): void {
    const ctx = this.ensureContext();
    const v = this.patch.voices[voiceIndex];
    if (!v) return;
    const freq = quantizeScaleFrequency(
      this.patch.scaleId,
      this.patch.rootMidi,
      degree,
      v.octave,
      this.patch.justIntonation
    );
    this.triggerVoiceNote(v, freq, ctx.currentTime + 0.01, 0.32);
  }

  /**
   * Synthesizes a single note on `voice` at hardware `time`, enforcing Eco Mode optimizations.
   */
  private triggerVoiceNote(
    voice: VoiceTrack,
    freq: number,
    time: number,
    gateDur: number
  ): void {
    if (!this.ctx || !this.masterLimiter) return;
    const ctx = this.ctx;

    // Section 6.1 Eco Mode: Strict Per-Voice Monophonic Retrigger + Global 8-Voice Cap
    if (this.ecoMode) {
      const prev = this.activeVoicesByTrack.get(voice.index);
      if (prev) {
        prev.stopAt(time);
        this.activeVoicesByTrack.delete(voice.index);
      }
    }

    // Channel Panner & Output Routing
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(
      Math.max(-1, Math.min(1, voice.pan)),
      time
    );
    panner.connect(this.masterLimiter);

    // Check if `v${voice.index + 1}-cv` is patched into `tla-in-l` or `tla-in-r`
    const cvSourceId = `v${voice.index + 1}-cv`;
    const patchedToTapeL = this.patch.cables.some(
      (c) => c.from === cvSourceId && c.to === 'tla-in-l'
    );
    const patchedToTapeR = this.patch.cables.some(
      (c) => c.from === cvSourceId && c.to === 'tla-in-r'
    );

    const effectiveSend = Math.max(
      0,
      Math.min(
        0.7,
        voice.tapeSend + (patchedToTapeL || patchedToTapeR ? 0.22 : 0)
      )
    );

    if (effectiveSend > 0.01 && this.tapeInL && this.tapeInR) {
      const sendGainL = ctx.createGain();
      const sendGainR = ctx.createGain();
      const leftWeight = patchedToTapeL
        ? 1.0
        : Math.max(0.25, 1 - Math.max(0, voice.pan));
      const rightWeight = patchedToTapeR
        ? 1.0
        : Math.max(0.25, 1 + Math.min(0, voice.pan));

      sendGainL.gain.setValueAtTime(effectiveSend * leftWeight, time);
      sendGainR.gain.setValueAtTime(effectiveSend * rightWeight, time);
      panner.connect(sendGainL);
      panner.connect(sendGainR);
      sendGainL.connect(this.tapeInL);
      sendGainR.connect(this.tapeInR);

      // Subtle CV modulation of Tape Loop tone filter when patched
      if (patchedToTapeL && this.lpL) {
        const modHz = Math.max(
          400,
          Math.min(2200, this.patch.delay.toneHz + (freq - 260) * 0.45)
        );
        this.lpL.frequency.setTargetAtTime(modHz, time, 0.05);
      }
      if (patchedToTapeR && this.lpR) {
        const modHz = Math.max(
          400,
          Math.min(2200, this.patch.delay.toneHz + (freq - 260) * 0.45)
        );
        this.lpR.frequency.setTargetAtTime(modHz, time, 0.05);
      }
    }

    if (voice.mode === 'ORIGINAL_RILEY') {
      this.synthesizeOriginalRileyVoice(ctx, voice, freq, time, gateDur, panner);
    } else {
      this.synthesizeFullSynthVoice(
        ctx,
        voice,
        freq,
        time,
        gateDur,
        panner
      );
    }
  }

  /**
   * Applies Per-Voice Effects DSP Rack (Echo -> Delay -> Flanger -> Phaser -> Compressor)
   */
  private applyVoiceEffects(
    ctx: AudioContext,
    inputNode: AudioNode,
    destNode: AudioNode,
    fx: VoiceFxRack | undefined,
    bpm: number,
    time: number,
    stopTime: number,
    oscsToStop: AudioScheduledSourceNode[]
  ): void {
    if (!fx) {
      inputNode.connect(destNode);
      return;
    }

    let currentNode: AudioNode = inputNode;

    // 1. ECHO (Filtered slapback / tape-ish echo)
    if (fx.echo && fx.echo.enabled && fx.echo.mix > 0.01) {
      const e = fx.echo;
      const echoDelaySec = e.sync
        ? getSyncDurationSec(e.syncRate, bpm)
        : Math.max(0.02, Math.min(1.0, e.timeMs / 1000));

      const echoSplit = ctx.createGain();
      const echoDelay = ctx.createDelay(1.2);
      echoDelay.delayTime.setValueAtTime(echoDelaySec, time);

      const echoTone = ctx.createBiquadFilter();
      echoTone.type = 'lowpass';
      echoTone.frequency.setValueAtTime(Math.max(300, Math.min(8000, e.toneHz)), time);

      const echoFb = ctx.createGain();
      echoFb.gain.setValueAtTime(Math.max(0, Math.min(0.85, e.feedback)), time);

      const echoWet = ctx.createGain();
      echoWet.gain.setValueAtTime(Math.max(0, Math.min(1, e.mix)), time);

      const echoSum = ctx.createGain();

      currentNode.connect(echoSplit);
      echoSplit.connect(echoSum); // Dry path

      echoSplit.connect(echoDelay);
      echoDelay.connect(echoTone);
      echoTone.connect(echoWet);
      echoWet.connect(echoSum); // Wet path

      echoTone.connect(echoFb);
      echoFb.connect(echoDelay); // Feedback loop

      currentNode = echoSum;
    }

    // 2. DELAY (Crossfed stereo-ish delay)
    if (fx.delay && fx.delay.enabled && fx.delay.mix > 0.01) {
      const d = fx.delay;
      const delaySec = d.sync
        ? getSyncDurationSec(d.syncRate, bpm)
        : Math.max(0.04, Math.min(1.6, d.timeMs / 1000));

      const delaySplit = ctx.createGain();
      const delayNode = ctx.createDelay(2.0);
      delayNode.delayTime.setValueAtTime(delaySec, time);

      const delayFb = ctx.createGain();
      delayFb.gain.setValueAtTime(Math.max(0, Math.min(0.88, d.feedback)), time);

      const delayWet = ctx.createGain();
      delayWet.gain.setValueAtTime(Math.max(0, Math.min(1, d.mix)), time);

      const delaySum = ctx.createGain();

      currentNode.connect(delaySplit);
      delaySplit.connect(delaySum);

      delaySplit.connect(delayNode);
      delayNode.connect(delayWet);
      delayWet.connect(delaySum);

      delayNode.connect(delayFb);
      delayFb.connect(delayNode);

      currentNode = delaySum;
    }

    // 3. FLANGER (Modulated short delay, bypassed in Eco Mode if disabled)
    if (fx.flanger && fx.flanger.enabled && fx.flanger.mix > 0.01 && !this.ecoMode) {
      const fl = fx.flanger;
      const flSplit = ctx.createGain();
      const flDelay = ctx.createDelay(0.04);
      const baseDelay = 0.0035; // 3.5ms
      flDelay.delayTime.setValueAtTime(baseDelay, time);

      const flLfo = ctx.createOscillator();
      flLfo.type = 'sine';
      const lfoRate = fl.sync
        ? 1 / Math.max(0.1, getSyncDurationSec(fl.syncRate, bpm))
        : Math.max(0.05, Math.min(8, fl.rateHz));
      flLfo.frequency.setValueAtTime(lfoRate, time);

      const flLfoGain = ctx.createGain();
      const depthSec = Math.max(0.0005, Math.min(0.008, fl.depthMs / 1000));
      flLfoGain.gain.setValueAtTime(depthSec, time);

      flLfo.connect(flLfoGain);
      flLfoGain.connect(flDelay.delayTime);

      const flFb = ctx.createGain();
      flFb.gain.setValueAtTime(Math.max(-0.85, Math.min(0.85, fl.feedback)), time);

      const flWet = ctx.createGain();
      flWet.gain.setValueAtTime(Math.max(0, Math.min(1, fl.mix)), time);

      const flSum = ctx.createGain();

      currentNode.connect(flSplit);
      flSplit.connect(flSum); // dry

      flSplit.connect(flDelay);
      flDelay.connect(flWet);
      flWet.connect(flSum); // wet

      flDelay.connect(flFb);
      flFb.connect(flDelay); // feedback

      flLfo.start(time);
      flLfo.stop(stopTime + 0.5);
      oscsToStop.push(flLfo);

      currentNode = flSum;
    }

    // 4. PHASER (Cascade of allpass filters modulated by LFO)
    if (fx.phaser && fx.phaser.enabled && fx.phaser.mix > 0.01 && !this.ecoMode) {
      const ph = fx.phaser;
      const phSplit = ctx.createGain();
      const stageCount = ph.stages === 8 ? 8 : 4;
      const allpasses: BiquadFilterNode[] = [];

      for (let i = 0; i < stageCount; i++) {
        const ap = ctx.createBiquadFilter();
        ap.type = 'allpass';
        ap.frequency.setValueAtTime(1000 + i * 200, time);
        allpasses.push(ap);
      }

      for (let i = 0; i < allpasses.length - 1; i++) {
        allpasses[i].connect(allpasses[i + 1]);
      }

      const phLfo = ctx.createOscillator();
      phLfo.type = 'sine';
      const lfoRate = ph.sync
        ? 1 / Math.max(0.1, getSyncDurationSec(ph.syncRate, bpm))
        : Math.max(0.05, Math.min(8, ph.rateHz));
      phLfo.frequency.setValueAtTime(lfoRate, time);

      const phLfoGain = ctx.createGain();
      phLfoGain.gain.setValueAtTime(ph.depth * 800, time);
      phLfo.connect(phLfoGain);

      for (const ap of allpasses) {
        phLfoGain.connect(ap.frequency);
      }

      const phFb = ctx.createGain();
      phFb.gain.setValueAtTime(Math.max(0, Math.min(0.85, ph.feedback)), time);
      allpasses[allpasses.length - 1].connect(phFb);
      phFb.connect(allpasses[0]);

      const phWet = ctx.createGain();
      phWet.gain.setValueAtTime(Math.max(0, Math.min(1, ph.mix)), time);

      const phSum = ctx.createGain();
      currentNode.connect(phSplit);
      phSplit.connect(phSum); // dry

      phSplit.connect(allpasses[0]);
      allpasses[allpasses.length - 1].connect(phWet);
      phWet.connect(phSum); // wet

      phLfo.start(time);
      phLfo.stop(stopTime + 0.5);
      oscsToStop.push(phLfo);

      currentNode = phSum;
    }

    // 5. COMPRESSOR (Dynamics shaping per voice)
    if (fx.compressor && fx.compressor.enabled) {
      const c = fx.compressor;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(Math.max(-48, Math.min(0, c.thresholdDb)), time);
      comp.ratio.setValueAtTime(Math.max(1, Math.min(20, c.ratio)), time);
      comp.attack.setValueAtTime(Math.max(0.001, Math.min(0.1, c.attackSec)), time);
      comp.release.setValueAtTime(Math.max(0.02, Math.min(0.8, c.releaseSec)), time);

      const makeup = ctx.createGain();
      const makeupLinear = Math.pow(10, (c.gainDb ?? 0) / 20);
      makeup.gain.setValueAtTime(makeupLinear, time);

      currentNode.connect(comp);
      comp.connect(makeup);
      currentNode = makeup;
    }

    currentNode.connect(destNode);
  }

  /**
   * Engine 1: ORIGINAL RILEY (`organ` | `pluck` | `pad`) with Section 6 Eco Mode reductions
   */
  private synthesizeOriginalRileyVoice(
    ctx: AudioContext,
    voice: VoiceTrack,
    freq: number,
    time: number,
    gateDur: number,
    destPanner: StereoPannerNode
  ): void {
    const r = voice.riley;
    const atk = Math.max(0.005, Math.min(0.45, r.attack));
    const rel = Math.max(0.06, Math.min(1.4, r.release));
    const stopTime = time + atk + gateDur + rel + 0.04;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(Math.max(0.5, Math.min(12, r.resonance)), time);

    const ampGain = ctx.createGain();
    const peakGain = Math.max(0.001, voice.volume * 0.28);

    const oscsToStop: AudioScheduledSourceNode[] = [];

    if (r.model === 'organ') {
      // Section 6.2: Standard Mode = 5 drawbars (0.5x, 1x, 2x, 3x, 4x) + per-note vibrato LFO
      // Eco Mode = 3 drawbars (1x, 2x, 3x) sharing globalOrganVibGain
      const drawbars = this.ecoMode
        ? [
            { mult: 1, weight: 0.52, type: 'sine' as OscillatorType },
            {
              mult: 2,
              weight: 0.32 * (0.4 + r.brightness * 0.6),
              type: 'triangle' as OscillatorType,
            },
            {
              mult: 3,
              weight: 0.2 * r.brightness,
              type: 'sine' as OscillatorType,
            },
          ]
        : [
            { mult: 0.5, weight: 0.24, type: 'sine' as OscillatorType },
            { mult: 1, weight: 0.45, type: 'triangle' as OscillatorType },
            {
              mult: 2,
              weight: 0.3 * (0.35 + r.brightness * 0.65),
              type: 'sine' as OscillatorType,
            },
            {
              mult: 3,
              weight: 0.18 * r.brightness,
              type: 'sine' as OscillatorType,
            },
            {
              mult: 4,
              weight: 0.12 * r.brightness * r.brightness,
              type: 'sine' as OscillatorType,
            },
          ];

      let noteVibLfo: OscillatorNode | null = null;
      let noteVibGain: GainNode | null = null;
      if (!this.ecoMode) {
        noteVibLfo = ctx.createOscillator();
        noteVibLfo.type = 'sine';
        noteVibLfo.frequency.setValueAtTime(5.5, time);
        noteVibGain = ctx.createGain();
        noteVibGain.gain.setValueAtTime(7.0, time);
        noteVibLfo.connect(noteVibGain);
        noteVibLfo.start(time);
        noteVibLfo.stop(stopTime);
        oscsToStop.push(noteVibLfo);
      }

      for (const db of drawbars) {
        const osc = ctx.createOscillator();
        osc.type = db.type;
        osc.frequency.setValueAtTime(freq * db.mult, time);
        if (this.ecoMode && this.globalOrganVibGain) {
          this.globalOrganVibGain.connect(osc.detune);
        } else if (noteVibGain) {
          noteVibGain.connect(osc.detune);
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(db.weight, time);
        osc.connect(g);
        g.connect(filter);
        osc.start(time);
        osc.stop(stopTime);
        oscsToStop.push(osc);
      }

      const cutHz = Math.max(
        180,
        Math.min(8500, r.cutoff * (0.65 + r.brightness * 0.7))
      );
      filter.frequency.setValueAtTime(cutHz, time);

      ampGain.gain.setValueAtTime(0.0001, time);
      ampGain.gain.linearRampToValueAtTime(peakGain, time + atk);
      ampGain.gain.setValueAtTime(peakGain * 0.88, time + atk + gateDur);
      ampGain.gain.exponentialRampToValueAtTime(
        0.0001,
        time + atk + gateDur + rel
      );
    } else if (r.model === 'pluck') {
      // Buchla Vactrol Low-Pass Gate Pluck
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc1.connect(filter);
      osc1.start(time);
      osc1.stop(stopTime);
      oscsToStop.push(osc1);

      if (!this.ecoMode) {
        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq * 2, time);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(r.brightness * 0.35, time);
        osc2.connect(g2);
        g2.connect(filter);
        osc2.start(time);
        osc2.stop(stopTime);
        oscsToStop.push(osc2);
      }

      const peakCut = Math.max(
        300,
        Math.min(10000, r.cutoff * (1 + r.brightness * 1.6))
      );
      const restCut = Math.max(140, r.cutoff * 0.24);
      filter.frequency.setValueAtTime(restCut, time);
      filter.frequency.exponentialRampToValueAtTime(peakCut, time + atk);
      filter.frequency.exponentialRampToValueAtTime(
        restCut,
        time + atk + rel * 0.85
      );

      ampGain.gain.setValueAtTime(0.0001, time);
      ampGain.gain.linearRampToValueAtTime(peakGain * 1.15, time + atk);
      ampGain.gain.exponentialRampToValueAtTime(
        0.0001,
        time + atk + rel
      );
    } else {
      // Section 6.3: Pad — Standard Mode = Dual detuned oscillators (sawtooth + triangle)
      // Eco Mode = Single triangle oscillator
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc1.detune.setValueAtTime(this.ecoMode ? 0 : -8, time);
      osc1.connect(filter);
      osc1.start(time);
      osc1.stop(stopTime);
      oscsToStop.push(osc1);

      if (!this.ecoMode) {
        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, time);
        osc2.detune.setValueAtTime(8, time);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.42 * (0.4 + r.brightness * 0.6), time);
        osc2.connect(g2);
        g2.connect(filter);
        osc2.start(time);
        osc2.stop(stopTime);
        oscsToStop.push(osc2);
      }

      const cutHz = Math.max(
        180,
        Math.min(8500, r.cutoff * (0.55 + r.brightness * 0.85))
      );
      filter.frequency.setValueAtTime(cutHz * 0.6, time);
      filter.frequency.exponentialRampToValueAtTime(cutHz, time + atk);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(160, cutHz * 0.45),
        time + atk + gateDur + rel
      );

      ampGain.gain.setValueAtTime(0.0001, time);
      ampGain.gain.linearRampToValueAtTime(peakGain * 0.9, time + atk);
      ampGain.gain.setValueAtTime(peakGain * 0.78, time + atk + gateDur);
      ampGain.gain.exponentialRampToValueAtTime(
        0.0001,
        time + atk + gateDur + rel
      );
    }

    filter.connect(ampGain);
    this.applyVoiceEffects(
      ctx,
      ampGain,
      destPanner,
      voice.fx,
      this.patch.bpm,
      time,
      stopTime,
      oscsToStop
    );

    this.registerActiveVoiceHandle(voice.index, ampGain, oscsToStop, stopTime);
  }

  /**
   * Engine 2: FULL SYNTH SUITE with Section 6.4 Eco Mode optimizations
   */
  private synthesizeFullSynthVoice(
    ctx: AudioContext,
    voice: VoiceTrack,
    freq: number,
    time: number,
    gateDur: number,
    destPanner: StereoPannerNode
  ): void {
    const s = voice.synth;
    const ampAtk = Math.max(0.004, Math.min(1.4, s.ampEnv.attack));
    const ampDec = Math.max(0.004, Math.min(1.4, s.ampEnv.decay));
    const ampSus = Math.max(0.005, Math.min(1.0, s.ampEnv.sustain));
    const ampRel = Math.max(0.004, Math.min(1.4, s.ampEnv.release));

    const fltAtk = Math.max(0.004, Math.min(1.4, s.filterEnv.attack));
    const fltDec = Math.max(0.004, Math.min(1.4, s.filterEnv.decay));
    const fltSus = Math.max(0.005, Math.min(1.0, s.filterEnv.sustain));
    const fltRel = Math.max(0.004, Math.min(1.4, s.filterEnv.release));

    const noteOffTime = time + ampAtk + ampDec * 0.5 + gateDur;
    const stopTime = noteOffTime + Math.max(ampRel, fltRel) + 0.05;

    const oscMixBus = ctx.createGain();
    const oscsToStop: AudioScheduledSourceNode[] = [];
    const oscNodes: OscillatorNode[] = [];

    // OSC 1 (in Eco Mode, omit if oscMix >= 0.99)
    const useOsc1 = !this.ecoMode || s.oscMix < 0.99;
    const useOsc2 = !this.ecoMode || s.oscMix > 0.01;

    if (useOsc1) {
      const osc1 = ctx.createOscillator();
      osc1.type = s.osc1Wave;
      const f1 = freq * Math.pow(2, s.osc1Coarse / 12);
      osc1.frequency.setValueAtTime(f1, time);
      osc1.detune.setValueAtTime(s.osc1Detune, time);
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(1 - s.oscMix, time);
      osc1.connect(g1);
      g1.connect(oscMixBus);
      osc1.start(time);
      osc1.stop(stopTime);
      oscsToStop.push(osc1);
      oscNodes.push(osc1);
    }

    if (useOsc2) {
      const osc2 = ctx.createOscillator();
      osc2.type = s.osc2Wave;
      const f2 = freq * Math.pow(2, s.osc2Coarse / 12);
      osc2.frequency.setValueAtTime(f2, time);
      osc2.detune.setValueAtTime(s.osc2Detune, time);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(s.oscMix, time);
      osc2.connect(g2);
      g2.connect(oscMixBus);
      osc2.start(time);
      osc2.stop(stopTime);
      oscsToStop.push(osc2);
      oscNodes.push(osc2);
    }

    // Sub Oscillator (Section 6.4: bypass in Eco Mode if subLevel < 0.02)
    if (!this.ecoMode || s.subLevel >= 0.02) {
      if (s.subLevel > 0.002) {
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        const subMult = s.subOctave === -2 ? 0.25 : 0.5;
        subOsc.frequency.setValueAtTime(freq * subMult, time);
        const subG = ctx.createGain();
        subG.gain.setValueAtTime(s.subLevel * 0.55, time);
        subOsc.connect(subG);
        subG.connect(oscMixBus);
        subOsc.start(time);
        subOsc.stop(stopTime);
        oscsToStop.push(subOsc);
      }
    }

    // Noise Source (Section 6.4: bypass in Eco Mode if noiseLevel < 0.02)
    if ((!this.ecoMode || s.noiseLevel >= 0.02) && s.noiseLevel > 0.002 && this.noiseBuffers) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer =
        s.noiseType === 'pink' ? this.noiseBuffers.pink : this.noiseBuffers.white;
      nSrc.loop = true;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(s.noiseLevel * 0.45, time);
      nSrc.connect(nGain);
      nGain.connect(oscMixBus);
      nSrc.start(time);
      nSrc.stop(stopTime);
      oscsToStop.push(nSrc);
    }

    // West Coast Wavefolder (Section 6.4: oversample '2x' in Standard, 'none' in Eco, bypassed if wavefold <= 0.01)
    let preFilterNode: AudioNode = oscMixBus;
    if (s.wavefold > 0.01) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeWestCoastWavefoldCurve(s.wavefold);
      shaper.oversample = this.ecoMode ? 'none' : '2x';
      oscMixBus.connect(shaper);
      preFilterNode = shaper;
    }

    // Filter Section (LP24, LP12, BP12, HP12)
    const filter1 = ctx.createBiquadFilter();
    if (s.filterMode === 'BP12') filter1.type = 'bandpass';
    else if (s.filterMode === 'HP12') filter1.type = 'highpass';
    else filter1.type = 'lowpass';

    const keyTrackMult = Math.pow(freq / 261.63, s.keyTrack);
    const baseCutoff = Math.max(
      40,
      Math.min(14000, s.cutoff * keyTrackMult)
    );
    const envPeakCutoff = Math.max(
      40,
      Math.min(14000, baseCutoff * Math.pow(2, s.filterEnvDepth * 3.2))
    );
    const envSusCutoff = Math.max(
      40,
      Math.min(
        14000,
        baseCutoff * Math.pow(2, s.filterEnvDepth * 3.2 * fltSus)
      )
    );

    const applyFilterEnv = (fNode: BiquadFilterNode, qFactor: number) => {
      fNode.Q.setValueAtTime(Math.max(0.5, Math.min(16, qFactor)), time);
      fNode.frequency.setValueAtTime(baseCutoff, time);
      fNode.frequency.exponentialRampToValueAtTime(
        envPeakCutoff,
        time + fltAtk
      );
      fNode.frequency.exponentialRampToValueAtTime(
        envSusCutoff,
        time + fltAtk + fltDec
      );
      fNode.frequency.exponentialRampToValueAtTime(
        baseCutoff,
        noteOffTime + fltRel
      );
    };

    let postFilterNode: AudioNode = filter1;
    if (s.filterMode === 'LP24' && !this.ecoMode) {
      const filter2 = ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      applyFilterEnv(filter1, s.resonance * 0.65);
      applyFilterEnv(filter2, s.resonance * 0.65);
      preFilterNode.connect(filter1);
      filter1.connect(filter2);
      postFilterNode = filter2;
    } else {
      applyFilterEnv(filter1, s.resonance);
      preFilterNode.connect(filter1);
    }

    // Per-Note LFO (Section 6.4: omit LFO oscillator when lfoDepth < 0.02 in Eco Mode)
    if (!this.ecoMode || s.lfoDepth >= 0.02) {
      if (s.lfoDepth > 0.005) {
        const lfo = ctx.createOscillator();
        lfo.type = s.lfoWave === 'sh' ? 'square' : s.lfoWave;
        const rateHz = s.lfoSync
          ? (this.patch.bpm / 60) * s.lfoRate
          : s.lfoRate;
        lfo.frequency.setValueAtTime(Math.max(0.1, Math.min(24, rateHz)), time);

        const lfoGain = ctx.createGain();
        lfo.connect(lfoGain);

        if (s.lfoDest === 'cutoff') {
          lfoGain.gain.setValueAtTime(s.lfoDepth * 1400, time);
          lfoGain.connect(filter1.frequency);
        } else if (s.lfoDest === 'pitch') {
          lfoGain.gain.setValueAtTime(s.lfoDepth * 65, time); // cents
          for (const o of oscNodes) lfoGain.connect(o.detune);
        } else if (s.lfoDest === 'detune') {
          lfoGain.gain.setValueAtTime(s.lfoDepth * 28, time);
          if (oscNodes[1]) lfoGain.connect(oscNodes[1].detune);
          else if (oscNodes[0]) lfoGain.connect(oscNodes[0].detune);
        } else if (s.lfoDest === 'pan') {
          lfoGain.gain.setValueAtTime(s.lfoDepth * 0.75, time);
          lfoGain.connect(destPanner.pan);
        }

        lfo.start(time);
        lfo.stop(stopTime);
        oscsToStop.push(lfo);
      }
    }

    // Amplitude ADSR
    const ampGain = ctx.createGain();
    const peakAmp = Math.max(0.001, voice.volume * 0.26);
    const susAmp = Math.max(0.0002, peakAmp * ampSus);

    ampGain.gain.setValueAtTime(0.0001, time);
    ampGain.gain.linearRampToValueAtTime(peakAmp, time + ampAtk);
    ampGain.gain.exponentialRampToValueAtTime(susAmp, time + ampAtk + ampDec);
    ampGain.gain.setValueAtTime(susAmp, noteOffTime);
    ampGain.gain.exponentialRampToValueAtTime(0.0001, noteOffTime + ampRel);

    postFilterNode.connect(ampGain);
    this.applyVoiceEffects(
      ctx,
      ampGain,
      destPanner,
      voice.fx,
      this.patch.bpm,
      time,
      stopTime,
      oscsToStop
    );

    this.registerActiveVoiceHandle(voice.index, ampGain, oscsToStop, stopTime);
  }

  private registerActiveVoiceHandle(
    voiceIndex: number,
    ampGain: GainNode,
    oscs: AudioScheduledSourceNode[],
    naturalStopTime: number
  ): void {
    const handle: ActiveVoiceHandle = {
      ampGain,
      stopAt: (retrigTime: number) => {
        try {
          ampGain.gain.cancelScheduledValues(retrigTime);
          ampGain.gain.setValueAtTime(
            Math.max(0.0001, ampGain.gain.value),
            retrigTime
          );
          // Section 6.1: Cleanly ramp down previous note over 12ms before starting new note
          ampGain.gain.exponentialRampToValueAtTime(0.0001, retrigTime + 0.012);
          for (const o of oscs) {
            try {
              o.stop(retrigTime + 0.015);
            } catch {
              // Ignore if already stopped
            }
          }
        } catch {
          // Ignore
        }
      },
    };

    this.activeVoicesByTrack.set(voiceIndex, handle);

    // Cleanup handle after natural release
    if (this.ctx) {
      const cleanupMs = Math.max(
        50,
        (naturalStopTime - this.ctx.currentTime) * 1000 + 40
      );
      const tid = window.setTimeout(() => {
        this.pendingTimeouts.delete(tid);
        if (this.activeVoicesByTrack.get(voiceIndex) === handle) {
          this.activeVoicesByTrack.delete(voiceIndex);
        }
      }, cleanupMs);
      this.pendingTimeouts.add(tid);
    }
  }

  /**
   * Section 1.1: Complete lifecycle teardown (`engine.dispose()`)
   */
  public async dispose(): Promise<void> {
    this.stop();
    this.teardownBiosphereGraph();

    const oscs = [this.wowLfoL, this.wowLfoR, this.globalOrganVibLfo];
    for (const o of oscs) {
      if (o) {
        try {
          o.stop();
          o.disconnect();
        } catch {
          // Ignore
        }
      }
    }

    this.wowLfoL = null;
    this.wowLfoR = null;
    this.globalOrganVibLfo = null;
    this.globalOrganVibGain = null;

    if (this.ctx) {
      const ctxToClose = this.ctx;
      const gainToRamp = this.masterGain;
      this.ctx = null;
      this.masterGain = null;
      this.masterLimiter = null;
      this.masterAnalyser = null;
      await audioGuard.gracefulCloseContext(ctxToClose, gainToRamp, 20);
    }
  }
}
