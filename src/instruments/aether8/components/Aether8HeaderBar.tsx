import React, { useEffect, useRef, useState } from 'react';
import type { StoredPatchRecord } from '../../../core/types';
import type { Aether8AudioEngine } from '../audio/Aether8AudioEngine';
import { AETHER8_FACTORY_PATCHES } from '../presets/factoryPatches';
import type { Aether8PatchV4, TimbreCharacter } from '../types';

export interface Aether8HeaderBarProps {
  patch: Aether8PatchV4;
  engine: Aether8AudioEngine;
  isPlaying: boolean;
  isWavRecording: boolean;
  mixerDrawerOpen: boolean;
  modMatrixOpen: boolean;
  savedPatches: StoredPatchRecord<Aether8PatchV4>[];
  dbName: string;
  onTogglePlay: () => void;
  onToggleWavRecord: () => void;
  onBpmChange: (bpm: number) => void;
  onMasterVolChange: (vol: number) => void;
  onToggleEco: () => void;
  onTimbreToggle: (mode: TimbreCharacter) => void;
  onLoadFactoryPatch: (factoryId: string) => void;
  onToggleMixerDrawer: () => void;
  onToggleModMatrixDrawer: () => void;
  onClearCables: () => void;
  onSaveToVault: () => void;
  onLoadSavedPatch: (rec: StoredPatchRecord<Aether8PatchV4>) => void;
  onDeleteSavedPatch: (id: string) => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
}

export const Aether8HeaderBar: React.FC<Aether8HeaderBarProps> = ({
  patch,
  engine,
  isPlaying,
  isWavRecording,
  mixerDrawerOpen,
  modMatrixOpen,
  savedPatches,
  dbName,
  onTogglePlay,
  onToggleWavRecord,
  onBpmChange,
  onMasterVolChange,
  onToggleEco,
  onTimbreToggle,
  onLoadFactoryPatch,
  onToggleMixerDrawer,
  onToggleModMatrixDrawer,
  onClearCables,
  onSaveToVault,
  onLoadSavedPatch,
  onDeleteSavedPatch,
  onExportJson,
  onImportJsonFile,
}) => {
  const [vaultOpen, setVaultOpen] = useState(false);
  const scopeRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Top-Bar Stereo Master Oscilloscope
  useEffect(() => {
    const canvas = scopeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const buf = new Float32Array(256);

    let lastDraw = 0;
    const targetFps = patch.ecoMode ? 15 : 60;
    const intervalMs = 1000 / targetFps;

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);
      if (ts - lastDraw < intervalMs) return;
      lastDraw = ts;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#07090E';
      ctx.fillRect(0, 0, w, h);

      const analyser = engine.getMasterAnalyser();
      if (analyser && isPlaying) {
        analyser.getFloatTimeDomainData(buf);
      }

      ctx.strokeStyle =
        patch.timbreMode === 'soft' ? '#38BDF8' : '#F59E0B';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 128; i++) {
        const x = (i / 127) * w;
        const val =
          analyser && isPlaying
            ? buf[i] || 0
            : Math.sin((i / 20) * Math.PI * 2 + ts * 0.002) * 0.15;
        const y = h / 2 - val * (h * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [engine, isPlaying, patch.timbreMode, patch.ecoMode]);

  return (
    <header className="h-13 shrink-0 border-b border-sky-500/20 bg-[#0C1018] px-2.5 flex items-center justify-between gap-2 relative z-30">
      {/* Left: Transport, BPM & Global Harsh / Soft Silk Toggle */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePlay}
          className={`h-8 px-3.5 rounded-lg font-studio-mono text-xs font-bold tracking-wider transition-all cursor-pointer ${
            isPlaying
              ? 'bg-sky-400 text-black shadow-[0_0_15px_rgba(56,189,248,0.55)]'
              : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
          }`}
        >
          {isPlaying ? '■ HALT SYSTEM' : '▶ ENGAGE AETHER-8'}
        </button>

        {/* BPM Control (30-130 BPM) */}
        <div className="flex items-center bg-black/50 rounded-lg border border-white/10 px-1.5 h-8 gap-1">
          <button
            type="button"
            onClick={() => onBpmChange(Math.max(30, patch.bpm - 1))}
            className="w-5 h-5 rounded bg-white/5 hover:bg-white/15 text-xs font-bold text-gray-300 cursor-pointer"
          >
            -
          </button>
          <div className="px-1 text-center font-studio-mono">
            <span className="text-xs font-bold text-sky-300">{patch.bpm}</span>
            <span className="text-[8px] text-gray-400 ml-1">BPM</span>
          </div>
          <button
            type="button"
            onClick={() => onBpmChange(Math.min(130, patch.bpm + 1))}
            className="w-5 h-5 rounded bg-white/5 hover:bg-white/15 text-xs font-bold text-gray-300 cursor-pointer"
          >
            +
          </button>
        </div>

        {/* Global ⚡ HARSH / ☁️ SOFT SILK Timbre Character Toggle */}
        <button
          type="button"
          onClick={() =>
            onTimbreToggle(patch.timbreMode === 'soft' ? 'harsh' : 'soft')
          }
          className={`h-8 px-2.5 rounded-lg font-studio-mono text-[11px] font-bold border transition-all cursor-pointer ${
            patch.timbreMode === 'soft'
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
              : 'bg-amber-500/20 border-amber-400/50 text-amber-300'
          }`}
          title="Instantly morphs between 3.1kHz Soft Silk ambient warmth and raw Harsh analog wavefolding"
        >
          {patch.timbreMode === 'soft'
            ? '☁️ SOFT SILK (3.1kHz)'
            : '⚡ HARSH (WAVEFOLD)'}
        </button>
      </div>

      {/* Center: 20 Factory Sample Patches (10 Soft Silk + 10 Harsh) & Live Top-Bar Oscilloscope */}
      <div className="hidden lg:flex items-center gap-1.5">
        <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 gap-1">
          <span className="font-studio-mono text-[9px] text-sky-400 uppercase px-1.5">
            20 PATCHES:
          </span>
          <select
            value={
              AETHER8_FACTORY_PATCHES.find((fp) => fp.name === patch.name)
                ?.id ?? ''
            }
            onChange={(e) => {
              if (e.target.value) onLoadFactoryPatch(e.target.value);
            }}
            className="h-7 px-2 rounded bg-black/60 border border-sky-500/30 font-studio-mono text-[10px] font-bold text-sky-200 cursor-pointer"
            title="Select from 20 Factory Sample Patches (10 Soft Silk + 10 Harsh)"
          >
            <option value="" disabled>
              ★ {patch.name} (Custom)
            </option>
            <optgroup label="☁️ 10 SOFT SILK SAMPLE PATCHES">
              {AETHER8_FACTORY_PATCHES.filter(
                (fp) => fp.modeTag === 'soft'
              ).map((fp, i) => (
                <option key={fp.id} value={fp.id}>
                  ☁️ {i + 1}. {fp.name} ({fp.patch.bpm} BPM)
                </option>
              ))}
            </optgroup>
            <optgroup label="⚡ 10 HARSH SAMPLE PATCHES">
              {AETHER8_FACTORY_PATCHES.filter(
                (fp) => fp.modeTag === 'harsh'
              ).map((fp, i) => (
                <option key={fp.id} value={fp.id}>
                  ⚡ {i + 1}. {fp.name} ({fp.patch.bpm} BPM)
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={() => {
              const curIdx = AETHER8_FACTORY_PATCHES.findIndex(
                (fp) => fp.name === patch.name
              );
              const prevIdx =
                curIdx <= 0
                  ? AETHER8_FACTORY_PATCHES.length - 1
                  : curIdx - 1;
              onLoadFactoryPatch(AETHER8_FACTORY_PATCHES[prevIdx].id);
            }}
            title="Previous Factory Patch"
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/15 font-studio-mono text-[10px] text-gray-300 cursor-pointer"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => {
              const curIdx = AETHER8_FACTORY_PATCHES.findIndex(
                (fp) => fp.name === patch.name
              );
              const nextIdx =
                curIdx < 0 || curIdx >= AETHER8_FACTORY_PATCHES.length - 1
                  ? 0
                  : curIdx + 1;
              onLoadFactoryPatch(AETHER8_FACTORY_PATCHES[nextIdx].id);
            }}
            title="Next Factory Patch"
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/15 font-studio-mono text-[10px] text-gray-300 cursor-pointer"
          >
            ▶
          </button>
        </div>

        <canvas
          ref={scopeRef}
          width={110}
          height={28}
          className="rounded border border-sky-500/25 bg-[#07090E]"
        />
      </div>

      {/* Right: 10-Ch Output Mixer, Mod Matrix, Clear Cables, .WAV Rec & Vault I/O */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleMixerDrawer}
          className={`h-8 px-2.5 rounded-lg font-studio-mono text-[11px] font-bold border transition-all cursor-pointer ${
            mixerDrawerOpen
              ? 'bg-sky-400 text-black border-sky-300 shadow'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
          }`}
        >
          🎚️ MIXER ({Object.keys(patch.outputMixer).length}CH)
        </button>

        <button
          type="button"
          onClick={onToggleModMatrixDrawer}
          className={`h-8 px-2.5 rounded-lg font-studio-mono text-[11px] font-bold border transition-all cursor-pointer ${
            modMatrixOpen
              ? 'bg-amber-400 text-black border-amber-300 shadow'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
          }`}
        >
          🎛️ MATRIX
        </button>

        <button
          type="button"
          onClick={onToggleEco}
          title="ECO Mode (caps animation FPS and disables oversampling for low-spec Chromebooks and tablets)"
          className={`h-8 px-2.5 rounded-lg font-studio-mono text-[11px] font-bold border transition-all cursor-pointer ${
            patch.ecoMode
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow'
              : 'bg-white/5 hover:bg-white/10 text-gray-400 border-white/10'
          }`}
        >
          {patch.ecoMode ? '⚡ ECO ON' : 'ECO'}
        </button>

        <button
          type="button"
          onClick={onClearCables}
          title="Unplug all stacked Eurorack patch cables"
          className="hidden md:inline-flex h-8 px-2 items-center rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 font-studio-mono text-[10px] text-gray-300 hover:text-rose-200 cursor-pointer"
        >
          🔌 UNPLUG ({patch.cables.length})
        </button>

        <button
          type="button"
          onClick={onToggleWavRecord}
          className={`h-8 px-2.5 rounded-lg font-studio-mono text-[11px] font-bold border transition-all cursor-pointer ${
            isWavRecording
              ? 'bg-red-600 text-white border-red-400 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
          }`}
        >
          {isWavRecording ? '■ STOP .WAV' : '● REC .WAV'}
        </button>

        {/* Vault Save / Load Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setVaultOpen((v) => !v)}
            className="h-8 px-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 font-studio-mono text-xs font-bold text-sky-200 cursor-pointer"
          >
            💾 VAULT
          </button>

          {vaultOpen && (
            <div className="absolute right-0 mt-1.5 w-76 rounded-xl border border-white/15 bg-[#11161F] p-3.5 shadow-2xl z-50 text-left space-y-2.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div>
                  <div className="text-xs font-bold text-white">
                    AETHER-8 PATCH VAULT
                  </div>
                  <div className="text-[10px] font-studio-mono text-sky-400">
                    {dbName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVaultOpen(false)}
                  className="text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 font-studio-mono text-[10px]">
                <button
                  type="button"
                  onClick={onSaveToVault}
                  className="py-1.5 rounded bg-sky-400 text-black font-bold cursor-pointer"
                >
                  💾 SAVE DB
                </button>
                <button
                  type="button"
                  onClick={onExportJson}
                  className="py-1.5 rounded bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                >
                  ⬇ .JSON
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-1.5 rounded bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                >
                  📂 IMPORT
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      onImportJsonFile(f);
                      e.target.value = '';
                      setVaultOpen(false);
                    }
                  }}
                />
              </div>

              {/* Factory Patches Quick Load (10 Soft Silk + 10 Harsh) */}
              <div className="max-h-56 overflow-y-auto rounded bg-black/40 p-1.5 border border-white/10 space-y-2">
                <div>
                  <div className="text-[9px] font-studio-mono font-bold text-sky-300 uppercase mb-1">
                    ☁️ 10 SOFT SILK SAMPLE PATCHES
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {AETHER8_FACTORY_PATCHES.filter(
                      (fp) => fp.modeTag === 'soft'
                    ).map((fp, i) => (
                      <button
                        key={fp.id}
                        type="button"
                        onClick={() => {
                          onLoadFactoryPatch(fp.id);
                          setVaultOpen(false);
                        }}
                        className={`p-1.5 rounded border text-left font-studio-mono text-[10px] cursor-pointer flex items-center justify-between ${
                          patch.name === fp.name
                            ? 'bg-sky-500/25 border-sky-400 text-white'
                            : 'bg-white/5 hover:bg-sky-500/20 border-white/10 text-sky-200'
                        }`}
                      >
                        <span className="truncate font-bold">
                          ☁️ {i + 1}. {fp.name}
                        </span>
                        <span className="text-[9px] text-gray-400 ml-2 shrink-0">
                          {fp.patch.bpm} BPM
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-1 border-t border-white/10">
                  <div className="text-[9px] font-studio-mono font-bold text-amber-300 uppercase mb-1">
                    ⚡ 10 HARSH SAMPLE PATCHES
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {AETHER8_FACTORY_PATCHES.filter(
                      (fp) => fp.modeTag === 'harsh'
                    ).map((fp, i) => (
                      <button
                        key={fp.id}
                        type="button"
                        onClick={() => {
                          onLoadFactoryPatch(fp.id);
                          setVaultOpen(false);
                        }}
                        className={`p-1.5 rounded border text-left font-studio-mono text-[10px] cursor-pointer flex items-center justify-between ${
                          patch.name === fp.name
                            ? 'bg-amber-500/25 border-amber-400 text-white'
                            : 'bg-white/5 hover:bg-amber-500/20 border-white/10 text-amber-200'
                        }`}
                      >
                        <span className="truncate font-bold">
                          ⚡ {i + 1}. {fp.name}
                        </span>
                        <span className="text-[9px] text-gray-400 ml-2 shrink-0">
                          {fp.patch.bpm} BPM
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* User Saved Patches */}
              <div className="max-h-28 overflow-y-auto rounded bg-black/40 p-1.5 border border-white/5 space-y-1">
                {savedPatches.length === 0 ? (
                  <div className="text-[10px] font-studio-mono text-gray-500 text-center py-2">
                    No user patches saved in {dbName} yet.
                  </div>
                ) : (
                  savedPatches.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between text-xs font-studio-mono px-2 py-1 rounded bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onLoadSavedPatch(rec);
                          setVaultOpen(false);
                        }}
                        className="text-left text-gray-200 hover:text-sky-300 truncate flex-1 cursor-pointer"
                      >
                        {rec.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSavedPatch(rec.id)}
                        className="text-[10px] text-gray-500 hover:text-rose-400 ml-2 cursor-pointer"
                      >
                        DEL
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Master Volume */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={patch.masterVol}
          onChange={(e) => onMasterVolChange(Number(e.target.value))}
          title="Master Output Volume"
          className="hidden sm:block w-14 accent-sky-400 cursor-pointer"
        />
      </div>
    </header>
  );
};
