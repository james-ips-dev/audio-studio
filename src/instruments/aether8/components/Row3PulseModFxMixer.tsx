import React from 'react';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import type { Aether8Telemetry } from '../audio/Aether8AudioEngine';
import type { Aether8PatchV4, SignalDomain } from '../types';
import { PatchJackButton } from './PatchJackButton';

export interface Row3PulseModFxMixerProps {
  patch: Aether8PatchV4;
  telemetry: Aether8Telemetry;
  activeFromJack: { jackId: string; domain: SignalDomain } | null;
  onPingVactrol: () => void;
  onUpdateModuleParam: (moduleKey: string, paramKey: string, val: number) => void;
  onSelectJack: (
    jackId: string,
    direction: 'in' | 'out',
    domain: SignalDomain
  ) => void;
  onRemoveJackCables: (jackId: string) => void;
}

export const Row3PulseModFxMixer: React.FC<Row3PulseModFxMixerProps> = ({
  patch,
  telemetry,
  activeFromJack,
  onPingVactrol,
  onUpdateModuleParam,
  onSelectJack,
  onRemoveJackCables,
}) => {
  const pulsePrm = patch.params.pulse ?? {};
  const modPrm = patch.params.mod ?? {};
  const fxPrm = patch.params.fx ?? {};
  const dlyPrm = patch.params.delay ?? {};
  const mixPrm = patch.params.mixer ?? {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-15 gap-3">
      {/* ====================================================================
          07 // VACTROL SUB-PULSE (Organic Low-Pass-Gate Bass Pulse)
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-emerald-400">
            07 // VACTROL SUB-PULSE
          </span>
          <button
            type="button"
            onClick={onPingVactrol}
            className="px-2 py-0.5 rounded bg-emerald-400 hover:bg-emerald-300 text-black font-studio-mono text-[9px] font-bold cursor-pointer shadow"
          >
            ● PING
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="SUB PITCH"
            size="sm"
            value={pulsePrm.subPitch ?? 46}
            min={28}
            max={120}
            step={1}
            defaultValue={46}
            accentColor="#10B981"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(v) => onUpdateModuleParam('pulse', 'subPitch', v)}
          />
          <RotaryKnob
            label="PUNCH DROP"
            size="sm"
            value={pulsePrm.punchDrop ?? 0.65}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.65}
            accentColor="#10B981"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('pulse', 'punchDrop', v)}
          />
          <RotaryKnob
            label="VACTROL DEC"
            size="sm"
            value={pulsePrm.vactrolDec ?? 0.68}
            min={0.08}
            max={1.8}
            step={0.02}
            defaultValue={0.68}
            accentColor="#10B981"
            formatValue={(v) => `${v.toFixed(2)}s`}
            onChange={(v) => onUpdateModuleParam('pulse', 'vactrolDec', v)}
          />
          <RotaryKnob
            label="LPG WARMTH"
            size="sm"
            value={pulsePrm.lpgWarmth ?? 0.72}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.72}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('pulse', 'lpgWarmth', v)}
          />
          <RotaryKnob
            label="WOOD SNAP"
            size="sm"
            value={pulsePrm.woodSnap ?? 0.34}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.34}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('pulse', 'woodSnap', v)}
          />
          <RotaryKnob
            label="PULSE LVL"
            size="sm"
            value={pulsePrm.pulseLevel ?? 0.7}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.7}
            accentColor="#10B981"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('pulse', 'pulseLevel', v)}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'pulse:trigIn', label: 'TRIG IN', dir: 'in' as const, dom: 'trig' as const },
            { id: 'pulse:pitchCv', label: 'PITCH CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'pulse:decayCv', label: 'DECAY CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'pulse:pulseOut', label: 'PULSE', dir: 'out' as const, dom: 'audio' as const },
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
            />
          ))}
        </div>
      </div>

      {/* ====================================================================
          08 // SLOW LFO & CHAOS (Beat-Triggered Phase-Reset LFOs & S&H)
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-amber-400">
            08 // SLOW LFO &amp; CHAOS
          </span>
          <span className="text-[9px] font-studio-mono text-gray-400">
            PHASE-LOCKABLE
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="LFO 1 HZ"
            size="sm"
            value={modPrm.lfo1Hz ?? 0.18}
            min={0.02}
            max={4.0}
            step={0.02}
            defaultValue={0.18}
            accentColor="#F59E0B"
            formatValue={(v) => `${v.toFixed(2)}Hz`}
            onChange={(v) => onUpdateModuleParam('mod', 'lfo1Hz', v)}
          />
          <RotaryKnob
            label="LFO 2 HZ"
            size="sm"
            value={modPrm.lfo2Hz ?? 0.65}
            min={0.04}
            max={8.0}
            step={0.04}
            defaultValue={0.65}
            accentColor="#F59E0B"
            formatValue={(v) => `${v.toFixed(2)}Hz`}
            onChange={(v) => onUpdateModuleParam('mod', 'lfo2Hz', v)}
          />
          <RotaryKnob
            label="CHAOS SLEW"
            size="sm"
            value={modPrm.chaosSlew ?? 0.45}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.45}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('mod', 'chaosSlew', v)}
          />
        </div>

        {/* Live 4-Channel Modulation Telemetry Bars */}
        <div className="grid grid-cols-4 gap-1.5 bg-black/40 p-1.5 rounded border border-white/5 font-studio-mono text-[8px] text-center">
          {[
            { label: 'LFO 1', val: telemetry.lfo1Val, color: '#F59E0B' },
            { label: 'LFO 2', val: telemetry.lfo2Val, color: '#FBBF24' },
            { label: 'CHAOS', val: telemetry.chaosVal, color: '#38BDF8' },
            { label: 'S&H', val: telemetry.shVal, color: '#34D399' },
          ].map((m) => (
            <div key={m.label} className="space-y-0.5">
              <div className="w-full h-2 bg-black rounded overflow-hidden">
                <div
                  style={{
                    width: `${Math.round((m.val * 0.5 + 0.5) * 100)}%`,
                    backgroundColor: m.color,
                  }}
                  className="h-full transition-all duration-75"
                />
              </div>
              <span className="text-gray-400">{m.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'mod:lfoResetIn', label: 'LFO RST', dir: 'in' as const, dom: 'trig' as const },
            { id: 'mod:shTrigIn', label: 'S&H TRG', dir: 'in' as const, dom: 'trig' as const },
            { id: 'mod:lfo1Out', label: 'LFO 1', dir: 'out' as const, dom: 'cv' as const },
            { id: 'mod:lfo2Out', label: 'LFO 2', dir: 'out' as const, dom: 'cv' as const },
            { id: 'mod:chaosOut', label: 'CHAOS', dir: 'out' as const, dom: 'cv' as const },
            { id: 'mod:shOut', label: 'SLEW S&H', dir: 'out' as const, dom: 'cv' as const },
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
            />
          ))}
        </div>
      </div>

      {/* ====================================================================
          09 // WAVEFOLD & LO-FI FX
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-pink-400">
            09 // WAVEFOLD &amp; LO-FI FX
          </span>
          <span className="text-[9px] font-studio-mono text-gray-500">
            WEST-COAST
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="WAVEFOLD"
            size="sm"
            value={fxPrm.wavefold ?? 0.35}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.35}
            accentColor="#EC4899"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('fx', 'wavefold', v)}
          />
          <RotaryKnob
            label="BIT CRUSH"
            size="sm"
            value={fxPrm.bitCrush ?? 0.18}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.18}
            accentColor="#EC4899"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('fx', 'bitCrush', v)}
          />
          <RotaryKnob
            label="TONE FILT"
            size="sm"
            value={fxPrm.toneFilt ?? 2800}
            min={120}
            max={12000}
            step={20}
            defaultValue={2800}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(v) => onUpdateModuleParam('fx', 'toneFilt', v)}
          />
          <RotaryKnob
            label="FILT RES"
            size="sm"
            value={fxPrm.filtRes ?? 2.1}
            min={0.5}
            max={14}
            step={0.1}
            defaultValue={2.1}
            accentColor="#38BDF8"
            formatValue={(v) => `${v.toFixed(1)}Q`}
            onChange={(v) => onUpdateModuleParam('fx', 'filtRes', v)}
          />
          <RotaryKnob
            label="CV DEPTH"
            size="sm"
            value={fxPrm.cvDepth ?? 0.4}
            min={-1}
            max={1}
            step={0.02}
            defaultValue={0.4}
            bipolar
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('fx', 'cvDepth', v)}
          />
          <RotaryKnob
            label="FX MIX"
            size="sm"
            value={fxPrm.fxMix ?? 0.42}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.42}
            accentColor="#EC4899"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('fx', 'fxMix', v)}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'fx:audioIn', label: 'AUDIO IN', dir: 'in' as const, dom: 'audio' as const },
            { id: 'fx:toneCv', label: 'TONE CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'fx:foldCv', label: 'FOLD CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'fx:fxOut', label: 'FX OUT', dir: 'out' as const, dom: 'audio' as const },
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
            />
          ))}
        </div>
      </div>

      {/* ====================================================================
          10 // DUB TAPE DELAY (Multi-Head Stereo Echo)
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-indigo-400">
            10 // DUB TAPE DELAY
          </span>
          <span className="text-[9px] font-studio-mono text-gray-500">
            MULTI-HEAD
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="TAPE TIME"
            size="sm"
            value={dlyPrm.tapeTime ?? 0.42}
            min={0.05}
            max={1.8}
            step={0.01}
            defaultValue={0.42}
            accentColor="#818CF8"
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(v) => onUpdateModuleParam('delay', 'tapeTime', v)}
          />
          <RotaryKnob
            label="FEEDBACK"
            size="sm"
            value={dlyPrm.feedback ?? 0.68}
            min={0}
            max={0.94}
            step={0.01}
            defaultValue={0.68}
            accentColor="#818CF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('delay', 'feedback', v)}
          />
          <RotaryKnob
            label="TAPE DAMP"
            size="sm"
            value={dlyPrm.tapeDamp ?? 2400}
            min={350}
            max={8500}
            step={25}
            defaultValue={2400}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v)}Hz`}
            onChange={(v) => onUpdateModuleParam('delay', 'tapeDamp', v)}
          />
          <RotaryKnob
            label="WOW/FLUT"
            size="sm"
            value={dlyPrm.wowFlut ?? 0.32}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.32}
            accentColor="#F59E0B"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('delay', 'wowFlut', v)}
          />
          <RotaryKnob
            label="HEAD PAN"
            size="sm"
            value={dlyPrm.headPan ?? 0.65}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.65}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('delay', 'headPan', v)}
          />
          <RotaryKnob
            label="ECHO WET"
            size="sm"
            value={dlyPrm.echoWet ?? 0.48}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.48}
            accentColor="#818CF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('delay', 'echoWet', v)}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'delay:audioIn', label: 'AUDIO IN', dir: 'in' as const, dom: 'audio' as const },
            { id: 'delay:timeCv', label: 'TIME CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'delay:fbackCv', label: 'FBACK CV', dir: 'in' as const, dom: 'cv' as const },
            { id: 'delay:tapeOut', label: 'TAPE OUT', dir: 'out' as const, dom: 'audio' as const },
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
            />
          ))}
        </div>
      </div>

      {/* ====================================================================
          11 // SPACE & TAPE MIXER (4-Ch Sidechain Mixer & Cavern Reverb)
          ==================================================================== */}
      <div className="xl:col-span-3 rounded-xl border border-sky-500/20 bg-[#11161F] p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-studio-mono text-[10px] font-bold text-sky-400">
            11 // SPACE &amp; TAPE MIXER
          </span>
          <span className="text-[9px] font-studio-mono text-rose-400">
            BEAT PUMP
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 place-items-center my-1.5">
          <RotaryKnob
            label="CH 1 DRONE"
            size="sm"
            value={mixPrm.ch1Drone ?? 0.78}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.78}
            accentColor="#38BDF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('mixer', 'ch1Drone', v)}
          />
          <RotaryKnob
            label="CH 2 BEAT"
            size="sm"
            value={mixPrm.ch2Beat ?? 0.72}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.72}
            accentColor="#F43F5E"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('mixer', 'ch2Beat', v)}
          />
          <RotaryKnob
            label="CH 3 AUX"
            size="sm"
            value={mixPrm.ch3Aux ?? 0.54}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.54}
            accentColor="#EC4899"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('mixer', 'ch3Aux', v)}
          />
          <RotaryKnob
            label="CH 4 ECHO"
            size="sm"
            value={mixPrm.ch4Echo ?? 0.62}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.62}
            accentColor="#818CF8"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('mixer', 'ch4Echo', v)}
          />
          <RotaryKnob
            label="CAVERN REV"
            size="sm"
            value={mixPrm.cavernRev ?? 0.58}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.58}
            accentColor="#A855F7"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('mixer', 'cavernRev', v)}
          />
          <RotaryKnob
            label="BEAT PUMP"
            size="sm"
            value={mixPrm.beatPump ?? 0.48}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.48}
            accentColor="#F43F5E"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateModuleParam('mixer', 'beatPump', v)}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          {[
            { id: 'mixer:ch1In', label: 'CH 1 IN', dir: 'in' as const, dom: 'audio' as const },
            { id: 'mixer:ch2In', label: 'CH 2 IN', dir: 'in' as const, dom: 'audio' as const },
            { id: 'mixer:ch3In', label: 'CH 3 IN', dir: 'in' as const, dom: 'audio' as const },
            { id: 'mixer:ch4In', label: 'CH 4 IN', dir: 'in' as const, dom: 'audio' as const },
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
            />
          ))}
        </div>
      </div>
    </div>
  );
};
