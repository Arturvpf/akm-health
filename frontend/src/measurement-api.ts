import { storeThenSync } from './offline-store';
import { FORM_METRICS, type FieldErrors } from './measurement-form';
import type { MeasurementCreate, MeasurementRead } from './types';

export class RegistrationError extends Error {
  constructor(message: string, public uncertain: boolean, public fields: FieldErrors = {}, public missingAstronaut = false, public queued = false) { super(message); }
}
const UNCERTAIN = 'The measurement could not be confirmed. Check Sync status and History for this reading.';
const QUEUED = 'The reading was saved on this device. Use Sync now to send it when the connection is available.';

export function parseMeasurement(value: unknown): MeasurementRead {
  if (!value || typeof value !== 'object') throw new Error('Invalid response.');
  const item = value as MeasurementRead;
  const metric = Object.hasOwn(FORM_METRICS, item.kind) ? FORM_METRICS[item.kind] : null;
  const validDate = (date: unknown) => typeof date === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(date) && Number.isFinite(Date.parse(date));
  if (!metric || item.unit !== metric.unit || item.measurement_zone !== metric.zone
    || !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.value !== 'number' || !Number.isFinite(item.value)
    || (metric.zone === 'habitat' ? item.astronaut_id !== null : typeof item.astronaut_id !== 'string' || !item.astronaut_id.trim())
    || !['manual', 'synthetic'].includes(item.source) || !['ok', 'suspect'].includes(item.quality)
    || !validDate(item.measured_at) || !validDate(item.recorded_at)
    || (item.kind === 'sleep_hours' && (item.value < 0 || item.value > 24))
    || (item.kind === 'heart_rate_bpm' && item.value <= 0)
    || (item.kind === 'co2_ppm' && item.value < 0)
    || (item.kind === 'mood_score' && (!Number.isInteger(item.value) || item.value < 1 || item.value > 5))) throw new Error('Invalid response.');
  return item;
}

/** Maps a confirmed server rejection (nothing was written) to field-level form feedback. */
function rejectionError(status: number, body: unknown): RegistrationError {
  if (status === 404) return new RegistrationError('The selected crew member is unavailable. Refresh the list and select again.', false, { astronaut: 'Select again after refreshing the list.' }, true);
  if (status !== 422) return new RegistrationError(UNCERTAIN, true);
  const fields: FieldErrors = {};
  const names: Record<string, keyof FieldErrors> = { value: 'value', measured_at: 'localTime', astronaut_id: 'astronaut', source: 'source', quality: 'quality', kind: 'kind', unit: 'kind' };
  const messages: Partial<Record<keyof FieldErrors, string>> = { value: 'The server rejected the value. Check the unit and supported range.', localTime: 'The server rejected the timestamp. Check the time and UTC offset.', astronaut: 'Check the selected crew member.', source: 'Check the source.', quality: 'Check the quality.', kind: 'Check the metric and unit.' };
  const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : undefined;
  if (Array.isArray(detail)) for (const error of detail) {
    const loc = error && typeof error === 'object' ? (error as { loc?: unknown }).loc : undefined;
    const field = Array.isArray(loc) ? names[String(loc.at(-1))] : undefined;
    if (field) fields[field] = messages[field];
  }
  return new RegistrationError('Review the highlighted field and try again. Check the metric, crew member, value, time, source, and quality.', false, fields);
}

export async function saveMeasurement(payload: MeasurementCreate, signal: AbortSignal): Promise<MeasurementRead> {
  let response: Response;
  try {
    response = await fetch('/api/measurements', { method: 'POST', signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch { throw new RegistrationError(UNCERTAIN, true); }
  if (response.status === 404 || response.status === 422) {
    let body: unknown = null;
    if (response.status === 422) {
      try { body = await response.json(); } catch { /* A confirmed validation rejection is safe to correct even without its body. */ }
    }
    throw rejectionError(response.status, body);
  }
  // Any unexpected response can follow a committed write; never retry automatically.
  if (response.status !== 201) throw new RegistrationError(UNCERTAIN, true);
  try {
    const saved = parseMeasurement(await response.json());
    if (saved.kind !== payload.kind || saved.unit !== payload.unit || saved.value !== payload.value
      || saved.astronaut_id !== (payload.astronaut_id ?? null) || saved.source !== payload.source
      || saved.quality !== (payload.quality ?? 'ok') || Date.parse(saved.measured_at) !== Date.parse(payload.measured_at)) throw new Error('The saved record does not match the submission.');
    return saved;
  } catch { throw new RegistrationError(UNCERTAIN, true); }
}


export async function durableSaveMeasurement(payload: MeasurementCreate, signal: AbortSignal, onStored?: () => void): Promise<MeasurementRead> {
  let saved;
  try {
    saved = await storeThenSync(payload, signal, onStored);
  } catch (error) {
    throw new RegistrationError(`Could not confirm local storage: ${error instanceof Error ? error.message : 'unknown error'}. The measurement was NOT sent.`, false);
  }
  if (saved.rejection?.status === 409) {
    throw new RegistrationError('The server reported a sync conflict. Review the reading in the sync bar.', false, {}, false, true);
  }
  if (saved.rejection) throw rejectionError(saved.rejection.status, saved.rejection.body);
  if (!saved.receipt) throw new RegistrationError(QUEUED, false, {}, false, true);
  const result = parseMeasurement(saved.receipt);
  if (result.kind !== payload.kind || result.unit !== payload.unit || result.value !== payload.value
    || result.astronaut_id !== (payload.astronaut_id ?? null) || result.source !== payload.source
    || result.quality !== (payload.quality ?? 'ok') || Date.parse(result.measured_at) !== Date.parse(payload.measured_at)) {
    // The browser outbox has already received a matching transport receipt; this is a contract error.
    throw new RegistrationError('Incompatible server receipt; check History.', true);
  }
  return result;
}

export interface RegistrationState {
  phase: 'idle' | 'saving' | 'saved' | 'error' | 'uncertain' | 'queued';
  receipt: MeasurementRead | null; error: string | null; fields: FieldErrors; missingAstronaut: boolean;
}
export const INITIAL_REGISTRATION: RegistrationState = { phase: 'idle', receipt: null, error: null, fields: {}, missingAstronaut: false };

/** Single flight, no retries, bounded waiting, and no late updates after timeout/unmount. */
export function createRegistrationController(save = durableSaveMeasurement, timeoutMs = 10_000) {
  let state = INITIAL_REGISTRATION;
  let disposed = false;
  let sequence = 0;
  let active: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(state: RegistrationState) => void>();
  function publish(next: RegistrationState) { state = next; for (const listener of listeners) listener(state); }
  return {
    getState: () => state,
    subscribe(listener: (state: RegistrationState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset() { if (!disposed && state.phase !== 'saving') publish(INITIAL_REGISTRATION); },
    async submit(payload: MeasurementCreate, onStored?: () => void) {
      if (disposed || state.phase === 'saving' || state.phase === 'saved' || state.phase === 'uncertain' || state.phase === 'queued') return;
      const current = ++sequence;
      const controller = new AbortController(); active = controller;
      let storedLocally = false;
      publish({ ...INITIAL_REGISTRATION, phase: 'saving' });
      try {
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(storedLocally
              ? new RegistrationError(QUEUED, false, {}, false, true)
              : new RegistrationError(UNCERTAIN, true));
            controller.abort();
          }, timeoutMs);
        });
        const receipt = await Promise.race([save(payload, controller.signal, () => {
          storedLocally = true;
          onStored?.();
        }), deadline]);
        if (!disposed && current === sequence) publish({ ...INITIAL_REGISTRATION, phase: 'saved', receipt });
      } catch (error) {
        if (disposed || current !== sequence) return;
        const failure = error instanceof RegistrationError ? error : new RegistrationError(UNCERTAIN, true);
        publish({ ...INITIAL_REGISTRATION, phase: failure.queued ? 'queued' : failure.uncertain ? 'uncertain' : 'error', error: failure.message, fields: failure.fields, missingAstronaut: failure.missingAstronaut });
      } finally { clearTimeout(timer); active = null; }
    },
    dispose() { disposed = true; ++sequence; active?.abort(); clearTimeout(timer); listeners.clear(); },
  };
}
