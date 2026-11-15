import React from 'react';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import type { Aether8PatchV4, SignalDomain } from '../types';
import { PatchJackButton } from './PatchJackButton';

export interface Row4BiosphereLabProps {
  patch: Aether8PatchV4;
  activeFromJack: {
    jackId: string;
    domain: SignalDomain;
    originalSourceJackId?: string;
  } | null;
  onTriggerThunder: () => void;
  onApplyBioScene: (scene: 'calm-shore' | 'night-storm') => void;
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

export const Row4BiosphereLab: React.FC<Row4BiosphereLabProps> = ({
  patch,
  activeFromJack,
  onTriggerThunder,
  onApplyBioScene,
  onUpdateModuleParam,
  onSelectJack,
  onRemoveJackCables,
  onRemoveSingleCable,
  onStartDaisyChain,
}) => {
  const bio = patch.params.biosphere ?? {};

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-[#11161F] p-3 flex flex-col justify-between gap-2">
      {/* Header & Quick Scene Macros */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/10">
        <div>
          <span className="font-studio-mono text-[10px] font-bold text-emerald-400">
            12 // BIOSPHERE &amp; WEATHER SYNTHESIS LAB (5-ENGINE NATURE GENERATOR)
          </span>
          <span className="text-[10px] font-studio-mono text-gray-500 ml-2">
            RAIN • WATER • WAVES • WIND • THUNDER (INDIVIDUAL PREAMPS + BIO MASTER)
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-studio-mono text-[10px]">
          <button
            type="button"
            onClick={() => onApplyBioScene('calm-shore')}
            className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-500/40 text-sky-200 font-bold cursor-pointer"
          >
            🌊 CALM SHORE
          </button>
          <button
            type="button"
            onClick={() => onApplyBioScene('night-storm')}
            className="px-2.5 py-1 rounded-lg bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 font-bold cursor-pointer"
          >
            ⛈️ NIGHT STORM
          </button>
          <button
            type="button"
            onClick={onTriggerThunder}
            className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold cursor-pointer shadow"
          >
            ⚡ STRIKE THUNDER
          </button>
        </div>
      </div>

      {/* 14 Biosphere Controls: Master, Pre-Amps & Nature Parameters */}
      <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-14 gap-1.5 place-items-center py-2 bg-black/30 rounded-lg border border-white/5">
        <RotaryKnob
          label="BIO MASTER"
          size="sm"
          value={bio.bioMaster ?? 1.0}
          min={0}
          max={2.0}
          step={0.01}
          defaultValue={1.0}
          accentColor="#10B981"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'bioMaster', v)}
        />
        <RotaryKnob
          label="RAIN PRE"
          size="sm"
          value={bio.rainPre ?? 1.5}
          min={0.5}
          max={4.0}
          step={0.1}
          defaultValue={1.5}
          accentColor="#38BDF8"
          formatValue={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'rainPre', v)}
        />
        <RotaryKnob
          label="RAIN LVL"
          size="sm"
          value={bio.rainLvl ?? 0.65}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.65}
          accentColor="#38BDF8"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'rainLvl', v)}
        />
        <RotaryKnob
          label="RAIN SIZE"
          size="sm"
          value={bio.rainSize ?? 0.52}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.52}
          accentColor="#38BDF8"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'rainSize', v)}
        />
        <RotaryKnob
          label="WATER PRE"
          size="sm"
          value={bio.waterPre ?? 1.5}
          min={0.5}
          max={4.0}
          step={0.1}
          defaultValue={1.5}
          accentColor="#0284C7"
          formatValue={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'waterPre', v)}
        />
        <RotaryKnob
          label="WATER FLOW"
          size="sm"
          value={bio.waterFlow ?? 0.55}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.55}
          accentColor="#0284C7"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'waterFlow', v)}
        />
        <RotaryKnob
          label="BROOK BUB"
          size="sm"
          value={bio.brookBub ?? 0.4}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.4}
          accentColor="#0284C7"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'brookBub', v)}
        />
        <RotaryKnob
          label="WAVES PRE"
          size="sm"
          value={bio.wavesPre ?? 1.5}
          min={0.5}
          max={4.0}
          step={0.1}
          defaultValue={1.5}
          accentColor="#34D399"
          formatValue={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'wavesPre', v)}
        />
        <RotaryKnob
          label="WAVES LVL"
          size="sm"
          value={bio.wavesLvl ?? 0.70}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.70}
          accentColor="#34D399"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'wavesLvl', v)}
        />
        <RotaryKnob
          label="TIDE SPEED"
          size="sm"
          value={bio.tideSpeed ?? 0.22}
          min={0.05}
          max={1}
          step={0.01}
          defaultValue={0.22}
          accentColor="#34D399"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'tideSpeed', v)}
        />
        <RotaryKnob
          label="WIND PRE"
          size="sm"
          value={bio.windPre ?? 1.5}
          min={0.5}
          max={4.0}
          step={0.1}
          defaultValue={1.5}
          accentColor="#A855F7"
          formatValue={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'windPre', v)}
        />
        <RotaryKnob
          label="WIND GUST"
          size="sm"
          value={bio.windGust ?? 0.55}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.55}
          accentColor="#A855F7"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'windGust', v)}
        />
        <RotaryKnob
          label="THNDR PRE"
          size="sm"
          value={bio.thndrPre ?? 1.5}
          min={0.5}
          max={4.0}
          step={0.1}
          defaultValue={1.5}
          accentColor="#F59E0B"
          formatValue={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'thndrPre', v)}
        />
        <RotaryKnob
          label="STORM PROB"
          size="sm"
          value={bio.stormProb ?? 0.25}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.25}
          accentColor="#F59E0B"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'stormProb', v)}
        />
      </div>

      {/* Biosphere Patch Jacks */}
      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-white/10">
        {[
          { id: 'bio:thndrTrg', label: 'THNDR TRG', dir: 'in' as const, dom: 'trig' as const },
          { id: 'bio:windCv', label: 'WIND CV', dir: 'in' as const, dom: 'cv' as const },
          { id: 'bio:waveCv', label: 'WAVE CV', dir: 'in' as const, dom: 'cv' as const },
          { id: 'bio:rainOut', label: 'RAIN', dir: 'out' as const, dom: 'audio' as const },
          { id: 'bio:waterOut', label: 'WATER', dir: 'out' as const, dom: 'audio' as const },
          { id: 'bio:wavesOut', label: 'WAVES', dir: 'out' as const, dom: 'audio' as const },
          { id: 'bio:windOut', label: 'WIND', dir: 'out' as const, dom: 'audio' as const },
          { id: 'bio:ltngTrg', label: 'LTNG TRG', dir: 'out' as const, dom: 'trig' as const },
          { id: 'bio:natureMix', label: 'NATURE MIX', dir: 'out' as const, dom: 'audio' as const },
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
  );
};
