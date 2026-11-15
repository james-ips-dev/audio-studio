import React, { useEffect, useRef } from 'react';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import {
  AETHER_DRONE_PRESETS,
  computeEuclideanSteps,
} from '../presets/factoryPatches';
import type { Aether8Telemetry } from '../audio/Aether8AudioEngine';
import type {
  Aether8PatchV4,
  ChordVoicingType,
  NoiseSpectrumColor,
  SignalDomain,
  ZdfFilterMode,
} from '../types';
import { PatchJackButton } from './PatchJackButton';

export interface Row2DroneNoiseFilterProps {
  patch: Aether8PatchV4;
  telemetry: Aether8Telemetry;
  activeFromJack: {
    jackId: string;
    domain: SignalDomain;
    originalSourceJackId?: string;
  } | null;
  onToggleClockExtMode: () => void;
  onSetChordVoicing: (voicing: ChordVoicingType) => void;
  onSelectDronePreset?: (presetName: string) => void;
  onSetNoiseColor: (color: NoiseSpectrumColor) => void;
  onSetFilterMode: (mode: ZdfFilterMode) => void;
  onUpdateModuleParam: (moduleKey: string, paramKey: string, val: number) => void;
  onSelectJack: (
    jackId: string,
    direction: 'in' | 'out',
    domain: SignalDomain
  ) => void;
  onRemoveJackCables: (jackId: string) => void;
  onRemoveSingleCable?: (cableId: string) => void;
  onStartDaisyChain?: (
    fromEndpointJackId: string,
    originalSourceJackId: string,
    domain: SignalDomain
  ) => void;
}

export const Row2DroneNoiseFilter: React.FC<Row2DroneNoiseFilterProps> = ({
  patch,
  telemetry,
  activeFromJack,
  onToggleClockExtMode,
  onSetChordVoicing,
  onSelectDronePreset,
  onSetNoiseColor,
  onSetFilterMode,
  onUpdateModuleParam,
  onSelectJack,
  onRemoveJackCables,
  onRemoveSingleCable,
  onStartDaisyChain,
}) => {
  const euclidCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const euclidPrm = patch.params.euclid ?? {
    stepsA: 16,
    hitsA: 5,
    hitsB: 3,
    humanize: 0.12,
  };
  const dronePrm = patch.params.drone ?? {};
  const noisePrm = patch.params.noise ?? {};
  const filtPrm = patch.params.filter ?? {};

  // Live Geometric Euclidean Ring Canvas
  useEffect(() => {
    const canvas = euclidCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 10;

    ctx.fillStyle = '#090C12';
    ctx.fillRect(0, 0, w, h);

    const n = Math.max(4, Math.round(euclidPrm.stepsA || 16));
    const hits = computeEuclideanSteps(n, Math.round(euclidPrm.hitsA || 5), 0);

    // Outer circle
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Polygon connecting active Euclidean hits
    const hitPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + r * Math.cos(ang);
      const py = cy + r * Math.sin(ang);
      if (hits[i]) {
        hitPoints.push({ x: px, y: py });
      }
    }

    if (hitPoints.length >= 2) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      hitPoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Step dots & playhead
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + r * Math.cos(ang);
      const py = cy + r * Math.sin(ang);
      const isPlayhead = telemetry.euclidStep % n === i;

      ctx.beginPath();
      ctx.arc(px, py, isPlayhead ? 4.5 : hits[i] ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isPlayhead
        ? '#FFFFFF'
        : hits[i]
          ? '#38BDF8'
          : 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
  }, [euclidPrm.stepsA, euclidPrm.hitsA, telemetry.euclidStep]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
      {/* ====================================================================
          03 // EUCLIDEAN & TIME DIVIDER
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-sky-400">
            03 // EUCLIDEAN &amp; CLOCK
          </span>
          <button
            type="button"
            onClick={onToggleClockExtMode}
            className={`px-2 py-0.5 rounded font-studio-mono text-[9px] font-bold cursor-pointer ${
              patch.clockExtStepMode
                ? 'bg-rose-500 text-black'
                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
            }`}
            title="Switch between Internal Master BPM and External Beat-Step Triggering"
          >
            {patch.clockExtStepMode ? 'EXT BEAT STEP' : 'INT BPM'}
          </button>
        </div>

        <div className="flex items-center gap-2 my-1.5">
          <canvas
            ref={euclidCanvasRef}
            width={88}
            height={88}
            className="rounded-lg border border-white/10 shrink-0"
          />
          <div className="grid grid-cols-2 gap-1.5 flex-1 place-items-center">
            <RotaryKnob
              label="STEPS A"
              size="sm"
              value={euclidPrm.stepsA}
              min={4}
              max={16}
              step={1}
              defaultValue={16}
              accentColor="#38BDF8"
              onChange={(v) => onUpdateModuleParam('euclid', 'stepsA', v)}
            />
            <RotaryKnob
              label="HITS A"
              size="sm"
              value={euclidPrm.hitsA}
              min={1}
              max={16}
              step={1}
              defaultValue={5}
              accentColor="#38BDF8"
              onChange={(v) => onUpdateModuleParam('euclid', 'hitsA', v)}
            />
            <RotaryKnob
              label="HITS B"
              size="sm"
              value={euclidPrm.hitsB}
              min={1}
              max={16}
              step={1}
              defaultValue={3}
              accentColor="#F59E0B"
              onChange={(v) => onUpdateModuleParam('euclid', 'hitsB', v)}
            />
            <RotaryKnob
              label="HUMANIZE"
              size="sm"
              value={euclidPrm.humanize}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.12}
              accentColor="#34D399"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onUpdateModuleParam('euclid', 'humanize', v)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'clock:stepIn', label: 'STEP IN', dir: 'in' as const },
            { id: 'clock:resetIn', label: 'RESET IN', dir: 'in' as const },
            { id: 'clock:euclidA', label: 'EUCLID A', dir: 'out' as const },
            { id: 'clock:euclidB', label: 'EUCLID B', dir: 'out' as const },
            { id: 'clock:bar24', label: '2/4 BAR', dir: 'out' as const },
          ].map((j) => (
            <PatchJackButton
              key={j.id}
              jackId={j.id}
              label={j.label}
              direction={j.dir}
              domain="trig"
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
          ))}
        </div>
      </div>

      {/* ====================================================================
          04 // HARMONIC DRONE BANK (4-VCO Analog Swarm + Dual Subs + 20 Presets)
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex flex-col gap-1 pb-1.5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <span className="font-studio-mono text-[10px] font-bold text-sky-400">
              04 // HARMONIC DRONE BANK
            </span>
            <div className="flex items-center gap-0.5 font-studio-mono text-[9px]">
              {(['unison', 'fifth', 'min7', 'min9'] as ChordVoicingType[]).map(
                (cv) => (
                  <button
                    key={cv}
                    type="button"
                    onClick={() => onSetChordVoicing(cv)}
                    className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                      patch.chordType === cv
                        ? 'bg-sky-400 text-black font-bold'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {cv}
                  </button>
                )
              )}
            </div>
          </div>
          {onSelectDronePreset && (
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-studio-mono text-[9px] text-gray-400 uppercase shrink-0">
                20 DRONE PRESETS:
              </span>
              <select
                value={patch.dronePresetName ?? ''}
                onChange={(e) => {
                  if (e.target.value) onSelectDronePreset(e.target.value);
                }}
                className="flex-1 px-1.5 py-0.5 rounded bg-black/50 border border-sky-500/30 font-studio-mono text-[9px] text-sky-200 cursor-pointer"
                title="20 Harmonic Drone Presets (10 Soft Silk + 10 Harsh)"
              >
                <option value="" disabled>
                  Select Drone Preset (20)...
                </option>
                <optgroup label="☁️ 10 Soft Silk Drone Presets">
                  {AETHER_DRONE_PRESETS.filter((p) => p.modeTag === 'soft').map(
                    (p) => (
                      <option key={p.name} value={p.name}>
                        ☁️ {p.name}
                      </option>
                    )
                  )}
                </optgroup>
                <optgroup label="⚡ 10 Harsh Drone Presets">
                  {AETHER_DRONE_PRESETS.filter((p) => p.modeTag === 'harsh').map(
                    (p) => (
                      <option key={p.name} value={p.name}>
                        ⚡ {p.name}
                      </option>
                    )
                  )}
                </optgroup>
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="BASE FREQ"
            size="sm"
            value={dronePrm.baseFreq ?? 55}
            min={32}
            max={165}
            step={0.5}
            defaultValue={55}
            accentColor="#38BDF8"
            formatValue={(v) => `${v.toFixed(1)}Hz`}
            onChange={(v) => onUpdateModuleParam('drone', 'baseFreq', v)}
          />
          <RotaryKnob
            label="DRIFT / DET"
            size="sm"
            value={dronePrm.driftDetune ?? 14}
            min={0}
            max={35}
            step={0.5}
            defaultValue={14}
            accentColor="#38BDF8"
            formatValue={(v) => `${v.toFixed(1)}ct`}
            onChange={(v) => onUpdateModuleParam('drone', 'driftDetune', v)}
          />
          <RotaryKnob
            label="SUB -1/-2"
            size="sm"
            value={dronePrm.subLevel ?? 0.72}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.72}
            accentColor="#0284C7"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('drone', 'subLevel', v)}
          />
          <RotaryKnob
            label="WAVE FOLD"
            size="sm"
            value={dronePrm.waveFold ?? 0.24}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.24}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('drone', 'waveFold', v)}
          />
          <RotaryKnob
            label="FM INDEX"
            size="sm"
            value={dronePrm.fmIndex ?? 0.18}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.18}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('drone', 'fmIndex', v)}
          />
          <RotaryKnob
            label="SWARM LVL"
            size="sm"
            value={dronePrm.swarmLevel ?? 0.78}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.78}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('drone', 'swarmLevel', v)}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'drone:pitchCv', label: 'PITCH', dir: 'in' as const, dom: 'cv' as const },
            { id: 'drone:fmCv', label: 'FM CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'drone:spreadCv', label: 'SPREAD', dir: 'in' as const, dom: 'cv' as const },
            { id: 'drone:subOut', label: 'SUB OUT', dir: 'out' as const, dom: 'audio' as const },
            { id: 'drone:droneOut', label: 'DRONE', dir: 'out' as const, dom: 'audio' as const },
          ].map((j) => (
            <PatchJackButton
              key={j.id}
              jackId={j.id}
              label={j.label}
              direction={j.dir}
              domain={j.dom}
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
          ))}
        </div>
      </div>

      {/* ====================================================================
          05 // TEXTURA NOISE LAB (Multi-Spectrum Noise & Vinyl Dust)
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-purple-400">
            05 // TEXTURA NOISE LAB
          </span>
          <div className="flex items-center gap-0.5 font-studio-mono text-[9px]">
            {(['white', 'pink', 'brown', 'hiss'] as NoiseSpectrumColor[]).map(
              (nc) => (
                <button
                  key={nc}
                  type="button"
                  onClick={() => onSetNoiseColor(nc)}
                  className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                    patch.noiseColor === nc
                      ? 'bg-purple-400 text-black font-bold'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  {nc}
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="FORMANT"
            size="sm"
            value={noisePrm.formant ?? 920}
            min={120}
            max={6500}
            step={10}
            defaultValue={920}
            accentColor="#A855F7"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(v) => onUpdateModuleParam('noise', 'formant', v)}
          />
          <RotaryKnob
            label="RESONANCE"
            size="sm"
            value={noisePrm.resonance ?? 3.4}
            min={0.5}
            max={14}
            step={0.1}
            defaultValue={3.4}
            accentColor="#A855F7"
            formatValue={(v) => `${v.toFixed(1)}Q`}
            onChange={(v) => onUpdateModuleParam('noise', 'resonance', v)}
          />
          <RotaryKnob
            label="VINYL DUST"
            size="sm"
            value={noisePrm.vinylDust ?? 0.42}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.42}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('noise', 'vinylDust', v)}
          />
          <RotaryKnob
            label="TAPE HISS"
            size="sm"
            value={noisePrm.tapeHiss ?? 0.28}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.28}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('noise', 'tapeHiss', v)}
          />
          <RotaryKnob
            label="WIDTH"
            size="sm"
            value={noisePrm.width ?? 0.75}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.75}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('noise', 'width', v)}
          />
          <RotaryKnob
            label="NOISE LVL"
            size="sm"
            value={noisePrm.noiseLevel ?? 0.36}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.36}
            accentColor="#A855F7"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('noise', 'noiseLevel', v)}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'noise:formCv', label: 'FORM CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'noise:vcaCv', label: 'VCA CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'noise:dustTrg', label: 'DUST TRG', dir: 'out' as const, dom: 'trig' as const },
            { id: 'noise:noiseOut', label: 'NOISE', dir: 'out' as const, dom: 'audio' as const },
          ].map((j) => (
            <PatchJackButton
              key={j.id}
              jackId={j.id}
              label={j.label}
              direction={j.dir}
              domain={j.dom}
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
          ))}
        </div>
      </div>

      {/* ====================================================================
          06 // ZDF ANALOG FILTER (Multimode Ladder Filter & Tube Drive)
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-amber-400">
            06 // ZDF ANALOG FILTER
          </span>
          <div className="flex items-center gap-0.5 font-studio-mono text-[9px]">
            {(['lp24', 'lp12', 'bandpass', 'notch'] as ZdfFilterMode[]).map(
              (fm) => (
                <button
                  key={fm}
                  type="button"
                  onClick={() => onSetFilterMode(fm)}
                  className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                    patch.filterType === fm
                      ? 'bg-amber-400 text-black font-bold'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  {fm === 'bandpass' ? 'BP' : fm.toUpperCase()}
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="CUTOFF"
            size="sm"
            value={filtPrm.cutoff ?? 1450}
            min={35}
            max={9500}
            step={10}
            defaultValue={1450}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(v) => onUpdateModuleParam('filter', 'cutoff', v)}
          />
          <RotaryKnob
            label="RESONANCE"
            size="sm"
            value={filtPrm.resonance ?? 3.2}
            min={0.5}
            max={16}
            step={0.1}
            defaultValue={3.2}
            accentColor="#F59E0B"
            formatValue={(v) => `${v.toFixed(1)}Q`}
            onChange={(v) => onUpdateModuleParam('filter', 'resonance', v)}
          />
          <RotaryKnob
            label="SAT DRIVE"
            size="sm"
            value={filtPrm.satDrive ?? 0.32}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.32}
            accentColor="#F43F5E"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('filter', 'satDrive', v)}
          />
          <RotaryKnob
            label="FM 1 ATTEN"
            size="sm"
            value={filtPrm.fm1Atten ?? 0.45}
            min={-1}
            max={1}
            step={0.01}
            defaultValue={0.45}
            bipolar
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('filter', 'fm1Atten', v)}
          />
          <RotaryKnob
            label="FM 2 ATTEN"
            size="sm"
            value={filtPrm.fm2Atten ?? -0.25}
            min={-1}
            max={1}
            step={0.01}
            defaultValue={-0.25}
            bipolar
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('filter', 'fm2Atten', v)}
          />
          <RotaryKnob
            label="FILT LVL"
            size="sm"
            value={filtPrm.filtLevel ?? 0.82}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.82}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('filter', 'filtLevel', v)}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'filter:audioIn', label: 'AUDIO IN', dir: 'in' as const, dom: 'audio' as const },
            { id: 'filter:fm1Cv', label: 'FM 1 CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'filter:fm2Cv', label: 'FM 2 CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'filter:filtOut', label: 'FILT OUT', dir: 'out' as const, dom: 'audio' as const },
          ].map((j) => (
            <PatchJackButton
              key={j.id}
              jackId={j.id}
              label={j.label}
              direction={j.dir}
              domain={j.dom}
              cables={patch.cables}
              activeFromJack={activeFromJack}
              onSelectJack={onSelectJack}
              onRemoveJackCables={onRemoveJackCables}
              onRemoveSingleCable={onRemoveSingleCable}
              onStartDaisyChain={onStartDaisyChain}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
