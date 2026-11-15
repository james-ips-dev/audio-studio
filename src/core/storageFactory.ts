import type {
  InstrumentStorage,
  PatchExportEnvelope,
  StoredPatchRecord,
} from './types';

const DB_VERSION = 1;
const STORE_PATCHES = 'patches';
const STORE_AUTOSAVE = 'autosave';

/**
 * Custom error thrown when a user attempts to import a `.json` patch file that
 * belongs to a different instrument (Section 9 of STUDIO_SUITE_ARCHITECTURE.md).
 */
export class IncompatiblePatchError extends Error {
  public readonly expectedInstrumentId: string;
  public readonly actualInstrumentId: string;

  constructor(expectedInstrumentId: string, actualInstrumentId: string) {
    const expectedUpper = expectedInstrumentId.toUpperCase();
    const actualUpper = actualInstrumentId.toUpperCase();
    super(
      `Incompatible file: This patch belongs to ${actualUpper}, not ${expectedUpper}.`
    );
    this.name = 'IncompatiblePatchError';
    this.expectedInstrumentId = expectedInstrumentId;
    this.actualInstrumentId = actualInstrumentId;
  }
}

/**
 * Opens the strictly isolated IndexedDB instance for `${storageNamespace}_db`.
 */
function openIsolatedDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PATCHES)) {
        db.createObjectStore(STORE_PATCHES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUTOSAVE)) {
        db.createObjectStore(STORE_AUTOSAVE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to open IndexedDB: ${dbName}`));
  });
}

/**
 * Creates a strictly namespaced IndexedDB & JSON Patch I/O manager for a single instrument.
 *
 * - Database Name: `${storageNamespace}_db` (e.g., `suite_groovebox_db` vs `suite_aether8_db`)
 * - Object Stores: `patches` (keyed by `id`) and `autosave` (key `'last_session'`)
 * - JSON Tagging: Enforces `{ instrumentId, schemaVersion, data }` header on export/import.
 */
export function createInstrumentStorage<TPayload = unknown>(
  storageNamespace: string,
  instrumentId: string,
  schemaVersion: string = 'v4.0'
): InstrumentStorage<TPayload> {
  const normalizedNamespace = storageNamespace.endsWith('_db')
    ? storageNamespace.slice(0, -3)
    : storageNamespace;
  const dbName = `${normalizedNamespace}_db`;

  // In-memory fallback map in case private browsing restricts IndexedDB writes
  const memoryPatches = new Map<string, StoredPatchRecord<TPayload>>();
  const memoryAutosave = new Map<string, unknown>();

  async function withStore<TResult>(
    storeName: string,
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<TResult>
  ): Promise<TResult> {
    const db = await openIsolatedDatabase(dbName);
    return new Promise<TResult>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = op(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error(`IndexedDB operation failed on ${dbName}`));
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  }

  return {
    dbName,
    instrumentId,
    schemaVersion,

    async savePatch(
      id: string,
      name: string,
      payload: TPayload
    ): Promise<StoredPatchRecord<TPayload>> {
      const record: StoredPatchRecord<TPayload> = {
        id,
        name: name.trim() || 'Untitled Patch',
        updatedAt: Date.now(),
        payload,
      };
      memoryPatches.set(id, record);
      try {
        await withStore(STORE_PATCHES, 'readwrite', (store) => store.put(record));
      } catch {
        // Fallback already stored in memoryPatches
      }
      return record;
    },

    async getPatch(id: string): Promise<StoredPatchRecord<TPayload> | null> {
      try {
        const result = await withStore<StoredPatchRecord<TPayload> | undefined>(
          STORE_PATCHES,
          'readonly',
          (store) => store.get(id)
        );
        return result ?? memoryPatches.get(id) ?? null;
      } catch {
        return memoryPatches.get(id) ?? null;
      }
    },

    async listPatches(): Promise<StoredPatchRecord<TPayload>[]> {
      try {
        const records = await withStore<StoredPatchRecord<TPayload>[]>(
          STORE_PATCHES,
          'readonly',
          (store) => store.getAll()
        );
        return (records ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
      } catch {
        return Array.from(memoryPatches.values()).sort(
          (a, b) => b.updatedAt - a.updatedAt
        );
      }
    },

    async deletePatch(id: string): Promise<void> {
      memoryPatches.delete(id);
      try {
        await withStore(STORE_PATCHES, 'readwrite', (store) => store.delete(id));
      } catch {
        // Ignore if IndexedDB unavailable
      }
    },

    async saveAutosave<TAuto = TPayload>(
      payload: TAuto,
      key: string = 'last_session'
    ): Promise<void> {
      memoryAutosave.set(key, payload);
      try {
        await withStore(STORE_AUTOSAVE, 'readwrite', (store) =>
          store.put(payload, key)
        );
      } catch {
        // Fallback kept in memoryAutosave
      }
    },

    async loadAutosave<TAuto = TPayload>(
      key: string = 'last_session'
    ): Promise<TAuto | null> {
      try {
        const result = await withStore<TAuto | undefined>(
          STORE_AUTOSAVE,
          'readonly',
          (store) => store.get(key)
        );
        if (result !== undefined) return result;
      } catch {
        // Fall through to memoryAutosave
      }
      return (memoryAutosave.get(key) as TAuto | undefined) ?? null;
    },

    async clearAutosave(key: string = 'last_session'): Promise<void> {
      memoryAutosave.delete(key);
      try {
        await withStore(STORE_AUTOSAVE, 'readwrite', (store) =>
          store.delete(key)
        );
      } catch {
        // Ignore
      }
    },

    exportPatchToJsonString(payload: TPayload, patchName?: string): string {
      const envelope: PatchExportEnvelope<TPayload> = {
        instrumentId,
        schemaVersion,
        exportedAt: new Date().toISOString(),
        ...(patchName ? { name: patchName } : {}),
        data: payload,
      };
      return JSON.stringify(envelope, null, 2);
    },

    exportPatchToJsonFile(
      filename: string,
      payload: TPayload,
      patchName?: string
    ): void {
      const jsonStr = this.exportPatchToJsonString(payload, patchName);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const safeName = filename.endsWith('.json')
        ? filename
        : `${filename}.json`;

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    importPatchFromJsonString(jsonText: string): PatchExportEnvelope<TPayload> {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error('Invalid JSON file: Could not parse patch file.');
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid patch file: Root JSON value must be an object.');
      }

      const candidate = parsed as Record<string, unknown>;
      const fileInstrumentId =
        typeof candidate.instrumentId === 'string'
          ? candidate.instrumentId.trim()
          : '';

      if (!fileInstrumentId) {
        throw new Error(
          'Invalid patch file: Missing required "instrumentId" header.'
        );
      }

      if (fileInstrumentId.toLowerCase() !== instrumentId.toLowerCase()) {
        throw new IncompatiblePatchError(instrumentId, fileInstrumentId);
      }

      if (!('data' in candidate) || candidate.data === undefined) {
        throw new Error('Invalid patch file: Missing required "data" payload.');
      }

      return {
        instrumentId: fileInstrumentId,
        schemaVersion:
          typeof candidate.schemaVersion === 'string'
            ? candidate.schemaVersion
            : schemaVersion,
        exportedAt:
          typeof candidate.exportedAt === 'string'
            ? candidate.exportedAt
            : new Date().toISOString(),
        name: typeof candidate.name === 'string' ? candidate.name : undefined,
        data: candidate.data as TPayload,
      };
    },

    async importPatchFromFile(file: File): Promise<PatchExportEnvelope<TPayload>> {
      const text = await file.text();
      return this.importPatchFromJsonString(text);
    },
  };
}
