/** AKM-33: durable local outbox and last-confirmed read snapshots (no medical data allowed). */
import type { MeasurementCreate, MeasurementRead } from './types';

const DATABASE = 'akm-health-demo-offline';
const VERSION = 1;
const STORE_OUTBOX = 'outbox';
const STORE_CACHE = 'cache';
export type OutboxStatus = 'pending' | 'conflict';
export type OutboxEntry = {
  id: string;
  payload: MeasurementCreate;
  createdAt: string;
  attempts: number;
  status: OutboxStatus;
  error: string | null;
};

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('IndexedDB indisponível')); return; }
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
    };
    request.onerror = () => reject(request.error ?? new Error('Falha de armazenamento local'));
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => reject(new Error('Feche outras abas com uma versão antiga do aplicativo'));
  });
}

async function operation<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let value: T;
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Erro na persistência local')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Transação local abortada')); };
  });
}

function notify() { window.dispatchEvent(new Event('akm-outbox-change')); }

export async function enqueueMeasurement(payload: MeasurementCreate): Promise<OutboxEntry> {
  if (!globalThis.crypto?.randomUUID) throw new Error('Este navegador não suporta identificadores seguros para sincronização.');
  const entry: OutboxEntry = {
    id: crypto.randomUUID(), payload, createdAt: new Date().toISOString(), attempts: 0, status: 'pending', error: null,
  };
  // The write TRANSACTION must commit before any network request is attempted.
  await operation(STORE_OUTBOX, 'readwrite', store => store.add(entry));
  notify();
  return entry;
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  const entries = await operation<OutboxEntry[]>(STORE_OUTBOX, 'readonly', store => store.getAll());
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function updateOutbox(entry: OutboxEntry) {
  await operation(STORE_OUTBOX, 'readwrite', store => store.put(entry));
  notify();
}
export async function removeOutbox(id: string) {
  await operation(STORE_OUTBOX, 'readwrite', store => store.delete(id));
  notify();
}
export async function snapshot<T>(key: string): Promise<T | null> {
  const entry = await operation<{ key: string; value: T; savedAt: string } | undefined>(
    STORE_CACHE, 'readonly', store => store.get(key),
  );
  return entry?.value ?? null;
}
export async function rememberSnapshot<T>(key: string, value: T): Promise<void> {
  await operation(STORE_CACHE, 'readwrite', store => store.put({ key, value, savedAt: new Date().toISOString() }));
}

/** Cached responses are explicitly marked stale in the global offline status. */
export async function cachedRead<T>(key: string, remote: () => Promise<T>): Promise<T> {
  try {
    const data = await remote();
    await rememberSnapshot(key, data).catch(() => undefined);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('akm-server-reachable'));
    return data;
  } catch (error) {
    const cached = await snapshot<T>(key).catch(() => null);
    if (cached !== null) {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('akm-cached-response'));
      return cached;
    }
    throw error;
  }
}

export type SyncReport = { confirmed: Record<string, MeasurementRead>; pending: number; conflicts: number };
let activeSync: Promise<SyncReport> | null = null;

async function deliver(signal?: AbortSignal): Promise<SyncReport> {
  const confirmed: Record<string, MeasurementRead> = {};
  for (const entry of await listOutbox()) {
    if (signal?.aborted) break;
    if (entry.status === 'conflict') continue;
    let response: Response;
    try {
      response = await fetch('/api/sync/measurements', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ operation_id: entry.id, measurement: entry.payload }), signal,
      });
    } catch { break; } // Indeterminate response: keep same ID for a safe replay.
    if (response.status === 200 || response.status === 201) {
      try {
        const body = await response.json() as { operation_id: string; measurement: MeasurementRead };
        if (body.operation_id !== entry.id || !body.measurement || !Number.isSafeInteger(body.measurement.id)
          || body.measurement.id <= 0 || body.measurement.kind !== entry.payload.kind
          || body.measurement.value !== entry.payload.value
          || body.measurement.astronaut_id !== (entry.payload.astronaut_id ?? null)
          || body.measurement.unit !== entry.payload.unit
          || body.measurement.source !== entry.payload.source
          || body.measurement.quality !== (entry.payload.quality ?? 'ok')
          || body.measurement.measurement_zone !== (entry.payload.astronaut_id == null ? 'habitat' : 'astronaut')
          || !Number.isFinite(Date.parse(body.measurement.measured_at))
          || Date.parse(body.measurement.measured_at) !== Date.parse(entry.payload.measured_at)
          || !Number.isFinite(Date.parse(body.measurement.recorded_at))) throw new Error('Recibo incompatível');
        confirmed[entry.id] = body.measurement;
        await removeOutbox(entry.id);
      } catch { break; } // Unreadable receipt: operation stays queued, never duplicate.
    } else if ([404, 409, 422].includes(response.status)) {
      await updateOutbox({ ...entry, status: 'conflict', attempts: entry.attempts + 1,
        error: `Servidor rejeitou a operação (HTTP ${response.status}); revise antes de descartar.` });
    } else { break; } // 5xx or network: retry later with stable operation ID.
  }
  const items = await listOutbox();
  return { confirmed, pending: items.filter(item => item.status === 'pending').length,
    conflicts: items.filter(item => item.status === 'conflict').length };
}

/** Coalesce simultaneous UI/background sync attempts. */
export function synchronizeOutbox(signal?: AbortSignal): Promise<SyncReport> {
  if (activeSync) return activeSync;
  const current = deliver(signal);
  activeSync = current;
  void current.then(() => { if (activeSync === current) activeSync = null; }, () => { if (activeSync === current) activeSync = null; });
  return current;
}

export async function storeThenSync(payload: MeasurementCreate, signal?: AbortSignal): Promise<{ receipt: MeasurementRead | null; operationId: string }> {
  const item = await enqueueMeasurement(payload);
  const report = await synchronizeOutbox(signal);
  // If another sync was in progress before this item was queued, give it another turn.
  const receipt = report.confirmed[item.id] ?? (await synchronizeOutbox(signal)).confirmed[item.id] ?? null;
  return { receipt, operationId: item.id };
}
