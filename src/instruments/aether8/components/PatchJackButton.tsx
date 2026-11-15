import React from 'react';
import type { PatchCable, SignalDomain } from '../types';

export interface PatchJackButtonProps {
  jackId: string;
  label: string;
  direction: 'in' | 'out';
  domain: SignalDomain;
  cables: PatchCable[];
  activeFromJack: { jackId: string; domain: SignalDomain } | null;
  onSelectJack: (
    jackId: string,
    direction: 'in' | 'out',
    domain: SignalDomain
  ) => void;
  onRemoveJackCables: (jackId: string) => void;
}

const DOMAIN_COLORS: Record<SignalDomain, string> = {
  audio: '#38BDF8',
  cv: '#F59E0B',
  trig: '#F43F5E',
};

export const PatchJackButton: React.FC<PatchJackButtonProps> = ({
  jackId,
  label,
  direction,
  domain,
  cables,
  activeFromJack,
  onSelectJack,
  onRemoveJackCables,
}) => {
  const color = DOMAIN_COLORS[domain];
  const connectedCount = cables.filter(
    (c) => c.from === jackId || c.to === jackId
  ).length;
  const isSourceActive = activeFromJack?.jackId === jackId;
  const isValidTarget =
    activeFromJack !== null &&
    direction === 'in' &&
    activeFromJack.jackId !== jackId;

  return (
    <button
      type="button"
      data-jack-id={jackId}
      onClick={(e) => {
        e.stopPropagation();
        if (e.shiftKey && connectedCount > 0) {
          onRemoveJackCables(jackId);
          return;
        }
        onSelectJack(jackId, direction, domain);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (connectedCount > 0) {
          onRemoveJackCables(jackId);
        }
      }}
      title={`${label} (${direction.toUpperCase()} • ${domain.toUpperCase()}) — Click to patch • Right-click or Shift+Click to unplug (${connectedCount} stacked)`}
      className={`group relative flex flex-col items-center gap-0.5 px-1 py-0.5 rounded transition-transform cursor-pointer ${
        isValidTarget ? 'scale-110 animate-pulse' : 'hover:scale-105'
      }`}
    >
      {/* 3.5mm Eurorack Nut & Socket */}
      <span
        style={{
          borderColor: color,
          boxShadow:
            isSourceActive || connectedCount > 0
              ? `0 0 8px ${color}88`
              : 'none',
          backgroundColor:
            direction === 'out' ? `${color}28` : 'rgba(10,13,18,0.9)',
        }}
        className="w-4 h-4 rounded-full border-2 flex items-center justify-center relative"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-black border border-white/30" />
        {connectedCount > 0 && (
          <span
            style={{ backgroundColor: color }}
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full text-[7px] font-studio-mono font-bold text-black flex items-center justify-center"
          >
            {connectedCount}
          </span>
        )}
      </span>

      <span
        className={`font-studio-mono text-[8px] font-bold tracking-tight uppercase leading-none ${
          direction === 'out' ? 'text-sky-200' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </button>
  );
};
