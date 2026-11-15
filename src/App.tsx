import React, { useCallback, useEffect, useRef, useState } from 'react';
import { audioGuard } from './core/audioGuard';
import { DEFAULT_INSTRUMENT_ID, INSTRUMENT_REGISTRY } from './core/registry';
import type { InstrumentHandle } from './core/types';

const LAST_ACTIVE_TAB_KEY = 'studio_suite_last_active_tab';

function getInitialInstrumentId(): string {
  try {
    const saved = localStorage.getItem(LAST_ACTIVE_TAB_KEY);
    if (saved && INSTRUMENT_REGISTRY.some((item) => item.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore localStorage security errors
  }
  return DEFAULT_INSTRUMENT_ID;
}

export const App: React.FC = () => {
  const [activeInstrumentId, setActiveInstrumentId] = useState<string>(
    getInitialInstrumentId
  );
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [audioStatus, setAudioStatus] = useState(() =>
    audioGuard.getStatusSnapshot()
  );

  const currentHandleRef = useRef<InstrumentHandle | null>(null);

  // Subscribe to live AudioIsolationGuard telemetry
  useEffect(() => {
    return audioGuard.subscribe(() => {
      setAudioStatus(audioGuard.getStatusSnapshot());
    });
  }, []);

  // Track browser fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Callback passed to the mounted instrument to register its lifecycle handle
  const registerHandle = useCallback((handle: InstrumentHandle) => {
    currentHandleRef.current = handle;
  }, []);

  /**
   * Section 7: Deterministic 5-Step Atomic Transition Sequence
   */
  const handleSwitchInstrument = useCallback(
    async (targetId: string) => {
      // Step 1: Intercept Switch Request
      if (targetId === activeInstrumentId || isSwitching) {
        return;
      }

      // Step 2: Lock Switcher UI (150ms minimum debounce lock)
      setIsSwitching(true);

      try {
        // Step 3: Execute Outgoing Teardown (20ms gain ramp -> close AudioContext -> clear timers)
        if (currentHandleRef.current) {
          await currentHandleRef.current.suspendAndCleanup();
          currentHandleRef.current = null;
        }
        await audioGuard.closeAllContexts(20);

        // Step 4: Unmount Outgoing React Tree & Mount Incoming Tree
        try {
          localStorage.setItem(LAST_ACTIVE_TAB_KEY, targetId);
        } catch {
          // Ignore storage quota errors
        }
        setActiveInstrumentId(targetId);

        // Enforce 150ms debounce lock to prevent rapid double-click race conditions
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      } finally {
        // Step 5: Unlock Switcher UI
        setIsSwitching(false);
      }
    },
    [activeInstrumentId, isSwitching]
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  const activeInstrument =
    INSTRUMENT_REGISTRY.find((inst) => inst.id === activeInstrumentId) ??
    INSTRUMENT_REGISTRY[0];

  const ActiveComponent = activeInstrument.component;

  return (
    <div className="w-screen h-dvh flex flex-col bg-[#07080B] text-[#F3F4F6] overflow-hidden select-none">
      {/* ====================================================================
          TIER 1 (OUTER): 36px (h-9) Host Shell Top Launcher Bar
          ==================================================================== */}
      <header className="h-9 min-h-[36px] max-h-[36px] w-full z-50 bg-[#07080B] border-b border-white/[0.08] px-3 flex items-center justify-between gap-2 shrink-0">
        {/* Left Branding */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: activeInstrument.badge.accentHex,
              boxShadow: `0 0 8px ${activeInstrument.badge.accentHex}`,
            }}
          />
          <span className="font-studio-mono text-[10px] font-bold uppercase tracking-widest text-gray-300 truncate">
            STUDIO SUITE // WORKSTATION
          </span>
        </div>

        {/* Center Instrument Switcher Tabs */}
        <nav
          aria-label="Studio Instrument Switcher"
          className="flex items-center gap-1 bg-[#0E1017] p-0.5 rounded-md border border-white/[0.07]"
        >
          {INSTRUMENT_REGISTRY.map((inst) => {
            const isActive = inst.id === activeInstrument.id;
            return (
              <button
                key={inst.id}
                type="button"
                disabled={isSwitching}
                onClick={() => void handleSwitchInstrument(inst.id)}
                title={`${inst.name} (${inst.version}) — ${inst.badge.tagline}`}
                style={{
                  borderColor: isActive
                    ? `${inst.badge.accentHex}66`
                    : 'transparent',
                }}
                className={`group relative h-6 px-2.5 rounded flex items-center gap-1.5 font-studio-mono text-[11px] transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#161A24] text-white font-bold shadow-xs'
                    : 'text-[#9CA3AF] hover:text-gray-200 hover:bg-white/[0.04]'
                } ${isSwitching ? 'opacity-60 cursor-wait' : ''}`}
              >
                {/* Status dot */}
                <span
                  className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: isActive
                      ? inst.badge.accentHex
                      : 'rgba(156,163,175,0.4)',
                    boxShadow: isActive
                      ? `0 0 6px ${inst.badge.accentHex}`
                      : 'none',
                  }}
                />
                <span className="tracking-wider">{inst.name}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded ${
                    isActive
                      ? 'bg-white/10 text-gray-200'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {inst.version}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Right Utility Slot: Audio Isolation Telemetry & Fullscreen Toggle */}
        <div className="flex items-center gap-2">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10131C] border border-white/[0.07] font-studio-mono text-[10px]"
            title="Enforces single active AudioContext and 20ms click-free teardown on switch"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSwitching
                  ? 'bg-amber-400 animate-ping'
                  : audioStatus.runningCount > 0
                    ? 'bg-emerald-400 shadow-[0_0_6px_#34D399]'
                    : 'bg-gray-500'
              }`}
            />
            <span className="text-gray-300 tracking-wider">
              {isSwitching
                ? 'TEARDOWN • SWITCHING...'
                : audioStatus.runningCount > 0
                  ? `AUDIO ISOLATED • ${Math.round((audioStatus.sampleRate ?? 48000) / 1000)}kHz ACTIVE`
                  : 'AUDIO ISOLATED • READY'}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="h-6 w-6 rounded flex items-center justify-center bg-[#10131C] hover:bg-white/10 border border-white/[0.08] text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
          >
            ⛶
          </button>
        </div>
      </header>

      {/* ====================================================================
          WORKSPACE VIEWPORT: calc(100vh - 36px) Hosting Active Instrument
          ==================================================================== */}
      <div
        className="w-full overflow-hidden relative"
        style={{ height: 'calc(100dvh - 36px)' }}
      >
        <ActiveComponent
          key={activeInstrument.id}
          registerHandle={registerHandle}
          storageNamespace={`suite_${activeInstrument.id}`}
        />
      </div>
    </div>
  );
};

export default App;
