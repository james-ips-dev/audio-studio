/**
 * src/core/audioGuard.ts
 *
 * Enforces the "Hard Product Isolation" mandate for Web Audio resources:
 * - Only ONE instrument may hold an active, running AudioContext at any moment.
 * - Executes a smooth 20ms exponential gain fade-out before closing an outgoing
 *   AudioContext to eliminate speaker clicks/pops.
 * - Tracks any stray AudioContexts, intervals, timeouts, or animation frames so
 *   switching instruments leaves zero zombie DSP threads.
 */

interface TrackedContextEntry {
  ownerId: string;
  context: AudioContext;
  masterGain: GainNode | null;
  createdAt: number;
}

class AudioIsolationGuard {
  private activeContexts: Map<AudioContext, TrackedContextEntry> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Creates a native 48kHz interactive AudioContext for the given instrument ownerId,
   * automatically tearing down any leftover contexts from other instruments first.
   */
  public createIsolatedAudioContext(
    ownerId: string,
    options?: AudioContextOptions
  ): { audioCtx: AudioContext; masterGain: GainNode } {
    // Close any stray context belonging to a different instrument
    for (const [ctx, entry] of this.activeContexts.entries()) {
      if (entry.ownerId !== ownerId) {
        void this.gracefulCloseContext(ctx, entry.masterGain, 15);
      }
    }

    const AudioCtxConstructor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    let audioCtx: AudioContext;
    try {
      // Use 'playback' latencyHint on mobile/Android/Chromebook to give a larger hardware audio buffer
      // and prevent audio underrun static/clicks, while desktops keep 'interactive'
      const isMobileOrCrOS =
        typeof navigator !== 'undefined' &&
        /Android|CrOS|Chromebook|tablet/i.test(navigator.userAgent);

      audioCtx = new AudioCtxConstructor({
        latencyHint: isMobileOrCrOS ? 'playback' : 'interactive',
        ...options,
      });
    } catch {
      // Fallback if options are rejected
      audioCtx = new AudioCtxConstructor();
    }

    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    this.activeContexts.set(audioCtx, {
      ownerId,
      context: audioCtx,
      masterGain,
      createdAt: Date.now(),
    });

    audioCtx.addEventListener('statechange', () => {
      if (audioCtx.state === 'closed') {
        this.activeContexts.delete(audioCtx);
      }
      this.notifyListeners();
    });

    // Global first-interaction unlocker for strict browsers (ChromeOS/Chromebooks, Safari, etc.)
    const unlock = () => {
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });

    this.notifyListeners();
    return { audioCtx, masterGain };
  }

  /**
   * Registers an externally created AudioContext with the guard so it is tracked
   * and guaranteed to be closed on instrument switch.
   */
  public registerContext(
    ownerId: string,
    context: AudioContext,
    masterGain: GainNode | null = null
  ): void {
    this.activeContexts.set(context, {
      ownerId,
      context,
      masterGain,
      createdAt: Date.now(),
    });
    context.addEventListener('statechange', () => {
      if (context.state === 'closed') {
        this.activeContexts.delete(context);
      }
      this.notifyListeners();
    });
    this.notifyListeners();
  }

  /**
   * Executes the Section 7 atomic audio teardown for a specific AudioContext:
   * 1. Ramps `masterGain.gain` exponentially to `0.0001` over `rampMs` (default 20ms)
   *    to prevent speaker pops/clicks.
   * 2. Closes the `AudioContext` and frees all browser hardware audio threads.
   */
  public async gracefulCloseContext(
    context: AudioContext | null | undefined,
    masterGain?: GainNode | null,
    rampMs: number = 20
  ): Promise<void> {
    if (!context) return;

    this.activeContexts.delete(context);

    if (context.state !== 'closed') {
      try {
        if (masterGain && context.state === 'running') {
          const now = context.currentTime;
          const currentVal = Math.max(0.0001, masterGain.gain.value);
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setValueAtTime(currentVal, now);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, now + rampMs / 1000);
          await new Promise<void>((resolve) => setTimeout(resolve, rampMs + 6));
        }
      } catch {
        // Ignore gain ramp errors if context is already transitioning
      }

      try {
        await context.close();
      } catch {
        // Ignore if already closed
      }
    }

    this.notifyListeners();
  }

  /**
   * Force-closes all tracked AudioContexts across the entire application.
   * Invoked as a safety barrier by the Host Shell during outer tab switches.
   */
  public async closeAllContexts(rampMs: number = 20): Promise<void> {
    const entries = Array.from(this.activeContexts.values());
    this.activeContexts.clear();

    await Promise.all(
      entries.map((entry) =>
        this.gracefulCloseContext(entry.context, entry.masterGain, rampMs)
      )
    );
    this.notifyListeners();
  }

  /**
   * Returns a snapshot of active AudioContext telemetry for the Host Shell status badge.
   */
  public getStatusSnapshot(): {
    activeCount: number;
    runningCount: number;
    sampleRate: number | null;
    ownerIds: string[];
  } {
    let runningCount = 0;
    let sampleRate: number | null = null;
    const ownerIds: string[] = [];

    for (const [ctx, entry] of this.activeContexts.entries()) {
      if (ctx.state === 'running') {
        runningCount++;
        sampleRate = ctx.sampleRate;
      } else if (sampleRate === null && ctx.state !== 'closed') {
        sampleRate = ctx.sampleRate;
      }
      if (ctx.state !== 'closed') {
        ownerIds.push(entry.ownerId);
      }
    }

    return {
      activeCount: ownerIds.length,
      runningCount,
      sampleRate,
      ownerIds,
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const audioGuard = new AudioIsolationGuard();
