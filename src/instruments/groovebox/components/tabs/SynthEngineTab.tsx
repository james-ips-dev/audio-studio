import React, { useEffect, useRef, useState } from 'react';
import { RotaryKnob } from '../../../../shared-ui/RotaryKnob';
import type { GrooveboxAudioEngine } from '../../audio/GrooveboxAudioEngine';
import {
  applyBeginnerMacroToSynth,
  TRACK_PRESET_BANKS,
} from '../../presets/factoryPresets';
import type {
  FilterType,
  GrooveboxProject,
  ModMatrixDestination,
  ModMatrixSource,
  OscillatorWave,
  ProSynthConfig,
  TrackConfig,
  VoiceMode,
} from '../../types';

export interface SynthEngineTabProps {
  project: GrooveboxProject;
  track: TrackConfig;
  engine: GrooveboxAudioEngine;
  pLockLatch: boolean;
  selectedStep: { trackIndex: number; stepIndex: number } | null;
  onUpdateTrackSynth: (
    trackIndex: number,
    updater: (prev: ProSynthConfig) => ProSynthConfig,
    presetNameOverride?: string
  ) => void;
  onWriteStepPLock: (paramKey: string, val: number) => void;
  onAuditionHit: (trackIndex: number) => void;
}

const WAVEFORMS: OscillatorWave[] = [
  'sine',
  'triangle',
  'sawtooth',
  'square',
  'pwm',
  'supersaw',
];
const FILTER_TYPES: FilterType[] = ['lp12', 'lp24', 'bp12', 'hp12', 'notch'];
const VOICE_MODES: VoiceMode[] = ['mono', 'poly', 'unison'];
const MOD_SOURCES: ModMatrixSource[] = [
  'lfo1',
  'lfo2',
  'filterEnv',
  'modEnv',
  'modSeq',
  'velocity',
  'keyTrack',
  'voiceRandom',
  'osc2Fm',
  'kaossX',
  'kaossY',
];
const MOD_DESTS: ModMatrixDestination[] = [
  'cutoff',
  'resonance',
  'drive',
  'osc1Pitch',
  'osc2Pitch',
  'pwm',
  'fmCrossMod',
  'osc1Level',
  'sub1Level',
  'pan',
  'unisonDetune',
  'reverbSend',
  'delaySend',
];

export const SynthEngineTab: React.FC<SynthEngineTabProps> = ({
  project,
  track,
  engine,
  pLockLatch,
  selectedStep,
  onUpdateTrackSynth,
  onWriteStepPLock,
  onAuditionHit,
}) => {
  const [mutatedSparkle, setMutatedSparkle] = useState(false);
  const [abSnapshot, setAbSnapshot] = useState<ProSynthConfig | null>(null);
  const [isComparingB, setIsComparingB] = useState(false);

  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Zero-Crossing Oscilloscope Canvas Renderer (30fps in ECO mode, 60fps in normal)
  useEffect(() => {
    const canvas = scopeCanvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    let rafId = 0;
    let lastDraw = 0;
    const intervalMs = project.ecoMode ? 33 : 16;
    const buf = new Float32Array(512);

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);
      if (ts - lastDraw < intervalMs) return;
      lastDraw = ts;

      const w = canvas.width;
      const h = canvas.height;
      ctx2d.fillStyle = '#0A0C12';
      ctx2d.fillRect(0, 0, w, h);

      // Center grid line
      ctx2d.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, h / 2);
      ctx2d.lineTo(w, h / 2);
      ctx2d.stroke();

      const masterAnalyser = engine.getMasterAnalyser();
      if (masterAnalyser) {
        masterAnalyser.getFloatTimeDomainData(buf);
      }

      // Find zero crossing for stable waveform display
      let zeroIdx = 0;
      for (let i = 1; i < 256; i++) {
        if (buf[i - 1] < 0 && buf[i] >= 0) {
          zeroIdx = i;
          break;
        }
      }

      ctx2d.strokeStyle = track.color;
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      const drawSamples = 220;
      for (let i = 0; i < drawSamples; i++) {
        const x = (i / (drawSamples - 1)) * w;
        const sample = masterAnalyser
          ? buf[zeroIdx + i] || 0
          : Math.sin((i / 28) * Math.PI * 2 + ts * 0.005) *
            0.35 *
            track.synth.beginnerMacros.cutoff;
        const y = h / 2 - sample * (h * 0.42);
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.stroke();
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [engine, project.ecoMode, track.color, track.synth.beginnerMacros.cutoff]);

  const handleMacroChange = (
    key: keyof ProSynthConfig['beginnerMacros'],
    val: number
  ) => {
    if (pLockLatch && selectedStep?.trackIndex === track.index) {
      if (key === 'cutoff') {
        onWriteStepPLock('cutoff', Math.round(40 * Math.pow(18000 / 40, val)));
      } else if (key === 'resonance') {
        onWriteStepPLock('resonance', Number((0.5 + val * 15.5).toFixed(2)));
      } else if (key === 'fmDirt') {
        onWriteStepPLock('fmDirt', Number((val * 0.85).toFixed(2)));
      } else if (key === 'ampDecay') {
        onWriteStepPLock('ampDecay', Number((val * 1.25).toFixed(3)));
      }
    }

    onUpdateTrackSynth(track.index, (prev) =>
      applyBeginnerMacroToSynth(prev, key, val)
    );
  };

  const handleMutate = () => {
    setAbSnapshot(track.synth);
    setMutatedSparkle(true);
    window.setTimeout(() => setMutatedSparkle(false), 750);

    onUpdateTrackSynth(track.index, (prev) => {
      let next = { ...prev };
      const jitter = (base: number, span: number, min = 0, max = 1) =>
        Math.min(max, Math.max(min, base + (Math.random() * 2 - 1) * span));

      next = applyBeginnerMacroToSynth(
        next,
        'cutoff',
        jitter(prev.beginnerMacros.cutoff, 0.25)
      );
      next = applyBeginnerMacroToSynth(
        next,
        'resonance',
        jitter(prev.beginnerMacros.resonance, 0.22)
      );
      next = applyBeginnerMacroToSynth(
        next,
        'fmDirt',
        jitter(prev.beginnerMacros.fmDirt, 0.25)
      );
      next = applyBeginnerMacroToSynth(
        next,
        'ampDecay',
        jitter(prev.beginnerMacros.ampDecay, 0.2, 0.06, 0.95)
      );
      next = applyBeginnerMacroToSynth(
        next,
        'detune',
        jitter(prev.beginnerMacros.detune, 0.25)
      );
      return next;
    });
    onAuditionHit(track.index);
  };

  const handleCyclePreset = (dir: -1 | 1) => {
    const bank = TRACK_PRESET_BANKS[track.index] ?? [];
    if (bank.length === 0) return;
    const currentIdx = bank.findIndex((p) => p.name === track.presetName);
    const nextIdx = (currentIdx + dir + bank.length) % bank.length;
    const chosen = bank[nextIdx];

    onUpdateTrackSynth(
      track.index,
      (prev) => {
        let next = { ...prev };
        for (const [k, v] of Object.entries(chosen.overrides)) {
          if (v !== undefined) {
            next = applyBeginnerMacroToSynth(
              next,
              k as keyof ProSynthConfig['beginnerMacros'],
              v
            );
          }
        }
        return next;
      },
      chosen.name
    );
    onAuditionHit(track.index);
  };

  const handleToggleABCompare = () => {
    if (!abSnapshot) {
      setAbSnapshot(track.synth);
      return;
    }
    const current = track.synth;
    setAbSnapshot(current);
    setIsComparingB((v) => !v);
    onUpdateTrackSynth(track.index, () => abSnapshot);
  };

  const isPro = project.mode === 'pro';
  const s = track.synth;

  // Beginner Mode View
  if (!isPro) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full">
        {/* Left: Preset Browser, Live Zero-Crossing Oscilloscope & ADSR Mountain */}
        <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#151821] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className="px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold text-black"
                style={{ backgroundColor: track.color }}
              >
                TRK {track.index + 1} // {track.name}
              </span>
              <div className="flex items-center bg-black/50 rounded border border-white/10">
                <button
                  type="button"
                  onClick={() => handleCyclePreset(-1)}
                  className="px-1.5 py-0.5 text-xs text-gray-300 hover:text-white cursor-pointer"
                >
                  ◀
                </button>
                <span className="px-2 font-studio-mono text-[11px] font-bold text-white truncate max-w-[130px]">
                  {track.presetName}
                </span>
                <button
                  type="button"
                  onClick={() => handleCyclePreset(1)}
                  className="px-1.5 py-0.5 text-xs text-gray-300 hover:text-white cursor-pointer"
                >
                  ▶
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onAuditionHit(track.index)}
                style={{ backgroundColor: track.color }}
                className="px-2.5 py-1 rounded font-studio-mono text-[10px] font-bold text-black cursor-pointer shadow"
              >
                🔊 HIT
              </button>
              <button
                type="button"
                onClick={handleMutate}
                className="px-2.5 py-1 rounded bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/50 font-studio-mono text-[10px] font-bold text-amber-300 cursor-pointer"
              >
                🎲 MUTATE
              </button>
              <button
                type="button"
                onClick={handleToggleABCompare}
                className={`px-2 py-1 rounded font-studio-mono text-[10px] font-bold border cursor-pointer ${
                  isComparingB
                    ? 'bg-sky-400 text-black border-sky-300'
                    : 'bg-white/5 text-gray-300 border-white/10'
                }`}
              >
                A/B
              </button>
            </div>
          </div>

          {/* Live Zero-Crossing Oscilloscope + ADSR Mountain */}
          <div className="grid grid-cols-2 gap-2 my-2 flex-1 min-h-[90px]">
            <div className="relative rounded-lg overflow-hidden border border-white/10 bg-[#0A0C12] flex items-center justify-center">
              <canvas
                ref={scopeCanvasRef}
                width={260}
                height={100}
                className="w-full h-full"
              />
              <span className="absolute top-1 left-1.5 text-[8px] font-studio-mono uppercase text-gray-500">
                ZERO-CROSSING SCOPE
              </span>
            </div>

            {/* Interactive SVG ADSR Mountain */}
            <div className="relative rounded-lg border border-white/10 bg-[#0A0C12] p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[8px] font-studio-mono text-gray-500">
                <span>ADSR ENVELOPE MOUNTAIN</span>
                {(track.index === 0 || track.index === 3) && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrackSynth(track.index, (prev) => ({
                        ...prev,
                        voice: {
                          ...prev.voice,
                          keyTunedDrum: !prev.voice.keyTunedDrum,
                        },
                      }))
                    }
                    className={`px-1.5 py-0.2 rounded font-bold cursor-pointer ${
                      s.voice.keyTunedDrum
                        ? 'bg-emerald-400 text-black'
                        : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    KEY LOCK
                  </button>
                )}
              </div>
              <svg viewBox="0 0 200 70" className="w-full h-14 overflow-visible">
                <defs>
                  <linearGradient id="adsrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={track.color} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={track.color} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {(() => {
                  const ax = Math.min(45, 8 + s.ampEnv.attack * 120);
                  const dx = ax + Math.min(70, 12 + s.ampEnv.decay * 55);
                  const sy = 64 - s.ampEnv.sustain * 48;
                  const rx = Math.min(195, dx + 35 + s.ampEnv.release * 45);
                  const pathD = `M 4 64 L ${ax} 8 L ${dx} ${sy} L ${dx + 25} ${sy} L ${rx} 64 Z`;
                  return (
                    <>
                      <path d={pathD} fill="url(#adsrGrad)" />
                      <path
                        d={`M 4 64 L ${ax} 8 L ${dx} ${sy} L ${dx + 25} ${sy} L ${rx} 64`}
                        fill="none"
                        stroke={track.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          <div className="text-[10px] font-studio-mono text-gray-400 flex items-center justify-between">
            <span>
              {pLockLatch
                ? '🔒 P-LOCK ACTIVE: Drag any macro to lock onto selected step'
                : 'SHARED SYNTH ENGINE: Edits sync automatically with STUDIO mode'}
            </span>
          </div>
        </div>

        {/* Right: 6 Large Visual Macro Controls with Dual-Layer Friendly Labels */}
        <div
          className={`lg:col-span-7 rounded-xl border p-3 flex flex-col justify-between transition-all ${
            mutatedSparkle
              ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
              : 'border-white/10 bg-[#151821]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-studio-mono text-[10px] font-bold uppercase tracking-wider text-gray-300">
              6 DUAL-LAYER FRIENDLY SYNTH MACROS
            </span>
            {mutatedSparkle && (
              <span className="font-studio-mono text-[10px] font-bold text-amber-300 animate-bounce">
                ✨ MUTATED!
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 py-2 my-auto place-items-center">
            <RotaryKnob
              label="CUTOFF"
              subtitle="Brightness ☀️"
              value={s.beginnerMacros.cutoff}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.6}
              accentColor={track.color}
              formatValue={() => `${Math.round(s.filter.cutoff)}Hz`}
              onChange={(v) => handleMacroChange('cutoff', v)}
            />
            <RotaryKnob
              label="RESONANCE"
              subtitle="Laser Squelch 🛸"
              value={s.beginnerMacros.resonance}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.2}
              accentColor={track.color}
              formatValue={() => `${s.filter.resonance.toFixed(1)}Q`}
              onChange={(v) => handleMacroChange('resonance', v)}
            />
            <RotaryKnob
              label="FM DIRT"
              subtitle="Robot Grit 🤖"
              value={s.beginnerMacros.fmDirt}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.2}
              accentColor={track.color}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => handleMacroChange('fmDirt', v)}
            />
            <RotaryKnob
              label="AMP DECAY"
              subtitle="Tail Length ☄️"
              value={s.beginnerMacros.ampDecay}
              min={0.03}
              max={1}
              step={0.01}
              defaultValue={0.3}
              accentColor={track.color}
              formatValue={() => `${Math.round(s.ampEnv.decay * 1000)}ms`}
              onChange={(v) => handleMacroChange('ampDecay', v)}
            />
            <RotaryKnob
              label="PITCH ENV"
              subtitle="Zap Punch ⚡"
              value={s.beginnerMacros.pitchEnv}
              min={-1}
              max={1}
              step={0.01}
              defaultValue={0.35}
              bipolar
              accentColor={track.color}
              formatValue={(v) =>
                `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`
              }
              onChange={(v) => handleMacroChange('pitchEnv', v)}
            />
            <RotaryKnob
              label="DETUNE"
              subtitle="Super Wide 🌈"
              value={s.beginnerMacros.detune}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.2}
              accentColor={track.color}
              formatValue={() => `${s.voice.unisonDetune}ct`}
              onChange={(v) => handleMacroChange('detune', v)}
            />
          </div>

          <div className="text-[10px] font-studio-mono text-gray-500 flex justify-between">
            <span>Hold Shift: 10× Fine Control</span>
            <span>Double-Click Knob: Reset to Default</span>
          </div>
        </div>
      </div>
    );
  }

  // PRO (STUDIO) Mode: Full Multi-Oscillator Synthesizer + Envelopes + 8-Slot Mod Matrix
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 h-full overflow-y-auto pr-1">
      {/* Module 1 & 2: Voice/Glide + 4-Oscillator & Noise Mixer */}
      <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className="px-1.5 py-0.5 rounded font-studio-mono text-[10px] font-bold text-black"
              style={{ backgroundColor: track.color }}
            >
              {track.name} PRO SYNTH
            </span>
            <select
              aria-label="Voice Mode"
              value={s.voice.mode}
              onChange={(e) => {
                const mode = e.target.value as VoiceMode;
                onUpdateTrackSynth(track.index, (prev) => ({
                  ...prev,
                  voice: { ...prev.voice, mode },
                }));
              }}
              className="bg-black/60 rounded border border-white/15 px-1.5 py-0.5 font-studio-mono text-[10px] text-white cursor-pointer"
            >
              {VOICE_MODES.map((m) => (
                <option key={m} value={m} className="bg-[#12151E]">
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAuditionHit(track.index)}
              style={{ backgroundColor: track.color }}
              className="px-2 py-0.5 rounded font-studio-mono text-[10px] font-bold text-black cursor-pointer"
            >
              AUDITION
            </button>
            <button
              type="button"
              onClick={handleMutate}
              className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-studio-mono text-[10px] font-bold cursor-pointer"
            >
              🎲 MUTATE
            </button>
          </div>
        </div>

        {/* Osc 1 & Osc 2 Wave Selectors */}
        <div className="grid grid-cols-2 gap-2 my-1.5 text-[10px] font-studio-mono">
          <div className="flex items-center justify-between bg-black/35 px-2 py-1 rounded border border-white/5">
            <span className="text-gray-400">OSC 1:</span>
            <select
              value={s.osc1.wave}
              onChange={(e) => {
                const wave = e.target.value as OscillatorWave;
                onUpdateTrackSynth(track.index, (prev) => ({
                  ...prev,
                  osc1: { ...prev.osc1, wave },
                }));
              }}
              className="bg-transparent text-sky-300 font-bold cursor-pointer"
            >
              {WAVEFORMS.map((w) => (
                <option key={w} value={w} className="bg-[#12151E]">
                  {w.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between bg-black/35 px-2 py-1 rounded border border-white/5">
            <span className="text-gray-400">OSC 2:</span>
            <select
              value={s.osc2.wave}
              onChange={(e) => {
                const wave = e.target.value as OscillatorWave;
                onUpdateTrackSynth(track.index, (prev) => ({
                  ...prev,
                  osc2: { ...prev.osc2, wave },
                }));
              }}
              className="bg-transparent text-amber-300 font-bold cursor-pointer"
            >
              {WAVEFORMS.map((w) => (
                <option key={w} value={w} className="bg-[#12151E]">
                  {w.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4-Oscillator + Noise Mixer & Glide Knobs */}
        <div className="grid grid-cols-6 gap-1.5 place-items-center py-1">
          <RotaryKnob
            label="OSC 1 LVL"
            size="sm"
            value={s.osc1.level}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.85}
            accentColor={track.color}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(level) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                osc1: { ...prev.osc1, level },
              }))
            }
          />
          <RotaryKnob
            label="OSC 2 LVL"
            size="sm"
            value={s.osc2.level}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.5}
            accentColor={track.color}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(level) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                osc2: { ...prev.osc2, level },
              }))
            }
          />
          <RotaryKnob
            label="OSC2→1 FM"
            size="sm"
            value={s.osc2.fmDepth}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.2}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(fmDepth) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                osc2: { ...prev.osc2, fmDepth },
              }))
            }
          />
          <RotaryKnob
            label="SUB 1 (-1)"
            size="sm"
            value={s.sub1.level}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.6}
            accentColor="#00E5FF"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(level) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                sub1: { ...prev.sub1, level },
              }))
            }
          />
          <RotaryKnob
            label="SUB 2 (-2)"
            size="sm"
            value={s.sub2.level}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.25}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(level) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                sub2: { ...prev.sub2, level },
              }))
            }
          />
          <RotaryKnob
            label="NOISE"
            size="sm"
            value={s.noise.level}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.1}
            accentColor="#EC4899"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(level) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                noise: { ...prev.noise, level },
              }))
            }
          />
        </div>
      </div>

      {/* Module 3 & 4: Multimode Filter + Drive + AMP/FILTER Envelopes */}
      <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <span className="font-studio-mono text-[10px] font-bold uppercase text-sky-400">
            ZDF FILTER &amp; DUAL ENVELOPES
          </span>
          <select
            aria-label="Filter Topology"
            value={s.filter.type}
            onChange={(e) => {
              const type = e.target.value as FilterType;
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                filter: { ...prev.filter, type },
              }));
            }}
            className="bg-black/60 rounded border border-white/15 px-1.5 py-0.5 font-studio-mono text-[10px] text-sky-300 font-bold cursor-pointer"
          >
            {FILTER_TYPES.map((ft) => (
              <option key={ft} value={ft} className="bg-[#12151E]">
                {ft.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-4 gap-1.5 place-items-center py-1">
          <RotaryKnob
            label="CUTOFF"
            size="sm"
            value={s.filter.cutoff}
            min={40}
            max={18000}
            step={10}
            defaultValue={2400}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(cutoff) => {
              if (pLockLatch && selectedStep?.trackIndex === track.index) {
                onWriteStepPLock('cutoff', cutoff);
              }
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                filter: { ...prev.filter, cutoff },
              }));
            }}
          />
          <RotaryKnob
            label="RESO"
            size="sm"
            value={s.filter.resonance}
            min={0.5}
            max={18}
            step={0.1}
            defaultValue={2.5}
            accentColor="#38BDF8"
            formatValue={(v) => `${v.toFixed(1)}Q`}
            onChange={(resonance) => {
              if (pLockLatch && selectedStep?.trackIndex === track.index) {
                onWriteStepPLock('resonance', resonance);
              }
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                filter: { ...prev.filter, resonance },
              }));
            }}
          />
          <RotaryKnob
            label="DRIVE"
            size="sm"
            value={s.filter.drive}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.2}
            accentColor="#F43F5E"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(drive) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                filter: { ...prev.filter, drive },
              }))
            }
          />
          <RotaryKnob
            label="ENV AMT"
            size="sm"
            value={s.filter.envDepth}
            min={-1}
            max={1}
            step={0.01}
            defaultValue={0.4}
            bipolar
            accentColor="#FBBF24"
            formatValue={(v) =>
              `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`
            }
            onChange={(envDepth) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                filter: { ...prev.filter, envDepth },
              }))
            }
          />
        </div>

        {/* ADSR Knobs */}
        <div className="grid grid-cols-4 gap-1.5 place-items-center pt-1 border-t border-white/5">
          <RotaryKnob
            label="ATTACK"
            size="sm"
            value={s.ampEnv.attack}
            min={0.001}
            max={0.8}
            step={0.005}
            defaultValue={0.005}
            accentColor="#34D399"
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(attack) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                ampEnv: { ...prev.ampEnv, attack },
              }))
            }
          />
          <RotaryKnob
            label="DECAY"
            size="sm"
            value={s.ampEnv.decay}
            min={0.03}
            max={1.5}
            step={0.01}
            defaultValue={0.3}
            accentColor="#34D399"
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(decay) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                ampEnv: { ...prev.ampEnv, decay },
              }))
            }
          />
          <RotaryKnob
            label="SUSTAIN"
            size="sm"
            value={s.ampEnv.sustain}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.4}
            accentColor="#34D399"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(sustain) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                ampEnv: { ...prev.ampEnv, sustain },
              }))
            }
          />
          <RotaryKnob
            label="RELEASE"
            size="sm"
            value={s.ampEnv.release}
            min={0.02}
            max={1.8}
            step={0.01}
            defaultValue={0.2}
            accentColor="#34D399"
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(release) =>
              onUpdateTrackSynth(track.index, (prev) => ({
                ...prev,
                ampEnv: { ...prev.ampEnv, release },
              }))
            }
          />
        </div>
      </div>

      {/* Module 5 & 6: 8-Slot Visual Modulation Matrix */}
      <div className="lg:col-span-3 rounded-xl border border-white/10 bg-[#151821] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-white/10 pb-1">
          <span className="font-studio-mono text-[10px] font-bold uppercase text-amber-400">
            8-SLOT MOD MATRIX
          </span>
          <span className="text-[9px] font-studio-mono text-gray-500">
            SRC → DEPTH → DEST
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 my-1 max-h-[165px] pr-0.5">
          {s.modMatrix.slice(0, 5).map((slot) => (
            <div
              key={slot.id}
              className="grid grid-cols-[18px_1fr_54px_1fr] gap-1 items-center bg-black/40 px-1.5 py-1 rounded border border-white/5 font-studio-mono text-[9px]"
            >
              <input
                type="checkbox"
                checked={slot.enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  onUpdateTrackSynth(track.index, (prev) => ({
                    ...prev,
                    modMatrix: prev.modMatrix.map((m) =>
                      m.id === slot.id ? { ...m, enabled } : m
                    ),
                  }));
                }}
                className="accent-amber-400 cursor-pointer"
              />
              <select
                value={slot.source}
                onChange={(e) => {
                  const source = e.target.value as ModMatrixSource;
                  onUpdateTrackSynth(track.index, (prev) => ({
                    ...prev,
                    modMatrix: prev.modMatrix.map((m) =>
                      m.id === slot.id ? { ...m, source } : m
                    ),
                  }));
                }}
                className="bg-black/60 text-sky-300 rounded px-1 py-0.5 truncate cursor-pointer"
              >
                {MOD_SOURCES.map((src) => (
                  <option key={src} value={src} className="bg-[#12151E]">
                    {src}
                  </option>
                ))}
              </select>

              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={slot.depth}
                onChange={(e) => {
                  const depth = Number(e.target.value);
                  onUpdateTrackSynth(track.index, (prev) => ({
                    ...prev,
                    modMatrix: prev.modMatrix.map((m) =>
                      m.id === slot.id ? { ...m, depth } : m
                    ),
                  }));
                }}
                className="w-full accent-amber-400 cursor-pointer"
                title={`Depth: ${Math.round(slot.depth * 100)}%`}
              />

              <select
                value={slot.destination}
                onChange={(e) => {
                  const destination = e.target.value as ModMatrixDestination;
                  onUpdateTrackSynth(track.index, (prev) => ({
                    ...prev,
                    modMatrix: prev.modMatrix.map((m) =>
                      m.id === slot.id ? { ...m, destination } : m
                    ),
                  }));
                }}
                className="bg-black/60 text-amber-300 rounded px-1 py-0.5 truncate cursor-pointer"
              >
                {MOD_DESTS.map((dst) => (
                  <option key={dst} value={dst} className="bg-[#12151E]">
                    {dst}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
