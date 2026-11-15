import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../core/useTranslation';
import type { StoredPatchRecord } from '../../../core/types';
import {
  GROOVE_TEMPLATES,
  PATTERN_BANK_IDS,
  ROOT_NOTE_NAMES,
  SCALE_DEFINITIONS,
  STARTER_PROJECT_SPECS,
} from '../presets/factoryPresets';
import type { AppMode, GrooveboxProject } from '../types';

export interface TransportBarProps {
  project: GrooveboxProject;
  isPlaying: boolean;
  isRecording: boolean;
  isWavRecording: boolean;
  pLockLatch: boolean;
  selectedStep: { trackIndex: number; stepIndex: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  midiInputs: string[];
  savedProjects: StoredPatchRecord<GrooveboxProject>[];
  onConnectMidi: () => void;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onToggleWavRecord: () => void;
  onTogglePLockLatch: () => void;
  onModeChange: (mode: AppMode) => void;
  onBpmChange: (bpm: number) => void;
  onGrooveChange: (template: string, swing: number) => void;
  onKeyScaleChange: (rootNote: number, scaleName: string) => void;
  onPatternSelect: (patternId: string) => void;
  onClonePattern: () => void;
  onToggleEco: () => void;
  onToggleSafeLock: () => void;
  onFillHold: (held: boolean) => void;
  onBuildDropHold: (held: boolean) => void;
  onSceneCrossfade: (val: number) => void;
  onMasterVolumeChange: (val: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLoadStarterProject: (specId: string) => void;
  onSaveProjectToDb: () => void;
  onLoadSavedProject: (rec: StoredPatchRecord<GrooveboxProject>) => void;
  onDeleteSavedProject: (id: string) => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onExportMasterWav: () => void;
  onExportStemsWav: () => void;
  onExportMidi: () => void;
  onOpenCoachMarks: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  project,
  isPlaying,
  isRecording,
  isWavRecording,
  pLockLatch,
  selectedStep,
  canUndo,
  canRedo,
  midiInputs,
  savedProjects,
  onConnectMidi,
  onTogglePlay,
  onToggleRecord,
  onToggleWavRecord,
  onTogglePLockLatch,
  onModeChange,
  onBpmChange,
  onGrooveChange,
  onKeyScaleChange,
  onPatternSelect,
  onClonePattern,
  onToggleEco,
  onToggleSafeLock,
  onFillHold,
  onBuildDropHold,
  onSceneCrossfade,
  onMasterVolumeChange,
  onUndo,
  onRedo,
  onLoadStarterProject,
  onSaveProjectToDb,
  onLoadSavedProject,
  onDeleteSavedProject,
  onExportJson,
  onImportJsonFile,
  onExportMasterWav,
  onExportStemsWav,
  onExportMidi,
  onOpenCoachMarks,
}) => {
  const { t } = useTranslation();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [patternPopoverOpen, setPatternPopoverOpen] = useState(false);
  const [safeHoldProgress, setSafeHoldProgress] = useState(0);

  const tapTimesRef = useRef<number[]>([]);
  const safeHoldTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 2500);
    taps.push(now);
    tapTimesRef.current = taps;
    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i++) {
        sum += taps[i] - taps[i - 1];
      }
      const avgMs = sum / (taps.length - 1);
      const tappedBpm = Math.min(240, Math.max(40, Math.round(60000 / avgMs)));
      onBpmChange(tappedBpm);
    }
  };

  // 3-Second Press-and-Hold for Kid-Safe / Parent Lock (`🔒 SAFE MODE`)
  const startSafeHold = () => {
    if (!project.safeLockEnabled) {
      onToggleSafeLock();
      return;
    }
    const start = performance.now();
    safeHoldTimerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setSafeHoldProgress(pct);
      if (elapsed >= 3000) {
        if (safeHoldTimerRef.current !== null) {
          window.clearInterval(safeHoldTimerRef.current);
          safeHoldTimerRef.current = null;
        }
        setSafeHoldProgress(0);
        onToggleSafeLock();
      }
    }, 50);
  };

  const cancelSafeHold = () => {
    if (safeHoldTimerRef.current !== null) {
      window.clearInterval(safeHoldTimerRef.current);
      safeHoldTimerRef.current = null;
    }
    setSafeHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      if (safeHoldTimerRef.current !== null) {
        window.clearInterval(safeHoldTimerRef.current);
      }
    };
  }, []);

  const isPro = project.mode === 'pro';

  return (
    <header className="h-14 shrink-0 border-b border-white/10 bg-[#12151E] px-2.5 flex items-center justify-between gap-2 relative z-30">
      {/* Left Group: Transport, Overdub Record, P-Lock Latch & BPM/Swing */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePlay}
          className={`h-9 px-3.5 rounded-lg font-studio-mono text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
            isPlaying
              ? 'bg-emerald-400 text-black shadow-[0_0_14px_rgba(52,211,153,0.5)]'
              : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
          }`}
        >
          <span>{isPlaying ? t('transport.stop', '■ STOP') : t('transport.play', '▶ PLAY')}</span>
        </button>

        <button
          type="button"
          onClick={onToggleRecord}
          title="Overdub Live Note & Motion Recording (Shortcut: R)"
          className={`h-9 px-2.5 rounded-lg font-studio-mono text-xs font-bold transition-all cursor-pointer border ${
            isRecording
              ? 'bg-rose-500 text-black border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
          }`}
        >
          ● REC
        </button>

        <button
          type="button"
          onClick={onTogglePLockLatch}
          title="Single-Pointer Parameter Lock Latch Mode (Shortcut: L)"
          className={`h-9 px-2.5 rounded-lg font-studio-mono text-[11px] font-bold transition-all cursor-pointer border ${
            pLockLatch
              ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
          }`}
        >
          🔒 P-LOCK
          {pLockLatch && selectedStep
            ? ` [S${selectedStep.stepIndex + 1}]`
            : ''}
        </button>

        {/* BPM Steppers & Tap Tempo */}
        <div className="flex items-center bg-black/45 rounded-lg border border-white/10 px-1.5 h-9 gap-1">
          <button
            type="button"
            onClick={() => onBpmChange(Math.max(40, project.bpm - 1))}
            className="w-5 h-6 rounded bg-white/5 hover:bg-white/15 text-xs font-bold text-gray-300 cursor-pointer"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleTapTempo}
            title="Click repeatedly to Tap Tempo"
            className="px-1.5 text-center cursor-pointer"
          >
            <div className="font-studio-mono text-xs font-bold text-rose-400 leading-none">
              {project.bpm}
            </div>
            <div className="text-[8px] font-studio-mono text-gray-400 uppercase">
              BPM•TAP
            </div>
          </button>
          <button
            type="button"
            onClick={() => onBpmChange(Math.min(240, project.bpm + 1))}
            className="w-5 h-6 rounded bg-white/5 hover:bg-white/15 text-xs font-bold text-gray-300 cursor-pointer"
          >
            +
          </button>
        </div>

        {/* Groove / Swing Selector */}
        <select
          aria-label="Groove Template"
          value={project.grooveTemplate}
          onChange={(e) => {
            const tpl = e.target.value;
            const swingVal = GROOVE_TEMPLATES[tpl]?.swing ?? 0;
            onGrooveChange(tpl, swingVal);
          }}
          className="hidden xl:block h-9 px-2 rounded-lg bg-black/45 border border-white/10 font-studio-mono text-[11px] text-gray-200 cursor-pointer"
        >
          {Object.keys(GROOVE_TEMPLATES).map((k) => (
            <option key={k} value={k} className="bg-[#12151E]">
              {GROOVE_TEMPLATES[k].label}
            </option>
          ))}
        </select>
      </div>

      {/* Center Group: PLAY / STUDIO Persona Switcher, Performance Strip & Key/Scale */}
      <div className="flex items-center gap-1.5">
        {/* Dual-Mode Toggle: BEGINNER (PLAY) vs PRO (STUDIO) */}
        <div className="flex items-center bg-black/55 p-0.5 rounded-lg border border-white/10 h-9">
          <button
            type="button"
            onClick={() => onModeChange('beginner')}
            className={`h-7 px-2.5 rounded-md font-studio-mono text-[11px] font-bold transition-all cursor-pointer ${
              !isPro
                ? 'bg-rose-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('mode.beginner', '🎮 PLAY')}
          </button>
          <button
            type="button"
            disabled={project.safeLockEnabled}
            onClick={() => onModeChange('pro')}
            title={
              project.safeLockEnabled
                ? 'Locked in Kid-Safe Mode (Hold Safe Lock 3s in Project Menu to unlock)'
                : 'Switch to Pro Studio Workstation Mode'
            }
            className={`h-7 px-2.5 rounded-md font-studio-mono text-[11px] font-bold transition-all cursor-pointer ${
              isPro
                ? 'bg-sky-400 text-black shadow'
                : project.safeLockEnabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white'
            }`}
          >
            {isPro ? t('mode.pro', '🎛️ STUDIO') : `🎛️ STUDIO ${project.safeLockEnabled ? '🔒' : ''}`}
          </button>
        </div>

        {/* Momentary 🔥 BUILD & DROP Hold Strip */}
        <button
          type="button"
          onPointerDown={() => onBuildDropHold(true)}
          onPointerUp={() => onBuildDropHold(false)}
          onPointerLeave={() => onBuildDropHold(false)}
          className="h-9 px-2.5 rounded-lg bg-gradient-to-r from-orange-500/20 to-rose-500/20 hover:from-orange-500/40 hover:to-rose-500/40 active:bg-orange-500 active:text-black border border-orange-500/40 font-studio-mono text-[11px] font-bold text-orange-300 transition-all cursor-pointer touch-none-control"
          title="Hold to high-pass low-end, swell reverb & trigger snare roll; release on the beat to drop!"
        >
          🔥 BUILD &amp; DROP
        </button>

        {/* Pro Mode: FILL Button & A/B Scene Crossfader */}
        {isPro && (
          <>
            <button
              type="button"
              onPointerDown={() => onFillHold(true)}
              onPointerUp={() => onFillHold(false)}
              onPointerLeave={() => onFillHold(false)}
              className="hidden lg:flex h-9 px-2.5 items-center rounded-lg bg-amber-500/15 hover:bg-amber-500/30 active:bg-amber-400 active:text-black border border-amber-500/35 font-studio-mono text-[11px] font-bold text-amber-300 cursor-pointer touch-none-control"
              title="Hold to trigger steps with the FILL condition"
            >
              ⚡ FILL
            </button>

            <div
              className="hidden 2xl:flex items-center gap-1.5 bg-black/45 px-2 h-9 rounded-lg border border-white/10"
              title="Morph between Scene A and Scene B parameter snapshots"
            >
              <span className="font-studio-mono text-[9px] font-bold text-sky-400">
                SCN A
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={project.sceneCrossfader}
                onChange={(e) => onSceneCrossfade(Number(e.target.value))}
                className="w-16 accent-sky-400 cursor-pointer"
              />
              <span className="font-studio-mono text-[9px] font-bold text-fuchsia-400">
                B
              </span>
            </div>
          </>
        )}

        {/* Global Song Key & Scale Selector */}
        <div className="hidden md:flex items-center bg-black/45 rounded-lg border border-white/10 h-9 px-1.5 gap-1">
          <select
            aria-label="Root Note"
            value={project.rootNote}
            onChange={(e) =>
              onKeyScaleChange(Number(e.target.value), project.scaleName)
            }
            className="bg-transparent font-studio-mono text-xs font-bold text-cyan-300 cursor-pointer"
          >
            {ROOT_NOTE_NAMES.map((n, idx) => (
              <option key={n} value={idx} className="bg-[#12151E]">
                {n}
              </option>
            ))}
          </select>
          <select
            aria-label="Scale Mode"
            value={project.scaleName}
            onChange={(e) =>
              onKeyScaleChange(project.rootNote, e.target.value)
            }
            className="bg-transparent font-studio-mono text-[11px] text-gray-200 cursor-pointer"
          >
            {Object.keys(SCALE_DEFINITIONS).map((s) => (
              <option key={s} value={s} className="bg-[#12151E]">
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Pattern Bank Selector (A1-D4) + Clone */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPatternPopoverOpen((v) => !v)}
            className="h-9 px-2.5 rounded-lg bg-black/45 hover:bg-white/10 border border-white/15 font-studio-mono text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
          >
            <span className="text-gray-400 text-[10px]">PAT</span>
            <span className="text-rose-400">{project.activePatternId}</span>
          </button>

          {patternPopoverOpen && (
            <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-white/15 bg-[#151821] p-3 shadow-2xl z-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-studio-mono text-[10px] font-bold uppercase text-gray-400">
                  PATTERN BANK (A1–D4)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClonePattern();
                    setPatternPopoverOpen(false);
                  }}
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-studio-mono text-[10px] font-bold cursor-pointer"
                >
                  + CLONE TO NEXT
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {PATTERN_BANK_IDS.map((pid) => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => {
                      onPatternSelect(pid);
                      setPatternPopoverOpen(false);
                    }}
                    className={`py-1.5 rounded font-studio-mono text-xs font-bold transition-all cursor-pointer ${
                      project.activePatternId === pid
                        ? 'bg-rose-500 text-black shadow'
                        : 'bg-white/5 hover:bg-white/15 text-gray-200'
                    }`}
                  >
                    {pid}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Group: Undo/Redo, Live WAV Rec, ECO, Project Menu, Coach Marks & Master Vol */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          className="h-9 w-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-xs font-bold cursor-pointer"
        >
          ↶
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="h-9 w-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-xs font-bold cursor-pointer"
        >
          ↷
        </button>

        <button
          type="button"
          onClick={onToggleWavRecord}
          title="Capture real-time 48kHz stereo master output to .WAV"
          className={`hidden sm:flex h-9 px-2.5 items-center rounded-lg font-studio-mono text-[11px] font-bold border transition-all cursor-pointer ${
            isWavRecording
              ? 'bg-red-600 text-white border-red-400 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
          }`}
        >
          {isWavRecording ? '■ .WAV' : '● .WAV'}
        </button>

        <button
          type="button"
          onClick={onToggleEco}
          title="ECO Mode (30fps canvas throttle & extended buffer for portable tablets)"
          className={`hidden xl:flex h-9 px-2 items-center rounded-lg font-studio-mono text-[10px] font-bold border cursor-pointer ${
            project.ecoMode
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          ECO
        </button>

        {/* Sample Patch Quick Selector (25 Sample Patches: Play, Studio & Hip Hop) */}
        <select
          aria-label="Sample Patch Selector"
          value={project.id.replace(/^proj_/, '')}
          onChange={(e) => onLoadStarterProject(e.target.value)}
          className="hidden md:block h-9 px-2 rounded-lg bg-black/45 border border-white/15 font-studio-mono text-[11px] font-bold text-amber-300 cursor-pointer max-w-[175px] truncate"
          title="Load Factory Sample Patches (Play Mode, Studio Pro & Hip Hop Beats)"
        >
          <optgroup label="🎤 5 HIP HOP FACTORY BEATS" className="bg-[#12151E] text-amber-300">
            {STARTER_PROJECT_SPECS.filter((s) => s.id.startsWith('hiphop-')).map(
              (s) => (
                <option key={s.id} value={s.id} className="bg-[#12151E] text-white">
                  🎤 {s.name} ({s.bpm} BPM)
                </option>
              )
            )}
          </optgroup>
          <optgroup label="🌱 10 PLAY MODE SAMPLE PATCHES" className="bg-[#12151E] text-rose-300">
            {STARTER_PROJECT_SPECS.filter((s) => s.modeTag === 'beginner' && !s.id.startsWith('hiphop-')).map(
              (s) => (
                <option key={s.id} value={s.id} className="bg-[#12151E] text-white">
                  🎮 {s.name} ({s.bpm} BPM)
                </option>
              )
            )}
          </optgroup>
          <optgroup label="🎛️ 10 STUDIO PRO SAMPLE PATCHES" className="bg-[#12151E] text-sky-300">
            {STARTER_PROJECT_SPECS.filter((s) => s.modeTag === 'pro' && !s.id.startsWith('hiphop-')).map(
              (s) => (
                <option key={s.id} value={s.id} className="bg-[#12151E] text-white">
                  🎛️ {s.name} ({s.bpm} BPM)
                </option>
              )
            )}
          </optgroup>
        </select>

        {/* Project Menu Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProjectMenuOpen((v) => !v)}
            className="h-9 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 font-studio-mono text-xs font-bold text-rose-200 cursor-pointer flex items-center gap-1"
          >
            <span>📁 PROJECT</span>
          </button>

          {projectMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-white/15 bg-[#151821] p-3.5 shadow-2xl z-50 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <div className="text-xs font-bold text-white">
                    {project.name}
                  </div>
                  <div className="text-[10px] font-studio-mono text-gray-400">
                    suite_groovebox_db •{' '}
                    {midiInputs.length > 0
                      ? `MIDI: ${midiInputs[0]}`
                      : 'Web Audio 48kHz'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onConnectMidi}
                    className="px-2 py-0.5 rounded bg-indigo-500/25 border border-indigo-500/40 text-[10px] font-studio-mono text-indigo-200 hover:bg-indigo-500/40 cursor-pointer"
                    title="Request Web MIDI API access on demand"
                  >
                    {midiInputs.length > 0 ? '✓ MIDI ON' : 'CONNECT MIDI'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectMenuOpen(false)}
                    className="text-xs text-gray-400 hover:text-white px-1.5 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 25 Sample Patches (5 Hip Hop + 10 Play Mode + 10 Studio Pro Mode) */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div>
                  <div className="font-studio-mono text-[10px] font-bold uppercase text-amber-400 mb-1">
                    🎤 5 HIP HOP FACTORY BEATS
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {STARTER_PROJECT_SPECS.filter((sp) => sp.id.startsWith('hiphop-')).map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          onLoadStarterProject(sp.id);
                          setProjectMenuOpen(false);
                        }}
                        className="p-1.5 rounded bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-left transition-colors cursor-pointer"
                      >
                        <div className="text-[10px] font-bold text-white truncate">
                          {sp.name}
                        </div>
                        <div className="text-[8px] font-studio-mono text-gray-400 truncate">
                          {sp.bpm} BPM • {ROOT_NOTE_NAMES[sp.rootNote]} {sp.scaleName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-studio-mono text-[10px] font-bold uppercase text-rose-400 mb-1">
                    🌱 10 PLAY (BEGINNER) SAMPLE PATCHES
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {STARTER_PROJECT_SPECS.filter(
                      (sp) => sp.modeTag === 'beginner' && !sp.id.startsWith('hiphop-')
                    ).map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          onLoadStarterProject(sp.id);
                          setProjectMenuOpen(false);
                        }}
                        className="p-1.5 rounded bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-left transition-colors cursor-pointer"
                      >
                        <div className="text-[10px] font-bold text-white truncate">
                          {sp.name}
                        </div>
                        <div className="text-[8px] font-studio-mono text-gray-400 truncate">
                          {sp.bpm} BPM • {ROOT_NOTE_NAMES[sp.rootNote]} {sp.scaleName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-studio-mono text-[10px] font-bold uppercase text-sky-400 mb-1">
                    🎛️ 10 STUDIO (PRO) SAMPLE PATCHES
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {STARTER_PROJECT_SPECS.filter(
                      (sp) => sp.modeTag === 'pro' && !sp.id.startsWith('hiphop-')
                    ).map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          onLoadStarterProject(sp.id);
                          setProjectMenuOpen(false);
                        }}
                        className="p-1.5 rounded bg-white/5 hover:bg-sky-500/20 border border-white/10 hover:border-sky-500/40 text-left transition-colors cursor-pointer"
                      >
                        <div className="text-[10px] font-bold text-white truncate">
                          {sp.name}
                        </div>
                        <div className="text-[8px] font-studio-mono text-gray-400 truncate">
                          {sp.bpm} BPM • {ROOT_NOTE_NAMES[sp.rootNote]} {sp.scaleName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Multi-Format Exports */}
              <div>
                <div className="font-studio-mono text-[10px] font-bold uppercase text-sky-400 mb-1.5">
                  📦 MULTI-FORMAT STUDIO EXPORTS
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-studio-mono text-[11px]">
                  <button
                    type="button"
                    onClick={onSaveProjectToDb}
                    className="py-1.5 px-2 rounded bg-rose-500 text-black font-bold hover:bg-rose-400 cursor-pointer"
                  >
                    💾 SAVE TO DB
                  </button>
                  <button
                    type="button"
                    onClick={onExportJson}
                    className="py-1.5 px-2 rounded bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                  >
                    ⬇ EXPORT .JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1.5 px-2 rounded bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                  >
                    📂 IMPORT .JSON
                  </button>
                  <button
                    type="button"
                    onClick={onExportMidi}
                    className="py-1.5 px-2 rounded bg-indigo-500/25 hover:bg-indigo-500/35 text-indigo-200 border border-indigo-500/40 cursor-pointer"
                  >
                    🎹 EXPORT .MID
                  </button>
                  <button
                    type="button"
                    onClick={onExportMasterWav}
                    className="py-1.5 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 cursor-pointer"
                  >
                    🔊 MASTER .WAV
                  </button>
                  <button
                    type="button"
                    onClick={onExportStemsWav}
                    className="py-1.5 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 cursor-pointer"
                  >
                    🎚️ 8 STEMS .WAV
                  </button>
                </div>
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
                      setProjectMenuOpen(false);
                    }
                  }}
                />
              </div>

              {/* Saved DB Projects List */}
              {savedProjects.length > 0 && (
                <div className="max-h-28 overflow-y-auto rounded bg-black/40 p-1.5 border border-white/5 space-y-1">
                  {savedProjects.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between text-xs font-studio-mono px-2 py-1 rounded bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onLoadSavedProject(rec);
                          setProjectMenuOpen(false);
                        }}
                        className="text-left text-gray-200 hover:text-rose-300 truncate flex-1 cursor-pointer"
                      >
                        {rec.name}
                      </button>
                      {!project.safeLockEnabled && (
                        <button
                          type="button"
                          onClick={() => onDeleteSavedProject(rec.id)}
                          className="text-[10px] text-gray-500 hover:text-rose-400 ml-2 cursor-pointer"
                        >
                          DEL
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Kid-Safe / Parent Lock (`🔒 SAFE MODE`) */}
              <div className="pt-1 border-t border-white/10">
                <button
                  type="button"
                  onPointerDown={startSafeHold}
                  onPointerUp={cancelSafeHold}
                  onPointerLeave={cancelSafeHold}
                  className={`w-full py-2 px-3 rounded-lg font-studio-mono text-xs font-bold border relative overflow-hidden cursor-pointer ${
                    project.safeLockEnabled
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {safeHoldProgress > 0 && (
                    <span
                      className="absolute inset-y-0 left-0 bg-amber-400/35 transition-all"
                      style={{ width: `${safeHoldProgress}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {project.safeLockEnabled
                      ? '🔒 KID-SAFE LOCK ON (HOLD 3s TO UNLOCK)'
                      : '🔓 ENABLE KID-SAFE MODE'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Coach Marks Help Button */}
        <button
          type="button"
          onClick={onOpenCoachMarks}
          title="Open 3-Step Interactive Walkthrough"
          className="h-9 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-studio-mono text-xs font-bold text-gray-300 hover:text-white cursor-pointer"
        >
          ?
        </button>

        {/* Master Volume Slider */}
        <div
          className="hidden lg:flex items-center gap-1.5 bg-black/45 px-2 h-9 rounded-lg border border-white/10"
          title="Master Output Volume"
        >
          <span className="font-studio-mono text-[9px] font-bold text-gray-400">
            VOL
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={project.globalFx.masterVolume}
            onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
            className="w-16 accent-rose-500 cursor-pointer"
          />
        </div>
      </div>
    </header>
  );
};
