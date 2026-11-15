import { IncompatiblePatchError } from '../../../core/storageFactory';
import {
  cloneRileySongPatch,
  detectLowSpecDevice,
  RILEY_FACTORY_SONG_PRESETS,
} from '../constants/songPresets';
import type { RileySongPatch } from '../types';

const DB_NAME = 'RileyRack800_DB';
const DB_VERSION = 1;
const STORE_USER_PATCHES = 'user_patches';
export const RILEY_AUTOSAVE_KEY = 'rileyrack800_autosave_v1';
export const RILEY_INSTRUMENT_ID = 'riley-rack';
export const RILEY_SCHEMA_VERSION = 'v1.0';

// Fallback in-memory map if private browsing blocks IndexedDB
const memoryUserPatches = new Map<string, RileySongPatch>();

function openRileyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_USER_PATCHES)) {
        db.createObjectStore(STORE_USER_PATCHES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to open ${DB_NAME}`));
  });
}

/**
 * Validates and normalizes an imported or loaded RileySongPatch against missing fields.
 */
export function normalizeRileySongPatch(raw: Partial<RileySongPatch>): RileySongPatch {
  const fallback = cloneRileySongPatch(RILEY_FACTORY_SONG_PRESETS[0]);
  return {
    ...fallback,
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : fallback.id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : fallback.name,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    isFactory: Boolean(raw.isFactory),
    bpm: typeof raw.bpm === 'number' ? Math.max(60, Math.min(180, raw.bpm)) : fallback.bpm,
    scaleId: raw.scaleId ?? fallback.scaleId,
    rootMidi: typeof raw.rootMidi === 'number' ? raw.rootMidi : fallback.rootMidi,
    justIntonation:
      typeof raw.justIntonation === 'boolean'
        ? raw.justIntonation
        : fallback.justIntonation,
    ecoMode:
      typeof raw.ecoMode === 'boolean' ? raw.ecoMode : detectLowSpecDevice(),
    masterVol: typeof raw.masterVol === 'number' ? raw.masterVol : 0.85,
    delay: {
      ...fallback.delay,
      ...(raw.delay ?? {}),
      feedback: Math.min(0.64, Math.max(0, raw.delay?.feedback ?? fallback.delay.feedback)),
      crossFeed: Math.min(0.14, Math.max(0, raw.delay?.crossFeed ?? fallback.delay.crossFeed)),
    },
    biosphere: {
      ...fallback.biosphere,
      ...(raw.biosphere ?? {}),
    },
    evolve: {
      ...fallback.evolve,
      ...(raw.evolve ?? {}),
    },
    cables: Array.isArray(raw.cables) ? raw.cables : fallback.cables,
    voices:
      Array.isArray(raw.voices) && raw.voices.length === 8
        ? raw.voices
        : fallback.voices,
  };
}

/**
 * Section 7.1: Dedicated IndexedDB Persistence (`RileyRack800_DB`, store `user_patches`)
 */
export async function listUserPatches(): Promise<RileySongPatch[]> {
  try {
    const db = await openRileyDB();
    return await new Promise<RileySongPatch[]>((resolve, reject) => {
      const tx = db.transaction(STORE_USER_PATCHES, 'readonly');
      const store = tx.objectStore(STORE_USER_PATCHES);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as RileySongPatch[] | undefined) ?? [];
        resolve(
          items
            .map((p) => normalizeRileySongPatch(p))
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  } catch {
    return Array.from(memoryUserPatches.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }
}

export async function saveUserPatch(patch: RileySongPatch): Promise<RileySongPatch> {
  const userPatch: RileySongPatch = {
    ...cloneRileySongPatch(patch),
    id: patch.isFactory || !patch.id.startsWith('user-')
      ? `user-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
      : patch.id,
    isFactory: false,
    createdAt: Date.now(),
  };

  memoryUserPatches.set(userPatch.id, userPatch);

  try {
    const db = await openRileyDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_USER_PATCHES, 'readwrite');
      const store = tx.objectStore(STORE_USER_PATCHES);
      const req = store.put(userPatch);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  } catch {
    // Kept in memoryUserPatches
  }

  return userPatch;
}

export async function deleteUserPatch(id: string): Promise<void> {
  // Factory song patches are read-only and protected from deletion
  if (!id.startsWith('user-')) return;

  memoryUserPatches.delete(id);

  try {
    const db = await openRileyDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_USER_PATCHES, 'readwrite');
      const store = tx.objectStore(STORE_USER_PATCHES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  } catch {
    // Ignore if unavailable
  }
}

/**
 * Section 7.1.4: Export / Import `.rileyrack.json` with strict instrumentId header
 */
export function exportRileyPatchToJsonFile(patch: RileySongPatch): void {
  const envelope = {
    instrumentId: RILEY_INSTRUMENT_ID,
    schemaVersion: RILEY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    name: patch.name,
    data: patch,
  };
  const jsonText = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeSlug = (patch.name || 'riley-patch')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename = `${safeSlug || 'patch'}.rileyrack.json`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importRileyPatchFromJsonFile(
  file: File
): Promise<RileySongPatch> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file: Could not parse .rileyrack.json patch.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid patch file: Root JSON value must be an object.');
  }

  const obj = parsed as Record<string, unknown>;

  // Check if wrapped in Studio Suite PatchExportEnvelope
  if (typeof obj.instrumentId === 'string') {
    const fileInstId = obj.instrumentId.trim().toLowerCase();
    if (
      fileInstId !== RILEY_INSTRUMENT_ID &&
      fileInstId !== 'rileyrack' &&
      fileInstId !== 'rileyrack800'
    ) {
      throw new IncompatiblePatchError(RILEY_INSTRUMENT_ID, obj.instrumentId);
    }
    if (obj.data && typeof obj.data === 'object') {
      return normalizeRileySongPatch(obj.data as Partial<RileySongPatch>);
    }
  }

  // Also support raw RileySongPatch JSON objects directly
  if (Array.isArray(obj.voices) && typeof obj.bpm === 'number') {
    return normalizeRileySongPatch(obj as Partial<RileySongPatch>);
  }

  throw new Error(
    'Incompatible or corrupted patch file: Missing RileyRack 800 voices payload.'
  );
}

/**
 * Section 7.1.5: Auto-Save Working Session (`localStorage` key `'rileyrack800_autosave_v1'`)
 */
export function saveRileyAutosaveSnapshot(patch: RileySongPatch): void {
  try {
    localStorage.setItem(RILEY_AUTOSAVE_KEY, JSON.stringify(patch));
  } catch {
    // Ignore quota errors
  }
}

export function loadRileyAutosaveSnapshot(): RileySongPatch | null {
  try {
    const raw = localStorage.getItem(RILEY_AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RileySongPatch>;
    if (parsed && Array.isArray(parsed.voices) && parsed.voices.length === 8) {
      return normalizeRileySongPatch(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}
