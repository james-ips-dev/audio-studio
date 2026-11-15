import React from 'react';
import { RotaryKnob } from '../../../shared-ui/RotaryKnob';
import type { Aether8PatchV4, SignalDomain } from '../types';
import { PatchJackButton } from './PatchJackButton';

export interface Row4BiosphereLabProps {
  patch: Aether8PatchV4;
  activeFromJack: { jackId: string; domain: SignalDomain } | null;
  onTriggerThunder: () => void;
  onApplyBioScene: (scene: 'calm-shore' | 'night-storm') => void;
  onUpdateModuleParam: (moduleKey: string, paramKey: string, val: number) => void;
  onSelectJack: (
    jackId: string,
    direction: 'in' | 'out',
    domain: SignalDomain
  ) => void;
  onRemoveJackCables: (jackId: string) => void;
}

export const Row4BiosphereLab: React.FC<Row4BiosphereLabProps> = ({
  patch,
  activeFromJack,
  onTriggerThunder,
  onApplyBioScene,
  onUpdateModuleParam,
  onSelectJack,
  onRemoveJackCables,
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
            RAIN • FLOWING WATER • LAPPING WAVES • HOWLING WIND • THUNDER
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

      {/* 8 Nature Engine Rotary Controls */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 place-items-center py-1 bg-black/30 rounded-lg border border-white/5">
        <RotaryKnob
          label="RAIN LVL"
          size="sm"
          value={bio.rainLvl ?? 0.35}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.35}
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
          label="WATER FLOW"
          size="sm"
          value={bio.waterFlow ?? 0.28}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.28}
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
          label="WAVES LVL"
          size="sm"
          value={bio.wavesLvl ?? 0.45}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.45}
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
          label="WIND GUST"
          size="sm"
          value={bio.windGust ?? 0.32}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.32}
          accentColor="#A855F7"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdateModuleParam('biosphere', 'windGust', v)}
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
          />
        ))}
      </div>
    </div>
  );
};
