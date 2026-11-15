import React, { useState } from 'react';
import { useTranslation } from '../../../core/useTranslation';
import type { PatchCable, SignalDomain } from '../types';

export interface PatchJackButtonProps {
  jackId: string;
  label: string;
  direction: 'in' | 'out';
  domain: SignalDomain;
  cables: PatchCable[];
  activeFromJack: {
    jackId: string;
    domain: SignalDomain;
    originalSourceJackId?: string;
  } | null;
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
  onRemoveSingleCable,
  onStartDaisyChain,
}) => {
  const { t, language } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const color = DOMAIN_COLORS[domain];

  // Incoming cables (this jack is endpoint/destination)
  const incomingCables = cables.filter((c) => c.to === jackId);
  // Outgoing cables (this jack is source)
  const outgoingCables = cables.filter((c) => c.from === jackId);
  const totalConnected = incomingCables.length + outgoingCables.length;

  const isSourceActive = activeFromJack?.jackId === jackId;
  const isValidTarget =
    activeFromJack !== null &&
    direction === 'in' &&
    activeFromJack.jackId !== jackId;

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        data-jack-id={jackId}
        onClick={(e) => {
          e.stopPropagation();
          // If shift-clicked, instantly unplug all cables connected to this jack
          if (e.shiftKey && totalConnected > 0) {
            onRemoveJackCables(jackId);
            return;
          }
          // If alt-clicked or clicking an input with incoming cables while not patching, toggle jack context menu
          if (e.altKey && totalConnected > 0) {
            setMenuOpen((prev) => !prev);
            return;
          }
          onSelectJack(jackId, direction, domain);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (totalConnected > 0) {
            setMenuOpen((prev) => !prev);
          }
        }}
        title={`${label} (${direction.toUpperCase()} • ${domain.toUpperCase()})
• ${language === 'ja' ? 'クリックで結線 / パッチ接続' : 'Click to patch / connect'}
• ${language === 'ja' ? '右クリックまたはAlt+クリックで解除・デイジーチェーン' : 'Right-click or Alt+Click for cable options (Unplug & Daisy-Chain)'}
• ${language === 'ja' ? `Shift+クリックで即時解除（${totalConnected}本接続中）` : `Shift+Click to instantly unplug (${totalConnected} connected)`}`}
        className={`group relative flex flex-col items-center gap-0.5 px-1 py-0.5 rounded transition-transform cursor-pointer ${
          isValidTarget ? 'scale-110 animate-pulse' : 'hover:scale-105'
        }`}
      >
        {/* 3.5mm Eurorack Nut & Socket */}
        <span
          style={{
            borderColor: color,
            boxShadow:
              isSourceActive || totalConnected > 0
                ? `0 0 8px ${color}88`
                : 'none',
            backgroundColor:
              direction === 'out' ? `${color}28` : 'rgba(10,13,18,0.9)',
          }}
          className="w-4 h-4 rounded-full border-2 flex items-center justify-center relative"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-black border border-white/30" />
          {totalConnected > 0 && (
            <span
              style={{ backgroundColor: color }}
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full text-[7px] font-studio-mono font-bold text-black flex items-center justify-center"
            >
              {totalConnected}
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

      {/* Jack Action Popover (Unplug Individual/All & Daisy Chain from Endpoint) */}
      {menuOpen && totalConnected > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 w-48 bg-[#0D121B] border border-sky-400/50 rounded-lg shadow-2xl p-2 z-50 font-studio-mono text-[9px] space-y-1.5"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <span className="font-bold text-white truncate">{label}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="text-gray-400 hover:text-white px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Daisy-Chain Options (Available for INPUT jacks with incoming cables) */}
          {direction === 'in' && incomingCables.length > 0 && (
            <div className="space-y-1">
              <span className="text-[8px] text-sky-300 font-bold uppercase block">
                {t('jack.daisyChain', '🔗 DAISY CHAIN (PASS-THROUGH):')}
              </span>
              {incomingCables.map((c) => (
                <button
                  key={`dc_${c.id}`}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onStartDaisyChain) {
                      onStartDaisyChain(jackId, c.from, c.type);
                    } else {
                      // Fallback: select the original source
                      onSelectJack(c.from, 'out', c.type);
                    }
                  }}
                  className="w-full text-left px-1.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-500/40 text-sky-200 cursor-pointer flex items-center justify-between"
                  title={
                    language === 'ja'
                      ? `元の送信元 (${c.from}) の信号を別の入力端子へ中継・分岐接続します`
                      : `Daisy chain signal from original source (${c.from}) to another input`
                  }
                >
                  <span className="truncate">→ Forward {c.from}</span>
                  <span className="text-[7.5px] text-sky-400 font-bold ml-1">
                    CHAIN ➔
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Unplug Options */}
          <div className="space-y-1 pt-1 border-t border-white/10">
            <span className="text-[8px] text-rose-300 font-bold uppercase block">
              {t('jack.unplugOptions', '🔌 UNPLUG OPTIONS:')}
            </span>
            {cables
              .filter((c) => c.from === jackId || c.to === jackId)
              .map((c) => (
                <button
                  key={`rm_${c.id}`}
                  type="button"
                  onClick={() => {
                    if (onRemoveSingleCable) {
                      onRemoveSingleCable(c.id);
                    } else {
                      onRemoveJackCables(jackId);
                    }
                    if (totalConnected <= 1) setMenuOpen(false);
                  }}
                  className="w-full text-left px-1.5 py-0.5 rounded bg-white/5 hover:bg-rose-500/25 text-gray-300 hover:text-rose-200 cursor-pointer flex items-center justify-between truncate"
                >
                  <span className="truncate">
                    ✕ {c.from} → {c.to}
                  </span>
                </button>
              ))}

            {totalConnected > 1 && (
              <button
                type="button"
                onClick={() => {
                  onRemoveJackCables(jackId);
                  setMenuOpen(false);
                }}
                className="w-full py-1 text-center font-bold rounded bg-rose-500/25 hover:bg-rose-500/40 border border-rose-500/40 text-rose-200 cursor-pointer"
              >
                {t('jack.unplugAll', 'UNPLUG ALL')} ({totalConnected})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
