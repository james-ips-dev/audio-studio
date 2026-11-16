/**
 * src/instruments/groovebox/audio/GrooveboxAudioEngine.ts
 *
 * Pure TypeScript 48kHz Web Audio DSP Engine & Sample-Accurate Lookahead Scheduler
 * for Groovebox v4.
 *
 * Strictly decoupled from React state:
 * - Zero `useState` updates on lookahead ticks or 60fps VU/Oscilloscope reads.
 * - Full 8-track synthesis (OSC 1 + OSC 2 FM + SUB 1 + SUB 2 + Noise + Filter + Drive + 3 Envs).
 * - Multi-step extendable note gates, ratchets (4 curves), Elektron conditions, P-locks, and micro-timing.
 * - Per-Track Clip Pointer Routing, Dual-Deck A/B Crossfader, Momentary Punch-In FX, Build & Drop.
 * - Internal Live Resampler, Master WAV Exporter, and 8-Track Stem Exporter.
 */

import { audioGuard } from '../../../core/audioGuard';
import {
  downloadAudioBlob,
  encodeWav16BitStereo,
} from '../../../shared-ui/WavExporter';
import { midiToFreq } from '../presets/factoryPresets';
import type {
  GrooveboxProject,
  KaossAxisDest,
  NoteEvent,
  PunchInFxType,
  RatchetCurve,
  StepData,
  TrackConfig,
  TrigCondition,
} from '../types';

export type StepPlayheadListener = (
  globalStep: number,
  trackSteps: number[]
) => void;

interface TrackChannelGraph {
  inputGain: GainNode;
  driveShaper: WaveShaperNode;
  eqLow: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  sidechainGain: GainNode;
  panner: StereoPannerNode;
  faderGain: GainNode;
  reverbSendGain: GainNode;
  delaySendGain: GainNode;
  analyser: AnalyserNode;
  meterData: Float32Array<ArrayBuffer>;
}

function makeDriveCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = Math.max(0.01, amount) * 35;
  const n = 512;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function makeImpulseResponse(
  ctx: BaseAudioContext,
  durationSec: number = 1.8,
  decay: number = 2.6
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const env = Math.pow(1 - i / length, decay);
    left[i] = (Math.random() * 2 - 1) * env;
    right[i] = (Math.random() * 2 - 1) * env;
  }
  return impulse;
}

function makeNoiseBuffer(
  ctx: BaseAudioContext,
  type: 'white' | 'pink' | 'metallic'
): AudioBuffer {
  const length = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      data[i] = white;
    } else if (type === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 0.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
    } else {
      // Metallic ring-modulated square-comb texture for hi-hats/cymbals
      const s1 = Math.sin(i * 0.31) > 0 ? 0.6 : -0.6;
      const s2 = Math.sin(i * 0.73) > 0 ? 0.6 : -0.6;
      const s3 = Math.sin(i * 1.19) > 0 ? 0.6 : -0.6;
      data[i] = (s1 * s2 + s3 + white * 0.45) * 0.5;
    }
  }
  return buffer;
}

export class GrooveboxAudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private masterTiltLow: BiquadFilterNode | null = null;
  private masterTiltHigh: BiquadFilterNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  private reverbConvolver: ConvolverNode | null = null;
  private reverbEcoFeedback: GainNode | null = null;
  private reverbReturnGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayReturnGain: GainNode | null = null;

  private trackChannels: TrackChannelGraph[] = [];
  private noiseBuffers: Record<'white' | 'pink' | 'metallic', AudioBuffer> | null =
    null;

  private projectRef: GrooveboxProject;
  private isPlaying: boolean = false;
  private isFillHeld: boolean = false;
  private isBuildDropHeld: boolean = false;
  private kaossActive: {
    x: number;
    y: number;
    targets: number[];
    master: boolean;
    xDest: KaossAxisDest;
    yDest: KaossAxisDest;
  } | null = null;

  private schedulerTimer: number | null = null;
  private playheadTimeouts: Set<number> = new Set();
  private activeVoiceGains: Set<GainNode> = new Set();
  private nextStepTime: number = 0;
  private currentGlobalStep: number = 0;
  private loopCycleCount: number = 0;
  private prevStepTriggeredByTrack: boolean[] = Array(8).fill(false);
  private sustainedStepsRemaining: number[] = Array(8).fill(0);
  private lastMonophonicFreqByTrack: number[] = Array(8).fill(110);

  private playheadListeners: Set<StepPlayheadListener> = new Set();

  // Internal Live Resampler state
  private resamplerBuffer: AudioBuffer | null = null;
  private resamplerProcessor: ScriptProcessorNode | null = null;
  private resamplerChunksL: Float32Array[] = [];
  private resamplerChunksR: Float32Array[] = [];
  private isResamplingFlag: boolean = false;

  constructor(initialProject: GrooveboxProject) {
    this.projectRef = initialProject;
  }

  public updateProject(project: GrooveboxProject): void {
    const wasPlaying = this.isPlaying;
    this.projectRef = project;
    this.syncMixerAndMasterGraph();
    // Ensure isPlaying flag is preserved and not reset on project state sync
    this.isPlaying = wasPlaying;
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

  public setFillHeld(held: boolean): void {
    this.isFillHeld = held;
  }

  public setBuildDropHeld(held: boolean): void {
    this.isBuildDropHeld = held;
    if (!this.audioCtx || !this.masterFilter || !this.reverbReturnGain) return;
    const now = this.audioCtx.currentTime;
    if (held) {
      this.masterFilter.type = 'highpass';
      this.masterFilter.frequency.setTargetAtTime(620, now, 0.12);
      this.reverbReturnGain.gain.setTargetAtTime(0.75, now, 0.12);
    } else {
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setTargetAtTime(
        this.projectRef.globalFx.masterFilterCutoff,
        now,
        0.04
      );
      this.reverbReturnGain.gain.setTargetAtTime(
        this.projectRef.globalFx.reverbReturn,
        now,
        0.05
      );
    }
  }

  public setPunchInFx(fx: PunchInFxType): void {
    this.projectRef.performance.activePunchInFx = fx;
    if (!this.audioCtx || !this.masterFilter || !this.reverbReturnGain) return;
    const now = this.audioCtx.currentTime;

    if (fx === 'hpf-riser') {
      this.masterFilter.type = 'highpass';
      this.masterFilter.frequency.setTargetAtTime(900, now, 0.08);
    } else if (fx === 'dub-wash') {
      this.reverbReturnGain.gain.setTargetAtTime(0.88, now, 0.06);
      if (this.delayFeedbackGain) {
        this.delayFeedbackGain.gain.setTargetAtTime(0.82, now, 0.06);
      }
    } else if (fx === 'sub-drop') {
      this.triggerSubDropImpact(now);
    } else {
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setTargetAtTime(
        this.projectRef.globalFx.masterFilterCutoff,
        now,
        0.05
      );
      this.reverbReturnGain.gain.setTargetAtTime(
        this.projectRef.globalFx.reverbReturn,
        now,
        0.05
      );
      if (this.delayFeedbackGain) {
        this.delayFeedbackGain.gain.setTargetAtTime(
          this.projectRef.globalFx.delayFeedback,
          now,
          0.05
        );
      }
    }
  }

  public setKaossWarp(
    x: number | null,
    y: number | null,
    targets: number[],
    master: boolean,
    xDest: KaossAxisDest = 'cutoff',
    yDest: KaossAxisDest = 'resonance'
  ): void {
    if (x === null || y === null) {
      this.kaossActive = null;
      this.syncMixerAndMasterGraph();
      return;
    }
    this.kaossActive = { x, y, targets, master, xDest, yDest };
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    const applyAxisLive = (dest: KaossAxisDest, val: number) => {
      if (dest === 'cutoff' && this.masterFilter && master) {
        const freq = 120 * Math.pow(18000 / 120, val);
        this.masterFilter.frequency.setTargetAtTime(freq, now, 0.02);
      } else if (dest === 'resonance' && this.masterFilter && master) {
        this.masterFilter.Q.setTargetAtTime(0.7 + val * 10, now, 0.02);
      } else if (dest === 'reverbSend') {
        if (master && this.reverbReturnGain) {
          this.reverbReturnGain.gain.setTargetAtTime(val * 0.85, now, 0.03);
        }
        for (const tIdx of targets) {
          this.trackChannels[tIdx]?.reverbSendGain.gain.setTargetAtTime(
            val * 0.85,
            now,
            0.02
          );
        }
      } else if (dest === 'delaySend') {
        if (master && this.delayFeedbackGain && this.delayReturnGain) {
          this.delayFeedbackGain.gain.setTargetAtTime(
            Math.min(0.86, val * 0.85),
            now,
            0.03
          );
          this.delayReturnGain.gain.setTargetAtTime(val * 0.75, now, 0.03);
        }
        for (const tIdx of targets) {
          this.trackChannels[tIdx]?.delaySendGain.gain.setTargetAtTime(
            val * 0.8,
            now,
            0.02
          );
        }
      } else if (dest === 'pan') {
        const panVal = Math.max(-1, Math.min(1, val * 2 - 1));
        for (const tIdx of targets) {
          this.trackChannels[tIdx]?.panner.pan.setTargetAtTime(
            panVal,
            now,
            0.02
          );
        }
      }
    };

    applyAxisLive(xDest, x);
    applyAxisLive(yDest, y);
  }

  /**
   * Emergency All Notes Off (!PANIC):
   * Silences all active voices, flushes delay/reverb feedback tanks, and resets momentary FX.
   */
  public panic(): void {
    for (const tid of this.playheadTimeouts) {
      window.clearTimeout(tid);
    }
    this.playheadTimeouts.clear();
    this.sustainedStepsRemaining = Array(8).fill(0);
    this.kaossActive = null;
    this.isBuildDropHeld = false;
    this.isFillHeld = false;
    this.projectRef.performance.activePunchInFx = 'none';

    const ctx = this.audioCtx;
    if (!ctx) return;
    const now = ctx.currentTime;

    for (const vca of this.activeVoiceGains) {
      try {
        vca.gain.cancelScheduledValues(now);
        vca.gain.setValueAtTime(Math.max(0.0001, vca.gain.value), now);
        vca.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);
      } catch {
        // Ignore
      }
    }
    this.activeVoiceGains.clear();

    if (this.delayFeedbackGain) {
      this.delayFeedbackGain.gain.cancelScheduledValues(now);
      this.delayFeedbackGain.gain.setValueAtTime(0, now);
    }
    if (this.delayReturnGain) {
      this.delayReturnGain.gain.cancelScheduledValues(now);
      this.delayReturnGain.gain.setValueAtTime(0, now);
    }
    if (this.reverbReturnGain) {
      this.reverbReturnGain.gain.cancelScheduledValues(now);
      this.reverbReturnGain.gain.setValueAtTime(0, now);
    }
    if (this.reverbEcoFeedback) {
      this.reverbEcoFeedback.gain.cancelScheduledValues(now);
      this.reverbEcoFeedback.gain.setValueAtTime(0, now);
    }

    window.setTimeout(() => {
      this.syncMixerAndMasterGraph();
    }, 65);
  }

  public onPlayheadStep(listener: StepPlayheadListener): () => void {
    this.playheadListeners.add(listener);
    return () => {
      this.playheadListeners.delete(listener);
    };
  }

  /**
   * Reads instantaneous RMS/Peak level (0..1) for each of the 8 tracks for LED VU meters.
   */
  public getTrackLevels(outLevels: Float32Array): void {
    for (let i = 0; i < 8; i++) {
      const ch = this.trackChannels[i];
      if (!ch || !this.audioCtx || this.audioCtx.state !== 'running') {
        outLevels[i] = 0;
        continue;
      }
      ch.analyser.getFloatTimeDomainData(ch.meterData);
      let peak = 0;
      for (let s = 0; s < ch.meterData.length; s += 4) {
        const abs = Math.abs(ch.meterData[s]);
        if (abs > peak) peak = abs;
      }
      outLevels[i] = Math.min(1, peak * 1.4);
    }
  }

  public ensureInitialized(): AudioContext {
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      return this.audioCtx;
    }

    const { audioCtx, masterGain } =
      audioGuard.createIsolatedAudioContext('groovebox');
    this.audioCtx = audioCtx;
    this.masterGain = masterGain;

    this.noiseBuffers = {
      white: makeNoiseBuffer(audioCtx, 'white'),
      pink: makeNoiseBuffer(audioCtx, 'pink'),
      metallic: makeNoiseBuffer(audioCtx, 'metallic'),
    };

    // Build 3-Stage Master Bus Mastering Chain:
    // Glue Compressor -> Tilt EQ -> Master DJ Filter -> Brickwall Limiter (-0.3 dBFS) -> Master Analyser -> Master Gain
    const comp = audioCtx.createDynamicsCompressor();
    const tiltLow = audioCtx.createBiquadFilter();
    tiltLow.type = 'lowshelf';
    tiltLow.frequency.value = 250;

    const tiltHigh = audioCtx.createBiquadFilter();
    tiltHigh.type = 'highshelf';
    tiltHigh.frequency.value = 3200;

    const djFilter = audioCtx.createBiquadFilter();
    djFilter.type = 'lowpass';
    djFilter.frequency.value = 18500;

    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -0.3;
    limiter.knee.value = 0.0;
    limiter.ratio.value = 20.0;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;

    comp.connect(tiltLow);
    tiltLow.connect(tiltHigh);
    tiltHigh.connect(djFilter);
    djFilter.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(masterGain);

    this.masterCompressor = comp;
    this.masterTiltLow = tiltLow;
    this.masterTiltHigh = tiltHigh;
    this.masterFilter = djFilter;
    this.masterLimiter = limiter;
    this.masterAnalyser = analyser;

    // Global Reverb Send Buses (Full Convolver in Studio, Zero-Cost Schroeder Delay in Eco)
    const revReturn = audioCtx.createGain();
    const convolver = audioCtx.createConvolver();
    convolver.buffer = makeImpulseResponse(audioCtx, 1.9, 2.5);
    convolver.connect(revReturn);

    // Eco Mode Lightweight Algorithmic Reverb Tank
    const ecoDly = audioCtx.createDelay(0.3);
    ecoDly.delayTime.value = 0.085;
    const ecoFb = audioCtx.createGain();
    ecoFb.gain.value = 0.42;
    ecoDly.connect(ecoFb);
    ecoFb.connect(ecoDly);
    ecoFb.connect(revReturn);

    revReturn.connect(comp);
    this.reverbConvolver = convolver;
    this.reverbEcoFeedback = ecoFb;
    this.reverbReturnGain = revReturn;

    const dly = audioCtx.createDelay(2.0);
    const dlyFb = audioCtx.createGain();
    const dlyFilter = audioCtx.createBiquadFilter();
    dlyFilter.type = 'lowpass';
    dlyFilter.frequency.value = 3600;
    const dlyReturn = audioCtx.createGain();

    dly.connect(dlyFilter);
    dlyFilter.connect(dlyFb);
    dlyFb.connect(dly);
    dlyFilter.connect(dlyReturn);
    dlyReturn.connect(comp);

    this.delayNode = dly;
    this.delayFeedbackGain = dlyFb;
    this.delayReturnGain = dlyReturn;

    // Build 8 Track Channel Strips
    this.trackChannels = [];
    for (let i = 0; i < 8; i++) {
      const inputGain = audioCtx.createGain();
      const driveShaper = audioCtx.createWaveShaper();
      driveShaper.curve = makeDriveCurve(0.2);
      driveShaper.oversample = '2x';

      const eqLow = audioCtx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 160;

      const eqHigh = audioCtx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 4500;

      const sidechainGain = audioCtx.createGain();
      const panner = audioCtx.createStereoPanner();
      const faderGain = audioCtx.createGain();
      const reverbSendGain = audioCtx.createGain();
      const delaySendGain = audioCtx.createGain();
      const trkAnalyser = audioCtx.createAnalyser();
      trkAnalyser.fftSize = 256;

      inputGain.connect(driveShaper);
      driveShaper.connect(eqLow);
      eqLow.connect(eqHigh);
      eqHigh.connect(sidechainGain);
      sidechainGain.connect(panner);
      panner.connect(faderGain);

      faderGain.connect(comp);
      faderGain.connect(trkAnalyser);
      faderGain.connect(reverbSendGain);
      faderGain.connect(delaySendGain);

      reverbSendGain.connect(convolver);
      reverbSendGain.connect(ecoDly);
      delaySendGain.connect(dly);

      this.trackChannels.push({
        inputGain,
        driveShaper,
        eqLow,
        eqHigh,
        sidechainGain,
        panner,
        faderGain,
        reverbSendGain,
        delaySendGain,
        analyser: trkAnalyser,
        meterData: new Float32Array(new ArrayBuffer(256 * 4)),
      });
    }

    this.syncMixerAndMasterGraph();
    return audioCtx;
  }

  public syncMixerAndMasterGraph(): void {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const p = this.projectRef;

    const anySolo = p.tracks.some((t) => t.mixer.solo);

    for (let i = 0; i < 8; i++) {
      const trk = p.tracks[i];
      const ch = this.trackChannels[i];
      if (!trk || !ch) continue;

      const audible = anySolo ? trk.mixer.solo : !trk.mixer.mute;
      const targetVol = audible ? trk.mixer.volume : 0.0;

      ch.faderGain.gain.setTargetAtTime(targetVol, now, 0.015);
      ch.panner.pan.setTargetAtTime(
        Math.min(1, Math.max(-1, trk.mixer.pan)),
        now,
        0.015
      );
      ch.reverbSendGain.gain.setTargetAtTime(
        audible ? trk.mixer.reverbSend * 0.65 : 0,
        now,
        0.02
      );
      ch.delaySendGain.gain.setTargetAtTime(
        audible ? trk.mixer.delaySend * 0.6 : 0,
        now,
        0.02
      );

      const eqUnit = trk.insertFx.find((fx) => fx.type === 'eq4');
      if (eqUnit && eqUnit.enabled) {
        ch.eqLow.gain.setTargetAtTime(eqUnit.params.lowGain ?? 0, now, 0.02);
        ch.eqHigh.gain.setTargetAtTime(eqUnit.params.highGain ?? 0, now, 0.02);
      } else {
        ch.eqLow.gain.setTargetAtTime(0, now, 0.02);
        ch.eqHigh.gain.setTargetAtTime(0, now, 0.02);
      }
    }

    // Master FX & Mastering Strip
    const stepSec = 60 / Math.max(40, p.bpm) / 4;
    const delayMult =
      p.globalFx.delayDiv === '1/8D'
        ? 3
        : p.globalFx.delayDiv === '1/8'
          ? 2
          : 1;

    if (this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(
        Math.min(1.8, stepSec * delayMult),
        now,
        0.03
      );
    }
    if (this.delayFeedbackGain) {
      this.delayFeedbackGain.gain.setTargetAtTime(
        Math.min(0.88, p.globalFx.delayFeedback),
        now,
        0.03
      );
    }
    if (this.delayReturnGain) {
      this.delayReturnGain.gain.setTargetAtTime(
        p.globalFx.delayReturn,
        now,
        0.03
      );
    }
    if (this.reverbReturnGain && !this.isBuildDropHeld) {
      this.reverbReturnGain.gain.setTargetAtTime(
        p.globalFx.reverbReturn,
        now,
        0.03
      );
    }
    // Manage Eco vs Studio Reverb Paths & WaveShaper Oversampling
    const isEco = Boolean(p.ecoMode);
    if (this.reverbConvolver && this.reverbEcoFeedback) {
      // In Eco mode, disconnect/zero the heavy FFT Convolver and engage the light feedback delay
      try {
        if (isEco) {
          this.reverbEcoFeedback.gain.setTargetAtTime(0.42, now, 0.05);
        } else {
          this.reverbEcoFeedback.gain.setTargetAtTime(0.0, now, 0.05);
        }
      } catch {
        // Safe fallback
      }
    }
    for (const ch of this.trackChannels) {
      if (ch.driveShaper) {
        ch.driveShaper.oversample = isEco ? 'none' : '2x';
      }
    }
    if (this.masterCompressor) {
      this.masterCompressor.threshold.setTargetAtTime(
        p.globalFx.masterCompressorThreshold,
        now,
        0.03
      );
      this.masterCompressor.ratio.setTargetAtTime(
        p.globalFx.masterCompressorRatio,
        now,
        0.03
      );
    }
    if (this.masterTiltLow && this.masterTiltHigh) {
      const tiltDb = p.globalFx.masterTiltEq * 6;
      this.masterTiltLow.gain.setTargetAtTime(-tiltDb, now, 0.03);
      this.masterTiltHigh.gain.setTargetAtTime(tiltDb, now, 0.03);
    }
    if (this.masterFilter && !this.isBuildDropHeld && !this.kaossActive?.master) {
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setTargetAtTime(
        p.globalFx.masterFilterCutoff,
        now,
        0.03
      );
      this.masterFilter.Q.setTargetAtTime(0.707, now, 0.03);
    }
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.isPlaying ? p.globalFx.masterVolume : 0.0,
        now,
        0.02
      );
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
    this.syncMixerAndMasterGraph();
    this.currentGlobalStep = 0;
    this.loopCycleCount = 0;
    this.sustainedStepsRemaining = Array(8).fill(0);
    this.nextStepTime = ctx.currentTime + 0.03;

    const timerIntervalMs = this.projectRef.ecoMode ? 40 : 25;
    this.schedulerTimer = window.setInterval(
      () => this.schedulerTick(),
      timerIntervalMs
    );
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    for (const tid of this.playheadTimeouts) {
      window.clearTimeout(tid);
    }
    this.playheadTimeouts.clear();
    this.currentGlobalStep = 0;
    this.sustainedStepsRemaining = Array(8).fill(0);
    this.syncMixerAndMasterGraph();
    this.notifyPlayhead(0, Array(8).fill(0));
  }

  private schedulerTick(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.isPlaying) return;

    // Generous lookahead (240ms in Eco, 150ms normal) prevents buffer underrun crackles on Chromebooks
    const lookaheadSec = this.projectRef.ecoMode ? 0.24 : 0.15;
    // Catch-up guard if tab was backgrounded
    if (this.nextStepTime < ctx.currentTime - 0.1) {
      this.nextStepTime = ctx.currentTime + 0.02;
    }

    while (this.nextStepTime < ctx.currentTime + lookaheadSec) {
      this.scheduleStepAtTime(this.currentGlobalStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    const p = this.projectRef;
    const activePat =
      p.patterns[p.activePatternId] ?? Object.values(p.patterns)[0];
    const totalPatternSteps = (activePat?.bars ?? 2) * 16;

    const punchFx = p.performance.activePunchInFx;
    const tempoFactor = punchFx === 'tape-stop' ? 0.55 : 1.0;
    const baseStepSec = 60 / Math.max(40, p.bpm * tempoFactor) / 4;

    // Apply swing to even/odd 16th steps
    const isOddStep = this.currentGlobalStep % 2 === 1;
    const swingOffset = (p.swing * 0.33) * baseStepSec;
    const stepDuration = isOddStep
      ? baseStepSec - swingOffset
      : baseStepSec + swingOffset;

    this.nextStepTime += Math.max(0.02, stepDuration);
    this.currentGlobalStep++;

    if (this.currentGlobalStep >= totalPatternSteps) {
      this.currentGlobalStep = 0;
      this.loopCycleCount++;
    }

    // Commit queued per-track clip launches on quantization boundaries
    const quant = p.performance.launchQuantize;
    const isBoundary =
      quant === 'immediate' ||
      (quant === '1/16') ||
      (quant === '1-beat' && this.currentGlobalStep % 4 === 0) ||
      (quant === '1-bar' && this.currentGlobalStep % 16 === 0) ||
      (quant === '2-bars' && this.currentGlobalStep % 32 === 0);

    if (isBoundary) {
      for (let t = 0; t < 8; t++) {
        const queued = p.performance.queuedTrackPatterns[t];
        if (queued) {
          p.performance.activeTrackPatterns[t] = queued;
          p.performance.queuedTrackPatterns[t] = null;
        }
      }
    }
  }

  private evaluateCondition(
    condition: TrigCondition,
    trackIndex: number
  ): boolean {
    switch (condition) {
      case 'ALWAYS':
        return true;
      case 'FILL':
        return this.isFillHeld || this.isBuildDropHeld;
      case 'PRE':
        return this.prevStepTriggeredByTrack[trackIndex];
      case '!PRE':
        return !this.prevStepTriggeredByTrack[trackIndex];
      case '1:2':
        return this.loopCycleCount % 2 === 0;
      case '2:2':
        return this.loopCycleCount % 2 === 1;
      case '1:4':
        return this.loopCycleCount % 4 === 0;
      case '2:4':
        return this.loopCycleCount % 4 === 1;
      case '3:4':
        return this.loopCycleCount % 4 === 2;
      case '4:4':
        return this.loopCycleCount % 4 === 3;
      default:
        return true;
    }
  }

  private scheduleStepAtTime(globalStep: number, baseTime: number): void {
    const p = this.projectRef;
    const stepSec = 60 / Math.max(40, p.bpm) / 4;
    const trackStepPositions: number[] = new Array(8).fill(0);

    const xfPos = p.performance.crossfaderPosition;
    const xfMode = p.performance.crossfadeMode;

    for (let t = 0; t < 8; t++) {
      const trkConfig = p.tracks[t];
      if (!trkConfig) continue;

      // Determine pattern for this track (incorporating Dual-Deck A/B Crossfader)
      let routedPatternId =
        p.performance.activeTrackPatterns[t] || p.activePatternId;
      if (xfPos > 0.01) {
        if (xfMode === 'step-probability-morph') {
          routedPatternId =
            Math.random() < xfPos
              ? p.performance.deckB[t]
              : p.performance.deckA[t];
        } else if (xfPos > 0.5) {
          routedPatternId = p.performance.deckB[t] || routedPatternId;
        }
      }

      const pat = p.patterns[routedPatternId] ?? p.patterns[p.activePatternId];
      const seq = pat?.tracks[t];
      if (!seq) continue;

      const polyLen = Math.max(1, seq.lengthSteps || 16);
      const localStep = globalStep % polyLen;
      trackStepPositions[t] = localStep;

      // If an earlier step on this track is still sustaining across multiple steps,
      // hold its continuous tie without retriggering on covered steps.
      if (this.sustainedStepsRemaining[t] > 0) {
        this.sustainedStepsRemaining[t]--;
        continue;
      }

      const stepData: StepData | undefined = seq.steps[localStep];
      if (!stepData || !stepData.active) {
        this.prevStepTriggeredByTrack[t] = false;
        continue;
      }

      // Check probability & condition
      const probPass =
        stepData.probability >= 0.999 || Math.random() <= stepData.probability;
      const condPass = this.evaluateCondition(stepData.condition, t);

      if (!probPass || !condPass) {
        this.prevStepTriggeredByTrack[t] = false;
        continue;
      }

      this.prevStepTriggeredByTrack[t] = true;

      const microOffsetSec = (stepData.microTiming || 0) * stepSec;
      const triggerTime = Math.max(
        this.audioCtx?.currentTime ?? baseTime,
        baseTime + microOffsetSec
      );

      // Momentary Beat Repeat override or Step Ratchet subdivisions
      const effectiveRatchet =
        p.performance.activePunchInFx === 'beat-repeat'
          ? 3
          : stepData.ratchet || 1;

      const maxDurSteps = Math.max(
        1,
        ...stepData.notes.map((n) => n.durationSteps || 1)
      );
      if (maxDurSteps > 1 && effectiveRatchet === 1) {
        this.sustainedStepsRemaining[t] = maxDurSteps - 1;
      }

      const subStepDur = stepSec / effectiveRatchet;
      for (let r = 0; r < effectiveRatchet; r++) {
        const rVelScale = this.computeRatchetVelocityScale(
          r,
          effectiveRatchet,
          stepData.ratchetCurve
        );
        const rTime = triggerTime + r * subStepDur;

        for (let nIdx = 0; nIdx < stepData.notes.length; nIdx++) {
          const noteEv = stepData.notes[nIdx];
          const strumOffsetSec =
            t === 6 ? (nIdx * (trkConfig.chordStrumMs || 0)) / 1000 : 0;

          const durSteps = noteEv.durationSteps || 1;
          const gateDurationSec =
            effectiveRatchet > 1
              ? subStepDur * 0.85
              : Math.max(
                  0.04,
                  durSteps * stepSec * (durSteps > 1 ? 0.97 : 0.92)
                );

          this.triggerTrackNote(
            t,
            noteEv,
            rTime + strumOffsetSec,
            gateDurationSec,
            rVelScale * (stepData.velocity || 0.85),
            stepData.pLocks
          );
        }
      }

      // If Track 0 (Kick) fired, trigger sidechain ducking on tracks that subscribe to Kick
      if (t === 0) {
        this.triggerSidechainDuck(triggerTime);
      }
    }

    // Build & Drop snare roll on last 4 steps of bar
    if (this.isBuildDropHeld && globalStep % 16 >= 12) {
      this.triggerTrackNote(
        1,
        { midiNote: 38, velocity: 0.9, durationSteps: 1, glide: false },
        baseTime,
        stepSec * 0.45,
        0.9,
        {}
      );
      this.triggerTrackNote(
        1,
        { midiNote: 38, velocity: 0.75, durationSteps: 1, glide: false },
        baseTime + stepSec * 0.5,
        stepSec * 0.45,
        0.75,
        {}
      );
    }

    const outLatencySec =
      (this.audioCtx as (AudioContext & { outputLatency?: number }) | null)
        ?.outputLatency ||
      this.audioCtx?.baseLatency ||
      0.018;
    const delayMs = Math.max(
      0,
      (baseTime - (this.audioCtx?.currentTime ?? baseTime) + outLatencySec) *
        1000
    );
    const tid = window.setTimeout(() => {
      this.playheadTimeouts.delete(tid);
      if (this.isPlaying) {
        this.notifyPlayhead(globalStep, trackStepPositions);
      }
    }, delayMs);
    this.playheadTimeouts.add(tid);
  }

  private computeRatchetVelocityScale(
    subIdx: number,
    totalSubs: number,
    curve: RatchetCurve
  ): number {
    if (totalSubs <= 1) return 1.0;
    const progress = subIdx / (totalSubs - 1);
    switch (curve) {
      case 'fade-out':
        return 1.0 - progress * 0.65;
      case 'swell':
        return 0.35 + progress * 0.65;
      case 'bouncing-ball':
        return 1.0 - Math.pow(progress, 1.6) * 0.6;
      case 'flat':
      default:
        return 1.0;
    }
  }

  private triggerSidechainDuck(time: number): void {
    const ctx = this.audioCtx;
    if (!ctx) return;

    for (let i = 1; i < 8; i++) {
      const trk = this.projectRef.tracks[i];
      const ch = this.trackChannels[i];
      if (!trk || !ch) continue;

      const scFx = trk.insertFx.find(
        (fx) => fx.type === 'sidechainComp' && fx.enabled
      );
      if (scFx) {
        const depth = Math.min(0.92, Math.max(0, scFx.params.depth ?? 0.55));
        const releaseSec = Math.max(0.06, scFx.params.release ?? 0.18);
        ch.sidechainGain.gain.cancelScheduledValues(time);
        ch.sidechainGain.gain.setValueAtTime(1.0, time);
        ch.sidechainGain.gain.linearRampToValueAtTime(1.0 - depth, time + 0.006);
        ch.sidechainGain.gain.exponentialRampToValueAtTime(
          1.0,
          time + releaseSec
        );
      }
    }
  }

  private triggerSubDropImpact(time: number): void {
    const ctx = this.ensureInitialized();
    const osc = ctx.createOscillator();
    const vca = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(28, time + 0.95);

    vca.gain.setValueAtTime(0.65, time);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + 1.0);

    osc.connect(vca);
    if (this.masterCompressor) {
      vca.connect(this.masterCompressor);
    }
    osc.start(time);
    osc.stop(time + 1.02);
    osc.onended = () => {
      osc.disconnect();
      vca.disconnect();
    };
  }

  /**
   * Immediately auditions a note or chord on a track (used by Live Pads, Piano Roll, QWERTY, and Sequencer).
   */
  public triggerLiveNote(
    trackIndex: number,
    midiNote: number,
    velocity: number = 0.85,
    durationSec: number = 0.25
  ): void {
    const ctx = this.ensureInitialized();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    // Temporarily open masterGain if sequencer is currently stopped so audition/hit sounds can be heard
    if (!this.isPlaying && this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.projectRef.globalFx.masterVolume, now);
      // Gently ramp back down to 0 after the hit audition finishes
      this.masterGain.gain.setTargetAtTime(0.0, now + durationSec + 0.1, 0.05);
    }
    this.triggerTrackNote(
      trackIndex,
      { midiNote, velocity, durationSteps: 1, glide: false },
      ctx.currentTime,
      durationSec,
      velocity,
      {}
    );
  }

  private triggerTrackNote(
    trackIndex: number,
    noteEvent: NoteEvent,
    startTime: number,
    gateDurationSec: number,
    velocityScale: number,
    pLocks: Record<string, number>
  ): void {
    const ctx = this.audioCtx;
    const ch = this.trackChannels[trackIndex];
    const trk: TrackConfig | undefined = this.projectRef.tracks[trackIndex];
    if (!ctx || !ch || !trk) return;

    const synth = trk.synth;
    const vel = Math.min(1, Math.max(0.05, noteEvent.velocity * velocityScale));

    // Resolve P-Lock & Kaoss overrides
    let cutoff = pLocks.cutoff ?? synth.filter.cutoff;
    let resonance = pLocks.resonance ?? synth.filter.resonance;
    let fmDepth = pLocks.fmDirt ?? synth.osc2.fmDepth;
    let ampDecay = pLocks.ampDecay ?? synth.ampEnv.decay;
    let kaossPitchSemis = 0;

    // Apply Scene Crossfader morphing
    const sceneXf = this.projectRef.sceneCrossfader;
    const cutoffPath = `tracks.${trackIndex}.synth.filter.cutoff`;
    if (
      sceneXf > 0.01 &&
      cutoffPath in this.projectRef.sceneA &&
      cutoffPath in this.projectRef.sceneB
    ) {
      const a = this.projectRef.sceneA[cutoffPath];
      const b = this.projectRef.sceneB[cutoffPath];
      cutoff = a + (b - a) * sceneXf;
    }

    // Apply Kaoss Pad per-track X/Y warp if active
    if (
      this.kaossActive &&
      this.kaossActive.targets.includes(trackIndex)
    ) {
      const applyAxisVoice = (dest: KaossAxisDest, val: number) => {
        if (dest === 'cutoff') {
          cutoff = 80 * Math.pow(16000 / 80, val);
        } else if (dest === 'resonance') {
          resonance = 0.7 + val * 14;
        } else if (dest === 'fmDepth') {
          fmDepth = val * 0.9;
        } else if (dest === 'decay') {
          ampDecay = 0.04 + val * 1.4;
        } else if (dest === 'pitch') {
          kaossPitchSemis = Math.round((val - 0.5) * 24);
        }
      };
      applyAxisVoice(this.kaossActive.xDest, this.kaossActive.x);
      applyAxisVoice(this.kaossActive.yDest, this.kaossActive.y);
    }

    // Compute fundamental frequency (with Key-Lock drum tuning if enabled)
    let midi = noteEvent.midiNote + kaossPitchSemis;
    if (trk.isDrum && synth.voice.keyTunedDrum) {
      midi = 36 + this.projectRef.rootNote + kaossPitchSemis;
    }
    const baseFreq = midiToFreq(midi);

    // Analog slop micro-drift
    const slopCents =
      (Math.random() * 2 - 1) * (synth.voice.analogSlop || 0) * 8;

    const isTied = (noteEvent.durationSteps || 1) > 1;

    // Specialized Kick synthesis (Track 0)
    if (trackIndex === 0) {
      const kickOsc = ctx.createOscillator();
      const clickOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const vca = ctx.createGain();
      this.activeVoiceGains.add(vca);

      kickOsc.type = 'sine';
      const punchMult = 1 + Math.max(0.2, synth.beginnerMacros.pitchEnv) * 3.2;
      kickOsc.frequency.setValueAtTime(baseFreq * punchMult, startTime);
      kickOsc.frequency.exponentialRampToValueAtTime(
        Math.max(32, baseFreq),
        startTime + 0.055
      );
      kickOsc.frequency.exponentialRampToValueAtTime(
        Math.max(28, baseFreq * 0.78),
        startTime + Math.max(0.12, ampDecay)
      );

      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(baseFreq * 5, startTime);
      clickOsc.frequency.exponentialRampToValueAtTime(60, startTime + 0.02);
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.35 * fmDepth, startTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.025);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.max(120, cutoff * 4), startTime);

      const totalDur = isTied
        ? Math.max(gateDurationSec, ampDecay)
        : Math.max(0.1, ampDecay);
      vca.gain.setValueAtTime(0.0001, startTime);
      vca.gain.linearRampToValueAtTime(0.95 * vel, startTime + 0.003);
      if (isTied) {
        const holdEnd = startTime + Math.max(0.04, gateDurationSec * 0.88);
        vca.gain.exponentialRampToValueAtTime(
          0.74 * vel,
          startTime + Math.min(0.08, gateDurationSec * 0.3)
        );
        vca.gain.setValueAtTime(0.74 * vel, holdEnd);
        vca.gain.exponentialRampToValueAtTime(0.0001, startTime + totalDur + 0.04);
      } else {
        vca.gain.exponentialRampToValueAtTime(0.0001, startTime + totalDur);
      }

      kickOsc.connect(filter);
      clickOsc.connect(clickGain);
      clickGain.connect(filter);
      filter.connect(vca);
      vca.connect(ch.inputGain);

      kickOsc.start(startTime);
      clickOsc.start(startTime);
      kickOsc.stop(startTime + totalDur + 0.06);
      clickOsc.stop(startTime + 0.03);
      kickOsc.onended = () => {
        this.activeVoiceGains.delete(vca);
        kickOsc.disconnect();
        clickOsc.disconnect();
        clickGain.disconnect();
        filter.disconnect();
        vca.disconnect();
      };
      return;
    }

    // Full Multi-Oscillator + Sub + Noise Voice Graph for Tracks 1..7
    const filter = ctx.createBiquadFilter();
    filter.type =
      synth.filter.type === 'hp12'
        ? 'highpass'
        : synth.filter.type === 'bp12'
          ? 'bandpass'
          : synth.filter.type === 'notch'
            ? 'notch'
            : 'lowpass';

    const velCutoffBoost =
      vel * (synth.filter.velocityTimbre || 0.4) * 2600;
    const envTargetCutoff = Math.min(
      18000,
      Math.max(
        40,
        cutoff + velCutoffBoost + synth.filter.envDepth * 4200
      )
    );

    const vca = ctx.createGain();
    this.activeVoiceGains.add(vca);
    const attackSec = Math.max(0.002, synth.ampEnv.attack);
    const decaySec = Math.max(0.03, ampDecay);
    // Multi-beat extended notes automatically sustain at a rich audible level (>= 0.72)
    // across all covered steps without dying out after the first step.
    const sustainLvl = isTied
      ? Math.max(0.72, synth.ampEnv.sustain)
      : trk.isDrum
        ? 0.0001
        : Math.max(0.001, synth.ampEnv.sustain);
    const releaseSec = Math.max(0.03, synth.ampEnv.release);

    const peakGain = (trk.isDrum ? 0.55 : 0.34) * vel;
    const noteOffTime =
      trk.isDrum && !isTied
        ? startTime + attackSec + decaySec
        : startTime + Math.max(gateDurationSec, attackSec + 0.02);
    const stopTime = noteOffTime + releaseSec + 0.03;

    filter.frequency.setValueAtTime(
      Math.min(18000, Math.max(40, cutoff)),
      startTime
    );
    filter.frequency.linearRampToValueAtTime(
      envTargetCutoff,
      startTime + Math.max(0.003, synth.filterEnv.attack)
    );
    if (isTied) {
      const heldCutoff = Math.min(
        18000,
        Math.max(cutoff, cutoff + (envTargetCutoff - cutoff) * 0.65)
      );
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(45, heldCutoff),
        startTime +
          Math.max(0.02, synth.filterEnv.attack + synth.filterEnv.decay)
      );
      filter.frequency.setValueAtTime(Math.max(45, heldCutoff), noteOffTime);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(45, cutoff),
        stopTime
      );
    } else {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(45, cutoff),
        startTime +
          Math.max(0.02, synth.filterEnv.attack + synth.filterEnv.decay)
      );
    }
    filter.Q.setValueAtTime(
      Math.min(18, Math.max(0.5, resonance)),
      startTime
    );

    vca.gain.setValueAtTime(0.0001, startTime);
    vca.gain.linearRampToValueAtTime(peakGain, startTime + attackSec);
    if (trk.isDrum && !isTied) {
      vca.gain.exponentialRampToValueAtTime(0.0001, noteOffTime);
    } else {
      const decEnd = Math.min(noteOffTime, startTime + attackSec + decaySec);
      vca.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, peakGain * sustainLvl),
        decEnd
      );
      vca.gain.setValueAtTime(
        Math.max(0.0001, peakGain * sustainLvl),
        noteOffTime
      );
      vca.gain.exponentialRampToValueAtTime(0.0001, noteOffTime + releaseSec);
    }

    filter.connect(vca);
    vca.connect(ch.inputGain);

    const activeSourceNodes: AudioScheduledSourceNode[] = [];

    // Portamento / Glide calculation
    const prevFreq = this.lastMonophonicFreqByTrack[trackIndex] || baseFreq;
    this.lastMonophonicFreqByTrack[trackIndex] = baseFreq;
    const glideSec =
      synth.voice.glideTime > 0 && (noteEvent.glide || synth.voice.glideTrigger === 'always')
        ? synth.voice.glideTime / 1000
        : 0;

    // OSC 1 (with optional Unison / SuperSaw stack)
    if (synth.osc1.level > 0.01) {
      const unisonCount =
        synth.osc1.wave === 'supersaw' || synth.voice.mode === 'unison'
          ? Math.min(3, Math.max(2, synth.voice.unisonVoices))
          : 1;

      for (let u = 0; u < unisonCount; u++) {
        const osc1 = ctx.createOscillator();
        const osc1Gain = ctx.createGain();
        osc1.type =
          synth.osc1.wave === 'supersaw'
            ? 'sawtooth'
            : synth.osc1.wave === 'pwm'
              ? 'square'
              : synth.osc1.wave;

        const osc1Freq =
          baseFreq * Math.pow(2, synth.osc1.coarse / 12);
        if (glideSec > 0) {
          osc1.frequency.setValueAtTime(prevFreq, startTime);
          osc1.frequency.exponentialRampToValueAtTime(
            osc1Freq,
            startTime + glideSec
          );
        } else {
          osc1.frequency.setValueAtTime(osc1Freq, startTime);
        }

        const spreadDetune =
          unisonCount > 1
            ? (u - (unisonCount - 1) / 2) * synth.voice.unisonDetune
            : 0;
        osc1.detune.setValueAtTime(
          synth.osc1.fine + spreadDetune + slopCents,
          startTime
        );

        osc1Gain.gain.value = synth.osc1.level / Math.sqrt(unisonCount);
        osc1.connect(osc1Gain);
        osc1Gain.connect(filter);
        osc1.start(startTime);
        osc1.stop(stopTime);
        activeSourceNodes.push(osc1);

        // OSC 2 (Secondary + FM Modulator onto OSC 1 when u === 0)
        if (u === 0 && (synth.osc2.level > 0.01 || fmDepth > 0.01)) {
          const osc2 = ctx.createOscillator();
          osc2.type =
            synth.osc2.wave === 'supersaw' || synth.osc2.wave === 'pwm'
              ? 'sawtooth'
              : synth.osc2.wave;
          const osc2Freq =
            baseFreq * Math.pow(2, synth.osc2.coarse / 12);
          osc2.frequency.setValueAtTime(osc2Freq, startTime);
          osc2.detune.setValueAtTime(synth.osc2.fine, startTime);

          if (fmDepth > 0.01) {
            const fmGain = ctx.createGain();
            fmGain.gain.setValueAtTime(fmDepth * baseFreq * 2.5, startTime);
            osc2.connect(fmGain);
            fmGain.connect(osc1.frequency);
          }

          if (synth.osc2.level > 0.01) {
            const osc2Gain = ctx.createGain();
            osc2Gain.gain.value = synth.osc2.level * 0.7;
            osc2.connect(osc2Gain);
            osc2Gain.connect(filter);
          }

          osc2.start(startTime);
          osc2.stop(stopTime);
          activeSourceNodes.push(osc2);
        }
      }
    }

    // SUB 1 (-12 semitones)
    if (synth.sub1.level > 0.01) {
      const sub1 = ctx.createOscillator();
      const sub1Gain = ctx.createGain();
      sub1.type = synth.sub1.wave;
      sub1.frequency.setValueAtTime(baseFreq * 0.5, startTime);
      sub1Gain.gain.value = synth.sub1.level * 0.65;
      sub1.connect(sub1Gain);
      sub1Gain.connect(filter);
      sub1.start(startTime);
      sub1.stop(stopTime);
      activeSourceNodes.push(sub1);
    }

    // SUB 2 (-24, -12, or +7 semitones)
    if (synth.sub2.level > 0.01) {
      const sub2 = ctx.createOscillator();
      const sub2Gain = ctx.createGain();
      sub2.type = synth.sub2.wave;
      const ratio = Math.pow(2, synth.sub2.semitoneOffset / 12);
      sub2.frequency.setValueAtTime(baseFreq * ratio, startTime);
      sub2Gain.gain.value = synth.sub2.level * 0.5;
      sub2.connect(sub2Gain);
      sub2Gain.connect(filter);
      sub2.start(startTime);
      sub2.stop(stopTime);
      activeSourceNodes.push(sub2);
    }

    // NOISE GENERATOR (White / Pink / Metallic)
    if (synth.noise.level > 0.01 && this.noiseBuffers) {
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffers[synth.noise.type];
      noiseSrc.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = synth.noise.level * 0.75;
      noiseSrc.connect(noiseGain);
      noiseGain.connect(filter);
      noiseSrc.start(startTime);
      noiseSrc.stop(stopTime);
      activeSourceNodes.push(noiseSrc);
    }

    if (activeSourceNodes.length > 0) {
      activeSourceNodes[0].onended = () => {
        this.activeVoiceGains.delete(vca);
        filter.disconnect();
        vca.disconnect();
      };
    } else {
      this.activeVoiceGains.delete(vca);
    }
  }

  // ==========================================================================
  // INTERNAL LIVE RESAMPLER (1-4 Bars Capture & Pad Playback)
  // ==========================================================================

  public startResampling(): void {
    const ctx = this.ensureInitialized();
    if (!this.masterLimiter || this.isResamplingFlag) return;

    this.resamplerChunksL = [];
    this.resamplerChunksR = [];
    this.isResamplingFlag = true;

    const proc = ctx.createScriptProcessor(4096, 2, 2);
    const silent = ctx.createGain();
    silent.gain.value = 0;

    proc.onaudioprocess = (ev: AudioProcessingEvent) => {
      if (!this.isResamplingFlag) return;
      const inBuf = ev.inputBuffer;
      const l = inBuf.getChannelData(0);
      const r = inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : l;
      this.resamplerChunksL.push(new Float32Array(l));
      this.resamplerChunksR.push(new Float32Array(r));
    };

    this.masterLimiter.connect(proc);
    proc.connect(silent);
    silent.connect(ctx.destination);
    this.resamplerProcessor = proc;
  }

  public stopResampling(): boolean {
    if (!this.isResamplingFlag || !this.audioCtx) return false;
    this.isResamplingFlag = false;

    if (this.resamplerProcessor) {
      try {
        this.masterLimiter?.disconnect(this.resamplerProcessor);
        this.resamplerProcessor.disconnect();
      } catch {
        // Ignore
      }
      this.resamplerProcessor = null;
    }

    const totalLen = this.resamplerChunksL.reduce((a, b) => a + b.length, 0);
    if (totalLen === 0) return false;

    const buf = this.audioCtx.createBuffer(2, totalLen, this.audioCtx.sampleRate);
    const outL = buf.getChannelData(0);
    const outR = buf.getChannelData(1);
    let offset = 0;
    for (let i = 0; i < this.resamplerChunksL.length; i++) {
      outL.set(this.resamplerChunksL[i], offset);
      outR.set(this.resamplerChunksR[i], offset);
      offset += this.resamplerChunksL[i].length;
    }

    this.resamplerBuffer = buf;
    this.resamplerChunksL = [];
    this.resamplerChunksR = [];
    return true;
  }

  public hasResampledAudio(): boolean {
    return Boolean(this.resamplerBuffer);
  }

  public triggerResampledPad(): void {
    const ctx = this.ensureInitialized();
    if (!this.resamplerBuffer || !this.masterCompressor) return;
    const src = ctx.createBufferSource();
    src.buffer = this.resamplerBuffer;
    src.connect(this.masterCompressor);
    src.start();
  }

  public downloadResampledLoopWav(): void {
    if (!this.resamplerBuffer) return;
    const blob = encodeWav16BitStereo(
      this.resamplerBuffer.getChannelData(0),
      this.resamplerBuffer.getChannelData(1),
      this.resamplerBuffer.sampleRate
    );
    downloadAudioBlob(blob, `${this.projectRef.name}-resampled-loop.wav`);
  }

  // ==========================================================================
  // OFFLINE / SYNTHESIZED MASTER WAV & 8-TRACK STEM EXPORTER
  // ==========================================================================

  public exportRenderedPatternWav(isolatedTrackIndex?: number): void {
    const p = this.projectRef;
    const pat =
      p.patterns[p.activePatternId] ?? Object.values(p.patterns)[0];
    const sampleRate = 48000;
    const stepSec = 60 / Math.max(40, p.bpm) / 4;
    const totalSteps = (pat?.bars ?? 2) * 16;
    const durationSec = totalSteps * stepSec + 0.6;
    const totalSamples = Math.floor(sampleRate * durationSec);

    const left = new Float32Array(totalSamples);
    const right = new Float32Array(totalSamples);

    const tracksToRender =
      isolatedTrackIndex !== undefined
        ? [p.tracks[isolatedTrackIndex]]
        : p.tracks.filter((t) => !t.mixer.mute);

    for (const trk of tracksToRender) {
      if (!trk) continue;
      const seq = pat.tracks[trk.index];
      if (!seq) continue;

      for (let s = 0; s < totalSteps; s++) {
        const step = seq.steps[s % seq.lengthSteps];
        if (!step || !step.active) continue;

        const startSample = Math.floor(s * stepSec * sampleRate);
        for (const noteEv of step.notes) {
          const freq = midiToFreq(noteEv.midiNote);
          const noteDurSec = Math.max(
            0.08,
            trk.isDrum
              ? trk.synth.ampEnv.decay
              : noteEv.durationSteps * stepSec * 0.9
          );
          const noteSamples = Math.floor(noteDurSec * sampleRate);
          const gain = trk.mixer.volume * step.velocity * 0.25;
          const pan = trk.mixer.pan;
          const gainL = gain * Math.cos(((pan + 1) * Math.PI) / 4);
          const gainR = gain * Math.sin(((pan + 1) * Math.PI) / 4);

          for (let i = 0; i < noteSamples && startSample + i < totalSamples; i++) {
            const tSec = i / sampleRate;
            const env = Math.exp(-tSec / Math.max(0.04, noteDurSec * 0.45));
            const curFreq =
              trk.index === 0 ? freq * (1 + 2.2 * Math.exp(-tSec * 38)) : freq;
            const rawSample =
              trk.index === 2
                ? (Math.random() * 2 - 1) * env
                : Math.sin(2 * Math.PI * curFreq * tSec) * env;
            left[startSample + i] += rawSample * gainL;
            right[startSample + i] += rawSample * gainR;
          }
        }
      }
    }

    const blob = encodeWav16BitStereo(left, right, sampleRate);
    const safeProj = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (isolatedTrackIndex !== undefined) {
      const trkName =
        p.tracks[isolatedTrackIndex]?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ??
        `track-${isolatedTrackIndex + 1}`;
      downloadAudioBlob(
        blob,
        `${safeProj}-stem-0${isolatedTrackIndex + 1}-${trkName}.wav`
      );
    } else {
      downloadAudioBlob(
        blob,
        `${safeProj}-${p.activePatternId.toLowerCase()}-master-48khz.wav`
      );
    }
  }

  public exportAll8StemsWav(): void {
    for (let i = 0; i < 8; i++) {
      window.setTimeout(() => {
        this.exportRenderedPatternWav(i);
      }, i * 220);
    }
  }

  public async dispose(): Promise<void> {
    this.stop();
    if (this.resamplerProcessor) {
      try {
        this.resamplerProcessor.disconnect();
      } catch {
        // Ignore
      }
      this.resamplerProcessor = null;
    }
    this.playheadListeners.clear();
    const ctx = this.audioCtx;
    const gain = this.masterGain;
    this.audioCtx = null;
    this.masterGain = null;
    await audioGuard.gracefulCloseContext(ctx, gain, 20);
  }

  private notifyPlayhead(globalStep: number, trackSteps: number[]): void {
    for (const listener of this.playheadListeners) {
      listener(globalStep, trackSteps);
    }
  }
}
