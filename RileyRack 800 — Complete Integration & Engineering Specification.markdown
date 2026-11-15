# RILEYRACK 800 — Exhaustive Architectural & Engineering Specification
**Target Environment:** Anti-Gravity 2 / Unified Vite + React + TypeScript + Web Audio API Studio  
**Module Classification:** Self-Contained Standalone Instrument (`RileyRackInstrument`)  
**Isolation Guarantee:** Zero shared `AudioContext`, zero shared global state/stores, zero shared IndexedDB object stores, and zero cross-instrument MIDI/clock coupling.

---

## 1. Architectural Isolation & Lifecycle Contract

To guarantee that **RileyRack 800** never interacts with, degrades, or collides with any other instrument in your existing audio studio project:

1. **Dedicated `AudioContext` Instance:**
   - `RileyModularEngine` instantiates and owns its own private `AudioContext` lazily inside the user's `RUN` / `TEST THUNDER` gesture handler.
   - It **must not** import or attach to a global studio master bus or shared `AudioContext`.
   - **Lifecycle Cleanup (`useEffect` unmount):** When the user switches away from the RileyRack tab/route or unmounts `<RileyRackInstrument />`, the component must immediately:
     1. Stop the lookahead scheduler `setInterval` and clear all pending UI `setTimeout` playhead/morph timers.
     2. Disconnect the `ResizeObserver` and window/container `scroll`/`resize` listeners.
     3. Call `engine.dispose()`, which disconnects all Web Audio nodes and invokes `await ctx.close()` so zero background DSP threads remain active when another studio instrument is open.
2. **Encapsulated State & Namespace Isolation:**
   - All React state is local to `<RileyRackContent />` (or a private local reducer/context scoped strictly inside `<RileyRackInstrument />`).
   - All CSS classes use standard Tailwind utility classes plus `rileyrack-` prefixed custom classes if needed.
   - IndexedDB persistence uses a dedicated database name (`RileyRack800_DB`, version `1`) and object store (`user_patches`), preventing any schema or key collisions with your Groovebox, Drone, or Sampler databases.
3. **Fault Containment (`RackErrorBoundary`):**
   - The root export wraps `<RileyRackContent />` in a dedicated React Error Boundary (`RackErrorBoundary`) so any runtime or Web Audio exception is caught inside the instrument panel without crashing the host studio shell.

---

## 2. Recommended File & Directory Structure

Place the instrument in its own isolated folder inside your studio's `src/instruments/` directory:

```text
src/instruments/riley-rack/
├── index.ts                     # Public entry point exporting <RileyRackInstrument />
├── types.ts                     # All TypeScript interfaces, enums, and state contracts
├── constants/
│   ├── scales.ts                # Modal scales (Mixolydian, Dorian, Pentatonic, Raga Bhairav) + JI ratios
│   ├── voicePresets.ts          # 10 Original Riley voice presets + 10 Full Synth Suite voice presets
│   └── songPresets.ts           # 10 complete 8-voice polymetric song presets
├── audio/
│   └── RileyModularEngine.ts    # Self-contained Web Audio DSP graph, Eco Mode voice allocator, Tape Delay & Biosphere
├── storage/
│   └── rileyPatchDB.ts          # Isolated IndexedDB + JSON Export/Import manager for savable patches
└── components/
    ├── RileyRackInstrument.tsx  # Main Eurorack faceplate UI, SVG patchbay, 4x2 sequencers, Voice Editor & Biosphere
    └── RackErrorBoundary.tsx    # Instrument-level crash isolation boundary
```

---

## 3. Complete TypeScript Data Models (`types.ts`)

```typescript
export type ScaleId = 'mixolydian' | 'dorian' | 'pentatonic' | 'bhairav';
export type RileyModel = 'organ' | 'pluck' | 'pad';
export type EngineMode = 'ORIGINAL_RILEY' | 'FULL_SYNTH_SUITE';
export type OscWave = 'sawtooth' | 'square' | 'triangle' | 'sine';
export type FilterMode = 'LP24' | 'LP12' | 'BP12' | 'HP12';
export type LfoWave = 'sine' | 'triangle' | 'square' | 'sh';
export type LfoDest = 'cutoff' | 'pitch' | 'detune' | 'pan';

export interface StepCell {
  degree: number; // Scale degree index (0..scaleLength-1)
  active: boolean; // True = Gate ON, False = Rest
}

export interface ADSR {
  attack: number;  // 0.004s .. 1.4s
  decay: number;   // 0.004s .. 1.4s
  sustain: number; // 0.005 .. 1.0
  release: number; // 0.004s .. 1.4s
}

export interface RileyVoiceParams {
  model: RileyModel;
  cutoff: number;     // 180Hz .. 8500Hz
  resonance: number;  // 0.5 .. 12.0
  attack: number;     // 0.005s .. 0.45s
  release: number;    // 0.06s .. 1.4s
  brightness: number; // 0.05 .. 1.0
}

export interface FullSynthParams {
  osc1Wave: OscWave;
  osc1Coarse: number; // -24 .. +24 semitones
  osc1Detune: number; // -50 .. +50 cents
  osc2Wave: OscWave;
  osc2Coarse: number; // -24 .. +24 semitones
  osc2Detune: number; // -50 .. +50 cents
  wavefold: number;   // 0.0 .. 1.0 (West Coast sinusoidal folder)
  oscMix: number;     // 0.0 (100% Osc1) .. 1.0 (100% Osc2)
  subOctave: -1 | -2;
  subLevel: number;   // 0.0 .. 1.0
  noiseType: 'white' | 'pink';
  noiseLevel: number; // 0.0 .. 0.5
  filterMode: FilterMode;
  cutoff: number;         // 40Hz .. 14000Hz
  resonance: number;      // 0.5 .. 16.0
  filterEnvDepth: number; // -1.0 .. +1.0
  keyTrack: number;       // 0.0 .. 1.0
  ampEnv: ADSR;
  filterEnv: ADSR;
  lfoWave: LfoWave;
  lfoSync: boolean;
  lfoRate: number;  // 0.25 .. 12.0 (Hz in Free mode, beat multiplier in Sync mode)
  lfoDepth: number; // 0.0 .. 1.0
  lfoDest: LfoDest;
}

export interface VoiceTrack {
  id: string;
  index: number; // 0..7
  color: string;
  mode: EngineMode;
  length: number; // 3..16 active steps (polymetric loop boundary)
  speed: number;  // 0.5, 1, 1.5, 2 (overridden if CLK IN jack is patched)
  octave: number; // -1, 0, 1, 2
  steps: StepCell[]; // Fixed length 16 array; indices >= length are dimmed/inactive
  riley: RileyVoiceParams;
  synth: FullSynthParams;
  volume: number;   // 0.0 .. 1.0
  pan: number;      // -1.0 .. +1.0
  tapeSend: number; // 0.0 .. 0.7
  mute: boolean;
  solo: boolean;
}

export interface TapeDelayState {
  delayLMs: number;  // 120ms .. 1400ms
  delayRMs: number;  // 150ms .. 1600ms
  feedback: number;  // 0.0 .. 0.64 (strictly capped)
  crossFeed: number; // 0.0 .. 0.14 (strictly capped)
  toneHz: number;    // 400Hz .. 2200Hz
  mix: number;       // 0.0 .. 0.70
}

export interface BiosphereState {
  enabled: boolean;
  clockSync: boolean;
  masterVol: number;       // 0.0 .. 1.0
  rain: number;            // 0.0 .. 1.0
  rainHeavy: boolean;      // false = 3400Hz soft, true = 2100Hz heavy
  rainDropletSync: boolean;// Polyrhythmic droplets on tick % 3 === 0 || tick % 5 === 0
  stream: number;          // 0.0 .. 1.0
  waves: number;           // 0.0 .. 1.0
  waveSyncBars: 0 | 4 | 8; // 0 = continuous, 4 or 8 = bar-locked swell envelope
  wind: number;            // 0.0 .. 1.0
  thunderProb: number;     // 0.0 .. 1.0
}

export interface PatchCable {
  id: string;
  from: string; // e.g., 'clk-div-1', 'v1-cv'
  to: string;   // e.g., 'v1-clk', 'tla-in-l'
  color: string;
}

export interface EvolveState {
  enabled: boolean;
  intervalBars: 4 | 8 | 16 | 32 | 64;
  pitchDrift: boolean;
  rhythmLength: boolean;
  timbreMorph: boolean;
  currentBar: number;
  lastEvent: string;
}

export interface RileySongPatch {
  id: string;
  name: string;
  author?: string;
  createdAt: number;
  isFactory: boolean;
  bpm: number;
  scaleId: ScaleId;
  rootMidi: number;
  justIntonation: boolean;
  delay: TapeDelayState;
  biosphere: BiosphereState;
  evolve: Omit<EvolveState, 'currentBar' | 'lastEvent'>;
  cables: PatchCable[];
  voices: VoiceTrack[];
}
```

---

## 4. Sample-Accurate Polymetric Lookahead Scheduler

Never use `setInterval` or `requestAnimationFrame` directly to trigger audio nodes. Use a dual-clock lookahead pattern:

- **Audio Scheduling Loop (`25ms` interval, `100ms` lookahead):**
  - Calculates `sixteenthSec = 60 / bpm / 4`.
  - Advances `nextNoteTime` in exact `sixteenthSec` increments against `AudioContext.currentTime`.
  - **Independent Polymetric Phase Accumulators:** Each of the 8 voices maintains its own `cursors[idx]` (`0 .. voice.length - 1`) and fractional `accumulators[idx]`.
  - On every 16th-note master tick:
    1. Check if `cables` contains a patch terminating at `v${idx + 1}-clk`:
       - `clk-div-1` $\rightarrow$ `speed = v.speed`
       - `clk-div-2` $\rightarrow$ `speed = 0.5`
       - `clk-div-3` $\rightarrow$ `speed = 1 / 3`
       - `clk-div-5` $\rightarrow$ `speed = 0.2`
       - `clk-div-7` $\rightarrow$ `speed = 1 / 7`
    2. Increment `accumulators[idx] += speed`. When `accumulators[idx] >= 0.999`, subtract `1`, read `stepPos = cursors[idx] % v.length`, advance `cursors[idx] = (stepPos + 1) % v.length`, and schedule the note at exact hardware `time`.
  - **Frequency Quantization (Just Intonation vs. 12-TET):**
    - `normDeg = ((degree % len) + len) % len`
    - `extraOct = Math.floor(degree / len)`
    - **Just Intonation (`justIntonation === true`):**
      $$f = 440 \cdot 2^{(\text{rootMidi} - 69)/12} \cdot \text{jiRatios}[\text{normDeg}] \cdot 2^{\text{octave} + \text{extraOct}}$$
    - **12-TET (`justIntonation === false`):**
      $$\text{midi} = \text{rootMidi} + \text{semitones}[\text{normDeg}] + (\text{octave} + \text{extraOct}) \cdot 12$$
      $$f = 440 \cdot 2^{(\text{midi} - 69)/12}$$
  - **UI Playhead Sync:** Schedules visual step highlights via `window.setTimeout(..., Math.max(0, (time - ctx.currentTime) * 1000))` and tracks all timeout IDs in a `Set<number>` cleared on Stop/Unmount.

---

## 5. Audio DSP Engine & Runaway-Proof Magnetic Tape Delay

### 5.1 Master Bus & Brickwall Limiter
- All 8 voice stereo panners, the stereo Time Lag Tape Delay return, and the Biosphere bus sum into a master `DynamicsCompressorNode` configured as a transparent brickwall safety limiter:
  - `threshold = -6 dB`, `knee = 10 dB`, `ratio = 12:1`, `attack = 0.003 s`, `release = 0.16 s`.
- Feeds `masterGain` $\rightarrow$ `ctx.destination`.

### 5.2 Runaway-Proof Stereo Time Lag Accumulator (Magnetic Tape Loop)
To prevent harmonic buildup or screeching feedback loops over long generative sessions:
1. **No WaveShaper Inside Feedback Loops:** Never place gain-boosting nonlinearities inside the feedback path.
2. **Strict Unity-Attenuated Feedback Matrix:**
   $$\text{rawTotal} = \text{feedback} + \text{crossFeed}$$
   $$\text{scale} = \text{rawTotal} > 0.78 ? \frac{0.78}{\text{rawTotal}} : 1.0$$
   $$\text{safeFb} = \min(0.64, \text{feedback} \cdot \text{scale}), \quad \text{safeCross} = \min(0.14, \text{crossFeed} \cdot \text{scale})$$
3. **Per-Pass Magnetic Tape Filtering & Wow/Flutter:**
   - Each delay line (`delayL` max `4.0s`, `delayR` max `4.0s`) passes through a `120 Hz` 2-pole High-Pass Filter (preventing sub-bass mud accumulation) and a `400 Hz – 2200 Hz` 2-pole Low-Pass Filter (rolling off highs like aging oxide tape).
   - Dual subtle sine LFOs (`0.40 Hz` at `±1.6 ms` on Left; `0.34 Hz` at `±2.0 ms` on Right) modulate `delayTime` so repeats shimmer organically without phase-locking into metallic comb ringing.
4. **Instant Buffer Purge (`CLEAR TAPE`):** Zeroes `fbL`, `fbR`, `crossLR`, and `crossRL` immediately and restores them smoothly after `delayMaxMs`.

---

## 6. Eco Mode Specification (Low-Spec Device Optimization)

**RileyRack 800** must include a top-bar **`ECO MODE`** toggle (`ON / OFF`, plus automatic detection option via `navigator.hardwareConcurrency <= 4`) matching the low-CPU architecture of your other studio instruments. When `ecoMode === true`, the engine applies the following deterministic DSP optimizations without altering musical pitches or patterns:

| Subsystem | Standard Mode (Full Quality) | Eco Mode (Low-Spec Device Mode) | CPU Savings |
| :--- | :--- | :--- | :--- |
| **Voice Polyphony Cap** | Overlapping release tails allowed across all 8 voices (up to ~24 simultaneous voice graphs) | **Strict Per-Voice Monophonic Retrigger + Global 8-Voice Polyphony Cap:** Re-triggering a voice cleanly ramps down its previous note over `12ms` before starting the new note | ~45% node reduction |
| **Original Riley Organ** | 5 additive drawbar oscillators (`0.5x, 1x, 2x, 3x, 4x`) + dedicated per-note vibrato LFO | **3 additive drawbar oscillators** (`1x, 2x, 3x`) sharing a single global vibrato LFO bus | ~40% osc reduction |
| **Original Riley Pad** | Dual detuned oscillators (`sawtooth` + `triangle`) + per-note filter | **Single `triangle` oscillator** + per-note filter | ~45% osc reduction |
| **Full Synth Suite** | `OSC 1` + `OSC 2` + `WaveShaper (oversample: '2x')` + `Sub Osc` + `Noise Source` + `Per-Note LFO` | `OSC 1` + `OSC 2` (or single Osc when `oscMix === 0`), **bypass WaveShaper** (`oversample: 'none'` when `wavefold > 0`), **bypass Sub/Noise nodes** if level `< 0.02`, and **omit LFO oscillator** when `lfoDepth < 0.02` | ~55% DSP reduction |
| **Tape Delay Wow/Flutter** | Continuous LFO modulation of `DelayNode.delayTime` (forces per-sample fractional delay interpolation in Web Audio) | **Static delay times** (disconnects wow/flutter LFOs so Web Audio uses fast integer buffer reads) | ~30% FX reduction |
| **Biosphere Soundscape** | 4 continuous filtered noise loops + wind LFO + procedural sine rain droplets | **2 shared noise loops** (Rain/Wind merged + Waves/Stream merged) and procedural droplet oscillators disabled | ~50% ambient reduction |
| **UI & SVG Patchbay** | Real-time `ResizeObserver` + scroll cable recalculation + step glow shadows | Throttled `100ms` cable updates, simplified flat CSS borders (no `box-shadow` blur), and `250ms` UI playhead batching | ~35% main-thread UI reduction |

---

## 7. Savable Patches System (`rileyPatchDB.ts` + UI Controls)

### 7.1 IndexedDB Persistence (`RileyRack800_DB`)
- **Database:** `RileyRack800_DB` (Version `1`)
- **Object Store:** `user_patches` (`keyPath: 'id'`)
- **Capabilities:**
  1. **Save / Overwrite Current Patch:** Saves the complete `RileySongPatch` (BPM, scale, root, Just Intonation flag, all 8 voices' steps/lengths/speeds/octaves/modes/Riley params/Full Synth params/mixer levels, Tape Delay settings, Biosphere settings, Evolve settings, and SVG Patch Cables).
  2. **Save As New Patch:** Prompts for a custom patch name, generates `id: 'user-' + crypto.randomUUID()`, and stores it in `RileyRack800_DB`.
  3. **Delete User Patch:** Removes user-created patches from IndexedDB (factory song patches are read-only and protected from deletion).
  4. **Export / Import `.json`:** One-click download of a `.rileyrack.json` patch file and file-picker import for sharing patches across devices.
  5. **Auto-Save Working Session (`localStorage` key `'rileyrack800_autosave_v1'`):** Debounced `1000ms` snapshot of the current rack state so reloading the studio restores the user's last session seamlessly.

---

## 8. The 10 Factory Song Presets (`songPresets.ts`)

Every song preset configures all 8 voices with distinct polymetric loop lengths, clock multipliers, modal scales, and hybrid `ORIGINAL_RILEY` / `FULL_SYNTH_SUITE` engines:

1. **`01. In C (Terry Riley 1964)`**
   - *Tempo / Scale:* `118 BPM` | `C Mixolydian` | `Just Intonation: ON`
   - *Polymetric Lengths:* `5, 7, 8, 9, 11, 12, 13, 15` steps
   - *Vibe:* Iconic interlocking cells inspired by Riley's 1964 *In C*, blending Combo Organ pulses, West Coast plucks, and Glass Marimba counterpoint.
2. **`02. A Rainbow in Curved Air`**
   - *Tempo / Scale:* `132 BPM` | `D Dorian` | `Just Intonation: ON`
   - *Polymetric Lengths:* `7, 9, 8, 11, 13, 6, 10, 16` steps
   - *Vibe:* Rapid 2x rotary Combo Organ arpeggios cascading over deep Dorian pedal tones and shimmering stereo tape echoes.
3. **`03. Persian Surgery Dervishes`**
   - *Tempo / Scale:* `124 BPM` | `C Raga Bhairav` | `Just Intonation: ON`
   - *Polymetric Lengths:* `5, 7, 8, 9, 11, 12, 13, 16` steps
   - *Vibe:* Hypnotic Hindustani/Persian modal phrasing with microtonal Just Intonation intervals (`16/15`, `8/5`, `15/8`) and hollow reed organ drones.
4. **`04. Dorian Tape Mirage`**
   - *Tempo / Scale:* `108 BPM` | `D Dorian` | `Just Intonation: OFF (12-TET)`
   - *Polymetric Lengths:* `6, 9, 8, 11, 13, 7, 15, 12` steps
   - *Vibe:* Dual-Revox style asymmetric stereo delays (`520ms` L / `780ms` R) weaving sparse bell plucks with warm brass swells.
5. **`05. Shri Camel — Desert Mirage`**
   - *Tempo / Scale:* `114 BPM` | `G Mixolydian` | `Just Intonation: ON`
   - *Polymetric Lengths:* `7, 11, 8, 13, 5, 14, 9, 16` steps
   - *Vibe:* Inspired by Riley's *Shri Camel*—intricate soprano raga ornaments over a drone bass and gentle desert wind in the Biosphere.
6. **`06. Poppy Nogood's Phantom Band`**
   - *Tempo / Scale:* `126 BPM` | `Bb Dorian` | `Just Intonation: ON`
   - *Polymetric Lengths:* `4, 7, 9, 11, 13, 15, 6, 8` steps
   - *Vibe:* Saxophone-like Hollow Reed synth leads feeding long `680ms / 940ms` Time Lag Accumulator loops.
7. **`07. Descending Moonshine Dervishes`**
   - *Tempo / Scale:* `138 BPM` | `E Raga Bhairav` | `Just Intonation: ON`
   - *Polymetric Lengths:* `5, 6, 7, 8, 9, 10, 11, 12` steps
   - *Vibe:* Accelerating polyrhythmic staircase (consecutive integers `5` through `12`) creating a continuous spiral of harmonic phase shifts.
8. **`08. Olson III — Celestial Choir`**
   - *Tempo / Scale:* `92 BPM` | `F Major Pentatonic` | `Just Intonation: ON`
   - *Polymetric Lengths:* `8, 10, 12, 14, 9, 11, 13, 15` steps
   - *Vibe:* Slow, cathedral-like Harmonic Pads and Celestial Choir voices synced with 8-bar ocean wave swells in the Biosphere.
9. **`09. Salome Dances for Peace`**
   - *Tempo / Scale:* `120 BPM` | `A Dorian` | `Just Intonation: OFF (12-TET)`
   - *Polymetric Lengths:* `7, 8, 11, 12, 13, 16, 5, 9` steps
   - *Vibe:* Chamber-quartet counterpoint pairing String Ensemble voices with Plucked Harp and Marimba ostinatos.
10. **`10. Kyoto Rain & Modular Bells`**
    - *Tempo / Scale:* `96 BPM` | `C Major Pentatonic` | `Just Intonation: ON`
    - *Polymetric Lengths:* `7, 9, 11, 13, 15, 8, 12, 16` steps
    - *Vibe:* Ambient generative meditation pairing Gamelan Gong, Glass Marimba, and Koto Pluck with clock-synced rain droplets and distant thunder.

---

## 9. The 20 Voice Engine Presets (`voicePresets.ts` — 10 Per Mode)

Each voice (`Voice 1`–`Voice 8`) can switch between **Original Riley** and **Full Synth Suite** at any time, and includes **10 curated voice presets** for each engine mode:

### 9.1 Original Riley Engine Presets (10 Presets)
1. **`Vox Continental Organ`** — `model: 'organ'`, `cutoff: 2600Hz`, `resonance: 1.8`, `attack: 0.01s`, `release: 0.35s`, `brightness: 0.72`
2. **`Yamaha YC-45D Reed`** — `model: 'organ'`, `cutoff: 1950Hz`, `resonance: 3.4`, `attack: 0.02s`, `release: 0.42s`, `brightness: 0.85`
3. **`Buchla Vactrol Pluck`** — `model: 'pluck'`, `cutoff: 2800Hz`, `resonance: 2.8`, `attack: 0.006s`, `release: 0.38s`, `brightness: 0.68`
4. **`Sine Sub Marimba`** — `model: 'pluck'`, `cutoff: 1250Hz`, `resonance: 1.5`, `attack: 0.005s`, `release: 0.28s`, `brightness: 0.32`
5. **`Time-Lag Harmonic Pad`** — `model: 'pad'`, `cutoff: 1650Hz`, `resonance: 2.0`, `attack: 0.14s`, `release: 0.95s`, `brightness: 0.50`
6. **`Just Intonation Drone`** — `model: 'pad'`, `cutoff: 920Hz`, `resonance: 1.4`, `attack: 0.28s`, `release: 1.35s`, `brightness: 0.28`
7. **`Soprano Raga Pipe`** — `model: 'organ'`, `cutoff: 3400Hz`, `resonance: 4.1`, `attack: 0.025s`, `release: 0.30s`, `brightness: 0.90`
8. **`Koto Wavefold Pluck`** — `model: 'pluck'`, `cutoff: 4200Hz`, `resonance: 3.8`, `attack: 0.005s`, `release: 0.48s`, `brightness: 0.88`
9. **`Glass Harmonica`** — `model: 'pad'`, `cutoff: 3800Hz`, `resonance: 3.2`, `attack: 0.18s`, `release: 1.10s`, `brightness: 0.78`
10. **`Velvet Bass Organ`** — `model: 'organ'`, `cutoff: 780Hz`, `resonance: 1.6`, `attack: 0.015s`, `release: 0.45s`, `brightness: 0.22`

### 9.2 Full Synth Suite Engine Presets (10 Presets)
1. **`Bell Pluck`** — Triangle + Octave Sine, `22%` wavefold, `LP24` at `2400Hz`, snappy exponential decay.
2. **`Warm Brass`** — Detuned dual Sawtooths, `-1 oct` sub, `LP24` at `1050Hz` with slow `80ms` filter brass swell and `4.4Hz` pitch vibrato.
3. **`Glass Marimba`** — Sine + `+19st` Triangle (5th + octave), `35%` wavefold, `BP12` at `1950Hz`, beat-synced stereo pan LFO.
4. **`Deep Bass`** — Sawtooth + Square, `-2 oct` sub at `58%`, `LP24` at `480Hz`, punchy low-end anchor.
5. **`Hollow Reed`** — Square + Octave Triangle, `28%` wavefold, `LP12` at `1480Hz` with `4.2` resonance and `5.0Hz` detune chorus.
6. **`Shimmer Lead`** — Sawtooth + `+7st` Square, `32%` wavefold, `LP24` at `2700Hz`, `60%` keyboard tracking.
7. **`West Coast Buchla Bongos`** — High-wavefold (`72%`) Triangle/Sine pair, short `140ms` decay, resonant `BP12` filter (`Q: 6.2`) for percussive woody tones.
8. **`Celestial Choir`** — Detuned Triangle + Sine, pink noise breath (`6%`), slow `0.28s` attack, `LP12` at `1800Hz`, slow pitch drift LFO.
9. **`Gamelan Gong`** — Inharmonic `+17st` OSC 2, `64%` wavefold, long `1.25s` release, metallic `BP12` resonance (`Q: 5.5`).
10. **`Analog String Ensemble`** — Wide detuned dual Sawtooths (`-14c` / `+14c`), `LP24` at `2100Hz`, `0.16s` attack, `5.6Hz` vibrato LFO.

---

## 10. UI Layout & Interactive Modules Summary

1. **Top Eurorack Row (3 Modules):**
   - **Master Clock, Quantizer & Patch Manager (5 cols):** Run/Stop button, Song Preset dropdown (10 factory + user saved patches), `SAVE` / `SAVE AS` / `EXPORT` / `IMPORT` buttons, `ECO MODE` toggle, BPM (`60–180`), Scale selector, Root selector (`C–B`), `JUST INT / 12-TET` toggle, 5 Clock Divider jacks (`÷1, ÷2, ÷3, ÷5, ÷7`), `HIDE/CABLES`, `CLEAR` cables, and `MIXER` drawer toggle.
   - **Generative Evolve Engine (3 cols):** `AUTO ON/OFF`, interval selector (`4, 8, 16, 32, 64 Bars`), live bar countdown progress bar (`Bar X / N`), `MORPH NOW` manual trigger, independent `PITCH DRIFT`, `RHYTHM / LEN`, and `TIMBRE MORPH` toggles, and live mutation log ticker.
   - **Time Lag // Tape Loop (4 cols):** `DELAY L`, `DELAY R`, `TONE`, `FEEDBACK` (capped `64%`), `CROSS` (capped `14%`), `WET MIX`, `CLEAR TAPE` purge button, and `TAPE L` / `TAPE R` patch jacks.
2. **Scroll-Anchored SVG Patchbay Overlay:**
   - Positioned `absolute` inside the scrollable rack container (`rackRef`) with `scrollLeft`/`scrollTop` offset compensation and a `ResizeObserver` so all 3.5mm sag-physics cables remain locked to their jacks on scroll/resize.
3. **Middle Eurorack Row — 8-Channel Polymetric Sequencer Bank (`4×2` Grid):**
   - All 8 sequencers visible simultaneously with live LEDs, quantized note names, loop length (`3–16st`), speed (`1/2x, 1x, 1.5x, 2x`), octave (`-1..+2`), Mute/Solo, volume slider, `RILEY / SYNTH PRO` quick toggle, `EDIT` focus button, and `CLK IN` / `CV OUT` jacks.
4. **Bottom Eurorack Row — Tabbed Voice Sound Designer + Biosphere Module:**
   - **Voice Sound Engine Editor (7 cols):** Scrollable `Voice 1`–`Voice 8` tabs + `Prev / Next` navigation, `ORIGINAL RILEY` vs `FULL SYNTH SUITE` mode switch, and 10 instant voice presets per engine mode.
   - **Biosphere // Synced Nature Soundscape (5 cols):** `CLK SYNC / FREE`, `ACTIVE / MUTED`, master level, Ocean Wave Swell selector (`Free`, `4-Bar`, `8-Bar`), procedural **Rain** (`DROP` polyrhythmic sync + `SOFT/HEAVY`), **Stream**, **Waves**, **Wind**, and probabilistic **Distant Thunder** (`TEST THUNDER` trigger).