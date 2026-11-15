import type React from 'react';

/**
 * Visual badge metadata displayed in the 36px Host Shell top switcher bar.
 */
export interface InstrumentThemeBadge {
  accentHex: string; // e.g., '#F43F5E' for Groovebox, '#38BDF8' for AETHER-8
  tagline: string;   // Short subtitle shown on switcher tooltip/card
}

/**
 * Deterministic lifecycle handle registered by the currently mounted instrument.
 * Used by the Host Shell to execute the 5-step atomic teardown sequence before
 * switching to another instrument.
 */
export interface InstrumentHandle {
  /**
   * Immediately halts all transport clocks, setInterval/setTimeout schedulers,
   * requestAnimationFrame loops, removes global window listeners, ramps master
   * gain to 0 over 20ms, and closes the instrument's AudioContext.
   */
  suspendAndCleanup: () => Promise<void> | void;

  /**
   * Returns true if the instrument's AudioContext is currently powered on and running.
   */
  isAudioActive: () => boolean;
}

/**
 * Props injected into every registered instrument's root component by StudioShell.
 */
export interface InstrumentComponentProps {
  /**
   * Callback ref registered by the instrument so the Host Shell can deterministically
   * trigger teardown/cleanup when switching instruments or closing the tab.
   */
  registerHandle: (handle: InstrumentHandle) => void;

  /**
   * Pre-configured, strictly isolated IndexedDB storage namespace scoped to `manifest.id`
   * (e.g., 'suite_groovebox' -> 'suite_groovebox_db').
   */
  storageNamespace: string;
}

/**
 * Complete plugin manifest registering an independent instrument in `INSTRUMENT_REGISTRY`.
 */
export interface InstrumentDefinition {
  id: string;        // Unique URL-safe slug (e.g., 'groovebox', 'aether8')
  name: string;      // Display name in top switcher bar (e.g., 'GROOVEBOX', 'AETHER-8')
  version: string;   // Semantic version string (e.g., 'v4.0')
  badge: InstrumentThemeBadge;
  component: React.ComponentType<InstrumentComponentProps>;
}

/**
 * Record stored inside the `patches` object store of an instrument's IndexedDB database.
 */
export interface StoredPatchRecord<TPayload = unknown> {
  id: string;
  name: string;
  updatedAt: number;
  payload: TPayload;
}

/**
 * Portable `.json` patch file envelope with strict instrumentId and schemaVersion tagging.
 */
export interface PatchExportEnvelope<TPayload = unknown> {
  instrumentId: string;
  schemaVersion: string;
  exportedAt: string;
  name?: string;
  data: TPayload;
}

/**
 * Isolated storage API created by `createInstrumentStorage(storageNamespace, instrumentId, schemaVersion)`.
 */
export interface InstrumentStorage<TPayload = unknown> {
  readonly dbName: string;
  readonly instrumentId: string;
  readonly schemaVersion: string;

  savePatch: (id: string, name: string, payload: TPayload) => Promise<StoredPatchRecord<TPayload>>;
  getPatch: (id: string) => Promise<StoredPatchRecord<TPayload> | null>;
  listPatches: () => Promise<StoredPatchRecord<TPayload>[]>;
  deletePatch: (id: string) => Promise<void>;

  saveAutosave: <TAuto = TPayload>(payload: TAuto, key?: string) => Promise<void>;
  loadAutosave: <TAuto = TPayload>(key?: string) => Promise<TAuto | null>;
  clearAutosave: (key?: string) => Promise<void>;

  exportPatchToJsonString: (payload: TPayload, patchName?: string) => string;
  exportPatchToJsonFile: (filename: string, payload: TPayload, patchName?: string) => void;
  importPatchFromJsonString: (jsonText: string) => PatchExportEnvelope<TPayload>;
  importPatchFromFile: (file: File) => Promise<PatchExportEnvelope<TPayload>>;
}
