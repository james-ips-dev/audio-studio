import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInstrumentStorage,
  IncompatiblePatchError,
} from '../../core/storageFactory';
import type {
  InstrumentComponentProps,
  StoredPatchRecord,
} from '../../core/types';
import { ConfirmModal } from '../../shared-ui/ConfirmModal';
import { LiveStereoWavRecorder } from '../../shared-ui/WavExporter';
import { GrooveboxAudioEngine } from './audio/GrooveboxAudioEngine';
import {
  downloadMidiFile,
  GrooveboxMidiManager,
} from './audio/MidiExporter';
import { StepSequencerGrid } from './components/StepSequencerGrid';
import { TransportBar } from './components/TransportBar';
import { KaossPadTab } from './components/tabs/KaossPadTab';
import { MixerFxTab } from './components/tabs/MixerFxTab';
import { PadsArpTab } from './components/tabs/PadsArpTab';
import { PerformanceTab } from './components/tabs/PerformanceTab';
import { PianoRollSongTab } from './components/tabs/PianoRollSongTab';
import { SynthEngineTab } from './components/tabs/SynthEngineTab';
import {
  applyAnswerMeCoPlay,
  computeEuclideanSteps,
  createEmptyStep,
  createStarterProject,
  getScaleNotes,
  PATTERN_BANK_IDS,
} from './presets/factoryPresets';
import type {
  AppMode,
  GrooveboxProject,
  GrooveDeckTab,
  InsertFxType,
  ProSynthConfig,
  StepData,
  TrackConfig,
} from './types';
import './groovebox.css';

const DECK_TABS: { id: GrooveDeckTab; label: string; icon: string }[] = [
  { id: 'synth', label: 'SYNTH ENGINE', icon: '🎛️' },
  { id: 'mixer', label: 'MIXER & FX', icon: '🎚️' },
  { id: 'pads', label: 'PADS & ARP', icon: '🎹' },
  { id: 'kaoss', label: 'KAOSS PAD', icon: '🌀' },
  { id: 'performance', label: 'PERFORMANCE', icon: '🚀' },
  { id: 'pianoroll', label: 'PIANO ROLL & SONG', icon: '🎼' },
];

const QWERTY_NOTE_MAP: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
};

export const GrooveboxRoot: React.FC<InstrumentComponentProps> = ({
  registerHandle,
  storageNamespace,
}) => {
  const storage = useMemo(
    () =>
      createInstrumentStorage<GrooveboxProject>(
        storageNamespace,
        'groovebox',
        'v4.0'
      ),
    [storageNamespace]
  );

  const [project, setProject] = useState<GrooveboxProject>(() =>
    createStarterProject('space-mission')
  );
  const [undoStack, setUndoStack] = useState<GrooveboxProject[]>([]);
  const [redoStack, setRedoStack] = useState<GrooveboxProject[]>([]);

  const [focusedTrackIndex, setFocusedTrackIndex] = useState<number>(4); // Default focus: Track 5 (BASS)
  const [activeTab, setActiveTab] = useState<GrooveDeckTab>('synth');
  const [isDeckExpanded, setIsDeckExpanded] = useState<boolean>(false);

  const [visibleBar, setVisibleBar] = useState<number>(0);
  const [autoFollowBar, setAutoFollowBar] = useState<boolean>(true);
  const [currentGlobalStep, setCurrentGlobalStep] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isWavRecording, setIsWavRecording] = useState<boolean>(false);
  const [pLockLatch, setPLockLatch] = useState<boolean>(false);
  const [selectedStep, setSelectedStep] = useState<{
    trackIndex: number;
    stepIndex: number;
  } | null>({ trackIndex: 4, stepIndex: 0 });

  const [qwertyOctave, setQwertyOctave] = useState<number>(3);
  const [midiInputs, setMidiInputs] = useState<string[]>([]);
  const [savedProjects, setSavedProjects] = useState<
    StoredPatchRecord<GrooveboxProject>[]
  >([]);
  const [coachStep, setCoachStep] = useState<number | null>(null);
  const [modalAlert, setModalAlert] = useState<{
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
  } | null>(null);

  const [engine] = useState<GrooveboxAudioEngine>(
    () => new GrooveboxAudioEngine(project)
  );

  const wavRecorderRef = useRef<LiveStereoWavRecorder | null>(null);
  const projectRef = useRef<GrooveboxProject>(project);
  const focusedTrackRef = useRef<number>(focusedTrackIndex);
  const isRecordingRef = useRef<boolean>(isRecording);
  const currentStepRef = useRef<number>(currentGlobalStep);

  useEffect(() => {
    projectRef.current = project;
    engine.updateProject(project);
  }, [project, engine]);

  useEffect(() => {
    focusedTrackRef.current = focusedTrackIndex;
  }, [focusedTrackIndex]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    currentStepRef.current = currentGlobalStep;
  }, [currentGlobalStep]);

  // Helper to commit a structural change with Undo history
  const commitProjectChange = useCallback(
    (updater: (prev: GrooveboxProject) => GrooveboxProject) => {
      setProject((prev) => {
        setUndoStack((u) => [...u.slice(-19), prev]);
        setRedoStack([]);
        return { ...updater(prev), updatedAt: Date.now() };
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const last = prevUndo[prevUndo.length - 1];
      setProject((cur) => {
        setRedoStack((r) => [...r, cur]);
        return last;
      });
      return prevUndo.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[prevRedo.length - 1];
      setProject((cur) => {
        setUndoStack((u) => [...u, cur]);
        return next;
      });
      return prevRedo.slice(0, -1);
    });
  }, []);

  // Subscribe to playhead step updates from GrooveboxAudioEngine
  useEffect(() => {
    return engine.onPlayheadStep((globalStep) => {
      setCurrentGlobalStep(globalStep);
      if (autoFollowBar) {
        setVisibleBar(Math.floor(globalStep / 16));
      }
    });
  }, [engine, autoFollowBar]);

  // Register deterministic InstrumentHandle with Host Shell
  const suspendAndCleanup = useCallback(async () => {
    if (wavRecorderRef.current) {
      wavRecorderRef.current.dispose();
      wavRecorderRef.current = null;
    }
    setIsPlaying(false);
    setIsWavRecording(false);
    await engine.dispose();
  }, [engine]);

  useEffect(() => {
    registerHandle({
      suspendAndCleanup,
      isAudioActive: () => {
        const ctx = engine.getAudioContext();
        return Boolean(ctx && ctx.state === 'running' && engine.isEnginePlaying());
      },
    });
    // Do NOT trigger suspendAndCleanup on unmount in dev StrictMode or re-renders
    // Host Shell triggers suspendAndCleanup explicitly via registerHandle when changing outer tabs
  }, [registerHandle, suspendAndCleanup, engine]);

  // Restore isolated IndexedDB session & projects on mount
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const restored = await storage.loadAutosave<GrooveboxProject>();
      if (
        mounted &&
        restored &&
        Array.isArray(restored.tracks) &&
        restored.tracks.length === 8
      ) {
        setProject(restored);
      }
      const saved = await storage.listPatches();
      if (mounted) {
        setSavedProjects(saved);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [storage]);

  // Continuous autosave to `suite_groovebox_db`
  useEffect(() => {
    void storage.saveAutosave(project);
  }, [project, storage]);

  // Web MIDI API input manager (on-demand connect only to prevent clickjacking/permission prompt blocks on managed tablets)
  const midiManagerRef = useRef<GrooveboxMidiManager | null>(null);

  const handleConnectMidi = useCallback(async () => {
    if (midiManagerRef.current) return;
    const midiMgr = new GrooveboxMidiManager({
      onNoteOn: (midiNote, velocity) => {
        const trkIdx = focusedTrackRef.current;
        engine.triggerLiveNote(trkIdx, midiNote, velocity, 0.25);
      },
      onControlChange: (cc, valNorm) => {
        if (cc === 74) {
          const cutoff = Math.round(40 * Math.pow(18000 / 40, valNorm));
          const trkIdx = focusedTrackRef.current;
          setProject((prev) => ({
            ...prev,
            tracks: prev.tracks.map((t, i) =>
              i === trkIdx
                ? {
                    ...t,
                    synth: {
                      ...t.synth,
                      filter: { ...t.synth.filter, cutoff },
                    },
                  }
                : t
            ),
          }));
        }
      },
      onStatusChange: (names) => setMidiInputs(names),
    });

    midiManagerRef.current = midiMgr;
    const inputs = await midiMgr.connect();
    setMidiInputs(inputs);
  }, [engine]);

  useEffect(() => {
    return () => {
      if (midiManagerRef.current) {
        midiManagerRef.current.dispose();
        midiManagerRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      await engine.start();
      setIsPlaying(true);
    }
  }, [engine, isPlaying]);

  const handleTriggerLiveAndRecord = useCallback(
    (trackIndex: number, midiNotes: number[], velocity: number = 0.85) => {
      for (const n of midiNotes) {
        engine.triggerLiveNote(trackIndex, n, velocity, 0.28);
      }
      if (isRecordingRef.current && isPlaying) {
        const stepIdx = currentStepRef.current;
        setProject((prev) => {
          const patId = prev.activePatternId;
          const pat = prev.patterns[patId];
          if (!pat) return prev;
          const nextTracks = pat.tracks.map((seq) => {
            if (seq.trackIndex !== trackIndex) return seq;
            const localIdx = stepIdx % seq.lengthSteps;
            const nextSteps = seq.steps.map((s, idx) =>
              idx === localIdx
                ? {
                    ...s,
                    active: true,
                    velocity,
                    notes: midiNotes.map((m) => ({
                      midiNote: m,
                      velocity,
                      durationSteps: 1,
                      glide: false,
                    })),
                  }
                : s
            );
            return { ...seq, steps: nextSteps };
          });
          return {
            ...prev,
            patterns: {
              ...prev.patterns,
              [patId]: { ...pat, tracks: nextTracks },
            },
          };
        });
      }
    },
    [engine, isPlaying]
  );

  // Scoped Desktop PC Keyboard Shortcuts & QWERTY Note Input (Section 5)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
        return;
      }

      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsRecording((v) => !v);
        return;
      }

      if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPLockLatch((v) => !v);
        return;
      }

      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const idx = focusedTrackRef.current;
        setProject((prev) => ({
          ...prev,
          tracks: prev.tracks.map((t, i) =>
            i === idx
              ? { ...t, mixer: { ...t.mixer, mute: !t.mixer.mute } }
              : t
          ),
        }));
        return;
      }

      if (e.code === 'KeyZ') {
        setQwertyOctave((o) => Math.max(1, o - 1));
        return;
      }
      if (e.code === 'KeyX') {
        setQwertyOctave((o) => Math.min(6, o + 1));
        return;
      }

      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.replace('Digit', ''));
        if (num >= 1 && num <= 8) {
          setFocusedTrackIndex(num - 1);
          return;
        }
      }

      if (e.code in QWERTY_NOTE_MAP && !e.repeat) {
        const scalePool = getScaleNotes(
          projectRef.current.rootNote,
          projectRef.current.scaleName,
          qwertyOctave,
          16
        );
        const offset = QWERTY_NOTE_MAP[e.code];
        const midi = scalePool[offset % scalePool.length];
        handleTriggerLiveAndRecord(focusedTrackRef.current, [midi], 0.85);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleRedo,
    handleTogglePlay,
    handleTriggerLiveAndRecord,
    handleUndo,
    qwertyOctave,
  ]);

  const handleToggleWavRecord = useCallback(() => {
    const ctx = engine.ensureInitialized();
    const gain = engine.getMasterGain();
    if (!gain) return;

    if (!isWavRecording) {
      const rec = new LiveStereoWavRecorder(ctx, gain);
      rec.start();
      wavRecorderRef.current = rec;
      setIsWavRecording(true);
    } else {
      wavRecorderRef.current?.stopAndExport(
        `${project.name.toLowerCase().replace(/\s+/g, '-')}-live`
      );
      wavRecorderRef.current = null;
      setIsWavRecording(false);
    }
  }, [engine, isWavRecording, project.name]);

  const handleUpdateStepData = useCallback(
    (
      trackIndex: number,
      stepIndex: number,
      updater: (prev: StepData) => StepData
    ) => {
      setProject((prev) => {
        const patId = prev.activePatternId;
        const pat = prev.patterns[patId];
        if (!pat) return prev;
        const nextTracks = pat.tracks.map((seq) => {
          if (seq.trackIndex !== trackIndex) return seq;
          const nextSteps = seq.steps.map((s, idx) =>
            idx === stepIndex ? updater(s) : s
          );
          return { ...seq, steps: nextSteps };
        });
        return {
          ...prev,
          patterns: {
            ...prev.patterns,
            [patId]: { ...pat, tracks: nextTracks },
          },
        };
      });
    },
    []
  );

  const handleToggleStep = useCallback(
    (trackIndex: number, stepIndex: number, forceState?: boolean) => {
      handleUpdateStepData(trackIndex, stepIndex, (prev) => ({
        ...prev,
        active: forceState !== undefined ? forceState : !prev.active,
      }));
    },
    [handleUpdateStepData]
  );

  const handleWriteStepPLock = useCallback(
    (paramKey: string, val: number) => {
      if (!selectedStep) return;
      handleUpdateStepData(
        selectedStep.trackIndex,
        selectedStep.stepIndex,
        (prev) => ({
          ...prev,
          pLocks: { ...prev.pLocks, [paramKey]: val },
        })
      );
    },
    [handleUpdateStepData, selectedStep]
  );

  const focusedTrack = project.tracks[focusedTrackIndex] ?? project.tracks[0];

  return (
    <div className="inst-groovebox h-full w-full overflow-hidden flex flex-col select-none relative">
      {/* ====================================================================
          ZONE 1: TOP GLOBAL TRANSPORT, STATUS & MASTER BAR (~56px)
          ==================================================================== */}
      <TransportBar
        project={project}
        isPlaying={isPlaying}
        isRecording={isRecording}
        isWavRecording={isWavRecording}
        pLockLatch={pLockLatch}
        selectedStep={selectedStep}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        midiInputs={midiInputs}
        savedProjects={savedProjects}
        onConnectMidi={handleConnectMidi}
        onTogglePlay={handleTogglePlay}
        onToggleRecord={() => setIsRecording((v) => !v)}
        onToggleWavRecord={handleToggleWavRecord}
        onTogglePLockLatch={() => setPLockLatch((v) => !v)}
        onModeChange={(mode: AppMode) =>
          setProject((prev) => ({ ...prev, mode }))
        }
        onBpmChange={(bpm) => setProject((prev) => ({ ...prev, bpm }))}
        onGrooveChange={(grooveTemplate, swing) =>
          setProject((prev) => ({ ...prev, grooveTemplate, swing }))
        }
        onKeyScaleChange={(rootNote, scaleName) =>
          setProject((prev) => ({ ...prev, rootNote, scaleName }))
        }
        onPatternSelect={(activePatternId) =>
          setProject((prev) => ({
            ...prev,
            activePatternId,
            performance: {
              ...prev.performance,
              activeTrackPatterns: Array(8).fill(activePatternId),
            },
          }))
        }
        onClonePattern={() => {
          commitProjectChange((prev) => {
            const curIdx = PATTERN_BANK_IDS.indexOf(
              prev.activePatternId as (typeof PATTERN_BANK_IDS)[number]
            );
            const nextId =
              PATTERN_BANK_IDS[(curIdx + 1) % PATTERN_BANK_IDS.length];
            const cloned = JSON.parse(
              JSON.stringify(prev.patterns[prev.activePatternId])
            );
            cloned.id = nextId;
            return {
              ...prev,
              activePatternId: nextId,
              patterns: { ...prev.patterns, [nextId]: cloned },
            };
          });
        }}
        onToggleEco={() =>
          setProject((prev) => ({ ...prev, ecoMode: !prev.ecoMode }))
        }
        onToggleSafeLock={() =>
          setProject((prev) => ({
            ...prev,
            safeLockEnabled: !prev.safeLockEnabled,
            mode: !prev.safeLockEnabled ? 'beginner' : prev.mode,
          }))
        }
        onFillHold={(held) => engine.setFillHeld(held)}
        onBuildDropHold={(held) => engine.setBuildDropHeld(held)}
        onSceneCrossfade={(sceneCrossfader) =>
          setProject((prev) => ({ ...prev, sceneCrossfader }))
        }
        onMasterVolumeChange={(masterVolume) =>
          setProject((prev) => ({
            ...prev,
            globalFx: { ...prev.globalFx, masterVolume },
          }))
        }
        onUndo={handleUndo}
        onRedo={handleRedo}
        onLoadStarterProject={(specId) =>
          commitProjectChange(() => createStarterProject(specId))
        }
        onSaveProjectToDb={() =>
          void (async () => {
            const id = `gb_proj_${Date.now()}`;
            await storage.savePatch(
              id,
              `${project.name} (${project.bpm} BPM)`,
              project
            );
            setSavedProjects(await storage.listPatches());
          })()
        }
        onLoadSavedProject={(rec) => commitProjectChange(() => rec.payload)}
        onDeleteSavedProject={(id) =>
          void (async () => {
            await storage.deletePatch(id);
            setSavedProjects(await storage.listPatches());
          })()
        }
        onExportJson={() =>
          storage.exportPatchToJsonFile(
            `groovebox-${project.name.toLowerCase().replace(/\s+/g, '-')}.json`,
            project,
            project.name
          )
        }
        onImportJsonFile={(file) =>
          void (async () => {
            try {
              const env = await storage.importPatchFromFile(file);
              commitProjectChange(() => env.data);
              setModalAlert({
                title: 'Groovebox Project Loaded',
                message: `Successfully imported "${env.data.name || 'Project'}" (${env.schemaVersion}).`,
                variant: 'info',
              });
            } catch (err) {
              const isIncompat = err instanceof IncompatiblePatchError;
              setModalAlert({
                title: isIncompat
                  ? 'Incompatible Patch File Rejected'
                  : 'Import Error',
                message:
                  err instanceof Error
                    ? err.message
                    : 'Failed to import JSON file.',
                variant: isIncompat ? 'danger' : 'warning',
              });
            }
          })()
        }
        onExportMasterWav={() => engine.exportRenderedPatternWav()}
        onExportStemsWav={() => engine.exportAll8StemsWav()}
        onExportMidi={() => downloadMidiFile(project)}
        onOpenCoachMarks={() => setCoachStep(1)}
      />

      {/* ====================================================================
          ZONE 2: MIDDLE 8-TRACK EXTENDABLE STEP SEQUENCER
          (Collapses cleanly when Zone 3 `⤢ EXPAND / FOCUS` is active)
          ==================================================================== */}
      <div
        className="w-full transition-all duration-200 overflow-hidden"
        style={{ height: isDeckExpanded ? '22%' : '50%' }}
      >
        <StepSequencerGrid
          project={project}
          focusedTrackIndex={focusedTrackIndex}
          visibleBar={visibleBar}
          autoFollowBar={autoFollowBar}
          currentGlobalStep={currentGlobalStep}
          isPlaying={isPlaying}
          pLockLatch={pLockLatch}
          selectedStep={selectedStep}
          onSelectTrack={setFocusedTrackIndex}
          onSelectBar={(b) => {
            setAutoFollowBar(false);
            setVisibleBar(b);
          }}
          onToggleAutoFollow={() => setAutoFollowBar((v) => !v)}
          onSetPatternBars={(bars) =>
            commitProjectChange((prev) => {
              const pat = prev.patterns[prev.activePatternId];
              return {
                ...prev,
                patterns: {
                  ...prev.patterns,
                  [prev.activePatternId]: { ...pat, bars },
                },
              };
            })
          }
          onToggleStep={handleToggleStep}
          onSelectPLockStep={(trackIndex, stepIndex) =>
            setSelectedStep({ trackIndex, stepIndex })
          }
          onUpdateStepData={handleUpdateStepData}
          onSetTrackLength={(trackIndex, lengthSteps) =>
            commitProjectChange((prev) => {
              const pat = prev.patterns[prev.activePatternId];
              return {
                ...prev,
                patterns: {
                  ...prev.patterns,
                  [prev.activePatternId]: {
                    ...pat,
                    tracks: pat.tracks.map((t) =>
                      t.trackIndex === trackIndex ? { ...t, lengthSteps } : t
                    ),
                  },
                },
              };
            })
          }
          onApplyEuclidean={(trackIndex, stepsCount, pulses, rotation) =>
            commitProjectChange((prev) => {
              const hits = computeEuclideanSteps(stepsCount, pulses, rotation);
              const pat = prev.patterns[prev.activePatternId];
              const nextTracks = pat.tracks.map((seq) => {
                if (seq.trackIndex !== trackIndex) return seq;
                const nextSteps = seq.steps.map((s, idx) => ({
                  ...s,
                  active: hits[idx % stepsCount],
                }));
                return { ...seq, steps: nextSteps };
              });
              return {
                ...prev,
                patterns: {
                  ...prev.patterns,
                  [prev.activePatternId]: { ...pat, tracks: nextTracks },
                },
              };
            })
          }
          onToggleMute={(trackIndex) =>
            setProject((prev) => ({
              ...prev,
              tracks: prev.tracks.map((t, i) =>
                i === trackIndex
                  ? { ...t, mixer: { ...t.mixer, mute: !t.mixer.mute } }
                  : t
              ),
            }))
          }
          onToggleSolo={(trackIndex) =>
            setProject((prev) => ({
              ...prev,
              tracks: prev.tracks.map((t, i) =>
                i === trackIndex
                  ? { ...t, mixer: { ...t.mixer, solo: !t.mixer.solo } }
                  : t
              ),
            }))
          }
          onTrackVolumeChange={(trackIndex, volume) =>
            setProject((prev) => ({
              ...prev,
              tracks: prev.tracks.map((t, i) =>
                i === trackIndex ? { ...t, mixer: { ...t.mixer, volume } } : t
              ),
            }))
          }
          onAnswerMeCoPlay={(trackIndex) =>
            commitProjectChange((prev) => {
              const pat = prev.patterns[prev.activePatternId];
              const updatedPat = applyAnswerMeCoPlay(
                pat,
                trackIndex,
                prev.rootNote,
                prev.scaleName
              );
              return {
                ...prev,
                patterns: {
                  ...prev.patterns,
                  [prev.activePatternId]: updatedPat,
                },
              };
            })
          }
          onDuplicateBar1ToAll={() =>
            commitProjectChange((prev) => {
              const pat = prev.patterns[prev.activePatternId];
              const nextTracks = pat.tracks.map((seq) => {
                const nextSteps = seq.steps.map((_, idx) =>
                  JSON.parse(JSON.stringify(seq.steps[idx % 16]))
                );
                return { ...seq, steps: nextSteps };
              });
              return {
                ...prev,
                patterns: {
                  ...prev.patterns,
                  [prev.activePatternId]: { ...pat, tracks: nextTracks },
                },
              };
            })
          }
          onClearTrackSteps={(trackIndex) => {
            if (project.safeLockEnabled) return;
            commitProjectChange((prev) => {
              const pat = prev.patterns[prev.activePatternId];
              const defMidi = prev.tracks[trackIndex]?.isDrum ? 36 : 60;
              const nextTracks = pat.tracks.map((seq) =>
                seq.trackIndex === trackIndex
                  ? {
                      ...seq,
                      steps: Array.from({ length: 64 }, () =>
                        createEmptyStep(defMidi)
                      ),
                    }
                  : seq
              );
              return {
                ...prev,
                patterns: {
                  ...prev.patterns,
                  [prev.activePatternId]: { ...pat, tracks: nextTracks },
                },
              };
            });
          }}
        />
      </div>

      {/* ====================================================================
          ZONE 3: BOTTOM 6-TAB CONTEXTUAL DECK (Expandable to 78% Height)
          ==================================================================== */}
      <div
        className="w-full flex flex-col bg-[#0B0D13] overflow-hidden transition-all duration-200"
        style={{ height: isDeckExpanded ? '78%' : '50%' }}
      >
        {/* Deck Navigation Bar + `⤢ EXPAND / FOCUS` Toggle */}
        <div className="h-9 shrink-0 bg-[#12151E] border-b border-white/10 px-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {DECK_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    borderColor: active ? focusedTrack.color : 'transparent',
                  }}
                  className={`h-7 px-2.5 rounded-md font-studio-mono text-[10px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
                    active
                      ? 'bg-[#1D2231] text-white shadow'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsDeckExpanded((v) => !v)}
            className="h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 font-studio-mono text-[10px] font-bold text-gray-300 hover:text-white cursor-pointer shrink-0"
          >
            {isDeckExpanded ? '⤡ COLLAPSE DECK' : '⤢ EXPAND / FOCUS (78%)'}
          </button>
        </div>

        {/* Active Deck Tab Content */}
        <div className="flex-1 min-h-0 p-2.5 overflow-hidden">
          {activeTab === 'synth' && (
            <SynthEngineTab
              project={project}
              track={focusedTrack}
              engine={engine}
              pLockLatch={pLockLatch}
              selectedStep={selectedStep}
              onUpdateTrackSynth={(
                trackIndex: number,
                updater: (prev: ProSynthConfig) => ProSynthConfig,
                presetNameOverride?: string
              ) =>
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t, i) =>
                    i === trackIndex
                      ? {
                          ...t,
                          presetName: presetNameOverride ?? t.presetName,
                          synth: updater(t.synth),
                        }
                      : t
                  ),
                }))
              }
              onWriteStepPLock={handleWriteStepPLock}
              onAuditionHit={(trackIndex) => {
                const trk = project.tracks[trackIndex];
                const midi = trk?.isDrum ? 36 : 60 + project.rootNote;
                handleTriggerLiveAndRecord(trackIndex, [midi], 0.9);
              }}
            />
          )}

          {activeTab === 'mixer' && (
            <MixerFxTab
              project={project}
              focusedTrackIndex={focusedTrackIndex}
              engine={engine}
              onSelectTrack={setFocusedTrackIndex}
              onUpdateTrackMixer={(trackIndex, updater) =>
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t, i) =>
                    i === trackIndex ? { ...t, mixer: updater(t.mixer) } : t
                  ),
                }))
              }
              onToggleInsertFx={(trackIndex, fxType: InsertFxType) =>
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t, i) =>
                    i === trackIndex
                      ? {
                          ...t,
                          insertFx: t.insertFx.map((u) =>
                            u.type === fxType
                              ? { ...u, enabled: !u.enabled }
                              : u
                          ),
                        }
                      : t
                  ),
                }))
              }
              onUpdateGlobalFx={(updater) =>
                setProject((prev) => ({
                  ...prev,
                  globalFx: updater(prev.globalFx),
                }))
              }
            />
          )}

          {activeTab === 'pads' && (
            <PadsArpTab
              project={project}
              focusedTrack={focusedTrack}
              engine={engine}
              onTriggerPadNotes={handleTriggerLiveAndRecord}
              onUpdateTrackConfig={(
                trackIndex: number,
                updater: (prev: TrackConfig) => TrackConfig
              ) =>
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t, i) =>
                    i === trackIndex ? updater(t) : t
                  ),
                }))
              }
            />
          )}

          {activeTab === 'kaoss' && (
            <KaossPadTab
              project={project}
              focusedTrackIndex={focusedTrackIndex}
              engine={engine}
              onTriggerKaossNote={(trkIdx, midi, vel) =>
                handleTriggerLiveAndRecord(trkIdx, [midi], vel)
              }
            />
          )}

          {activeTab === 'performance' && (
            <PerformanceTab
              project={project}
              engine={engine}
              onLaunchTrackClip={(trackIndex, patternId) =>
                setProject((prev) => {
                  const nextPerf = { ...prev.performance };
                  if (
                    !isPlaying ||
                    nextPerf.launchQuantize === 'immediate'
                  ) {
                    const activeTrackPatterns = [
                      ...nextPerf.activeTrackPatterns,
                    ];
                    activeTrackPatterns[trackIndex] = patternId;
                    return {
                      ...prev,
                      performance: { ...nextPerf, activeTrackPatterns },
                    };
                  }
                  const queuedTrackPatterns = [...nextPerf.queuedTrackPatterns];
                  queuedTrackPatterns[trackIndex] = patternId;
                  return {
                    ...prev,
                    performance: { ...nextPerf, queuedTrackPatterns },
                  };
                })
              }
              onLaunchMasterScene={(patternId) =>
                setProject((prev) => ({
                  ...prev,
                  activePatternId: patternId,
                  performance: {
                    ...prev.performance,
                    activeTrackPatterns: Array(8).fill(patternId),
                    queuedTrackPatterns: Array(8).fill(null),
                  },
                }))
              }
              onUpdatePerformance={(updater) =>
                setProject((prev) => ({
                  ...prev,
                  performance: updater(prev.performance),
                }))
              }
              onCaptureCombinationToSong={() =>
                commitProjectChange((prev) => ({
                  ...prev,
                  songTimeline: [
                    ...prev.songTimeline,
                    {
                      id: `blk_${Date.now()}`,
                      patternId: prev.activePatternId,
                      repeats: 2,
                      mutedTracks: prev.tracks
                        .filter((t) => t.mixer.mute)
                        .map((t) => t.index),
                    },
                  ],
                }))
              }
            />
          )}

          {activeTab === 'pianoroll' && (
            <PianoRollSongTab
              project={project}
              focusedTrack={focusedTrack}
              visibleBar={visibleBar}
              currentGlobalStep={currentGlobalStep}
              isPlaying={isPlaying}
              onUpdateStepData={handleUpdateStepData}
              onAnswerMeCoPlay={(trackIndex) =>
                commitProjectChange((prev) => {
                  const pat = prev.patterns[prev.activePatternId];
                  const updatedPat = applyAnswerMeCoPlay(
                    pat,
                    trackIndex,
                    prev.rootNote,
                    prev.scaleName
                  );
                  return {
                    ...prev,
                    patterns: {
                      ...prev.patterns,
                      [prev.activePatternId]: updatedPat,
                    },
                  };
                })
              }
              onApplyVelocityTool={(tool) =>
                commitProjectChange((prev) => {
                  const pat = prev.patterns[prev.activePatternId];
                  const nextTracks = pat.tracks.map((seq) => {
                    if (seq.trackIndex !== focusedTrackIndex) return seq;
                    const nextSteps = seq.steps.map((s, idx) => {
                      const inStep = idx % 16;
                      let v = s.velocity;
                      if (tool === 'accent') v = inStep % 4 === 0 ? 0.98 : 0.62;
                      else if (tool === 'up') v = 0.25 + (inStep / 15) * 0.72;
                      else if (tool === 'down') v = 0.95 - (inStep / 15) * 0.7;
                      else if (tool === 'alternate')
                        v = inStep % 2 === 0 ? 0.9 : 0.55;
                      else if (tool === 'humanize')
                        v = Math.min(
                          1,
                          Math.max(0.2, s.velocity + (Math.random() * 0.3 - 0.15))
                        );
                      return {
                        ...s,
                        velocity: v,
                        notes: s.notes.map((n) => ({ ...n, velocity: v })),
                      };
                    });
                    return { ...seq, steps: nextSteps };
                  });
                  return {
                    ...prev,
                    patterns: {
                      ...prev.patterns,
                      [prev.activePatternId]: { ...pat, tracks: nextTracks },
                    },
                  };
                })
              }
              onSelectPatternFromSong={(patternId) =>
                setProject((prev) => ({
                  ...prev,
                  activePatternId: patternId,
                  performance: {
                    ...prev.performance,
                    activeTrackPatterns: Array(8).fill(patternId),
                  },
                }))
              }
              onExportMasterWav={() => engine.exportRenderedPatternWav()}
              onExportStemsWav={() => engine.exportAll8StemsWav()}
              onExportMidi={() => downloadMidiFile(project)}
            />
          )}
        </div>
      </div>

      {/* Interactive 3-Step First-Launch Coach Marks Walkthrough */}
      {coachStep !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setCoachStep(null)}
        >
          <div
            className="max-w-md w-full rounded-xl border border-rose-500/40 bg-[#151821] p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between font-studio-mono text-xs text-rose-400 font-bold">
              <span>QUICK STUDIO TOUR // STEP {coachStep} OF 3</span>
              <button
                type="button"
                onClick={() => setCoachStep(null)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <h3 className="text-sm font-bold text-white">
              {coachStep === 1
                ? '1. Dual-Persona PLAY & STUDIO Modes'
                : coachStep === 2
                  ? '2. Paint Beats, Extendable Ties & P-Locks'
                  : '3. Live Kaoss Pad, Clip Matrix & Stem Exports'}
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed font-studio-mono">
              {coachStep === 1
                ? 'Press ▶ PLAY (or Spacebar) to launch the 48kHz engine. Toggle between 🎮 PLAY (Beginner 6-Macro view) and 🎛️ STUDIO (Full 4-Oscillator Pro Synthesizer) anytime without interrupting audio!'
                : coachStep === 2
                  ? 'Swipe across the 8-track step grid to paint beats, click 🪄 ANSWER ME to auto-compose a 2-bar call-and-response melody, or toggle 🔒 P-LOCK to lock filter sweeps onto individual steps.'
                  : 'Explore the 6 bottom deck tabs (Synth, Mixer, Pads & Arp, Kaoss Pad, 8×8 Performance Clip Matrix, and Piano Roll) or open 📁 PROJECT to load the 6 Starter Projects and export .WAV stems or .MID files.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              {coachStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setCoachStep((s) => (s ?? 1) + 1)}
                  className="px-4 py-1.5 rounded-lg bg-rose-500 text-black font-studio-mono text-xs font-bold cursor-pointer"
                >
                  NEXT STEP →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCoachStep(null)}
                  className="px-4 py-1.5 rounded-lg bg-emerald-400 text-black font-studio-mono text-xs font-bold cursor-pointer"
                >
                  LET&apos;S MAKE MUSIC!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(modalAlert)}
        title={modalAlert?.title ?? ''}
        message={modalAlert?.message ?? ''}
        variant={modalAlert?.variant ?? 'info'}
        alertOnly
        accentColor="#F43F5E"
        onConfirm={() => setModalAlert(null)}
      />
    </div>
  );
};
