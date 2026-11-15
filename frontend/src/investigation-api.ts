import { cachedRead } from './offline-store';
import type {
  AstronautRead, FollowupCompleteRequest, FollowupRead, InvestigationRequest,
  InvestigationResult, MeasurementRead,
} from './types';

export class InvestigationApiError extends Error {
  constructor(readonly status: number, readonly detail: string | undefined) {
    super(`HTTP ${status}`);
  }
}

async function getResponse(path: string, options?: RequestInit) {
  const response = await fetch(`/api${path}`, { ...options, cache: 'no-store' });
  if (!response.ok) {
    const body: { detail?: unknown } | null = await response.json().catch(() => null);
    throw new InvestigationApiError(response.status, typeof body?.detail === 'string' ? body.detail : undefined);
  }
  return response;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (options?.method && options.method !== 'GET') {
    const response = await getResponse(path, options);
    return response.json();
  }
  return cachedRead(`investigation:${path}`, async () => {
    const response = await getResponse(path, options);
    return response.json() as Promise<T>;
  });
}

function jsonRequest(method: 'POST' | 'PATCH', body: InvestigationRequest | FollowupCompleteRequest): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function readAstronauts(signal?: AbortSignal) {
  return request<AstronautRead[]>('/astronauts', { signal });
}

export function runInvestigation(body: InvestigationRequest) {
  return request<InvestigationResult>('/investigations/run', jsonRequest('POST', body));
}

export function readInvestigation(id: number, signal?: AbortSignal) {
  return request<InvestigationResult>(`/investigations/${id}`, { signal });
}

export async function readAgenda(signal?: AbortSignal) {
  const [pending, completed] = await Promise.all([
    request<FollowupRead[]>('/followups?status=pending', { signal }),
    request<FollowupRead[]>('/followups?status=completed', { signal }),
  ]);
  const completedIds = new Set(completed.map(({ id }) => id));
  return { pending: pending.filter(({ id }) => !completedIds.has(id)), completed };
}

export function completeFollowup(id: number, measurementId: number) {
  return request<FollowupRead>(`/followups/${id}`, jsonRequest('PATCH', {
    status: 'completed', measurement_id: measurementId,
  }));
}

// Canonical API timestamps are UTC and can have microsecond precision.
function timestampOrder(value: string) {
  const [whole, fraction = ''] = value.replace(/Z$/, '').split('.');
  return `${whole}.${fraction.padEnd(6, '0')}`;
}

export async function readCompatibleMeasurements(check: FollowupRead, signal: AbortSignal) {
  const limit = 1000;
  const filters = new URLSearchParams({ kind: check.kind, limit: String(limit) });
  if (check.astronaut_id !== null) filters.set('astronaut_id', check.astronaut_id);
  const zone = check.astronaut_id === null ? 'habitat' : 'astronaut';
  const requestedAt = timestampOrder(check.created_at);
  const matches = new Map<number, MeasurementRead>();
  for (let offset = 0; ; offset += limit) {
    filters.set('offset', String(offset));
    const response = await getResponse(`/measurements?${filters}`, { signal });
    const rows: MeasurementRead[] = await response.json();
    const serverTime = Date.parse(response.headers.get('Date') ?? '');
    // Uvicorn refreshes its whole-second Date header on a timer. Allow one second for
    // a cached header and leave exact validation to the PATCH.
    const futureBoundary = Number.isFinite(serverTime) ? timestampOrder(new Date(serverTime + 2000).toISOString()) : null;
    for (const row of rows) {
      const registeredAt = timestampOrder(row.recorded_at);
      if (row.kind === check.kind && row.astronaut_id === check.astronaut_id && row.measurement_zone === zone
        && row.quality === 'ok' && registeredAt > requestedAt
        && (futureBoundary === null || (registeredAt < futureBoundary && timestampOrder(row.measured_at) < futureBoundary))) {
        matches.set(row.id, row);
      }
    }
    if (rows.length < limit) return Array.from(matches.values()).reverse();
  }
}
