import { cachedRead } from './offline-store';
import type { DashboardResponse, Kind } from './types';

export const METRIC_LABELS: Record<Kind, string> = {
  sleep_hours: 'Sono', heart_rate_bpm: 'Frequência cardíaca', mood_score: 'Bem-estar emocional',
  co2_ppm: 'CO₂ interno', cabin_temp_c: 'Temperatura interna',
};
const UNITS: Record<Kind, string> = {
  sleep_hours: 'h', heart_rate_bpm: 'bpm', mood_score: 'score_1_to_5', co2_ppm: 'ppm', cabin_temp_c: 'C',
};
const STATUSES = ['normal', 'attention', 'insufficient_data', 'critical'];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function id(value: unknown): boolean { return Number.isSafeInteger(value) && Number(value) > 0; }
function timestamp(value: unknown): boolean {
  return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));
}
function optionalDate(value: unknown): boolean { return value === null || timestamp(value); }
function metric(value: unknown, kind: string): boolean {
  return object(value) && finite(value.value) && value.unit === UNITS[kind as Kind]
    && timestamp(value.measured_at) && (value.source === undefined || value.source === null
      || value.source === 'manual' || value.source === 'synthetic');
}
function metrics(value: unknown, allowed: string[]): boolean {
  return object(value) && Object.entries(value).every(([kind, sample]) => allowed.includes(kind) && metric(sample, kind));
}

/** Validate the fields rendered by the dashboard; unknown additive fields remain compatible. */
export function parseDashboard(value: unknown): DashboardResponse {
  let valid = object(value);
  if (valid && object(value)) {
    const mission = value.mission;
    const environment = value.environment;
    valid = object(mission) && text(mission.name) && Number.isInteger(mission.day) && Number(mission.day) >= 0
      && mission.destination === 'mars_surface' && finite(mission.gravity_g_reference) && mission.gravity_g_reference > 0
      && typeof mission.context_source_url === 'string' && mission.demo_only === true
      && Array.isArray(value.astronauts) && value.astronauts.every(person => object(person) && text(person.id)
        && text(person.name) && STATUSES.includes(String(person.status))
        && metrics(person.latest_metrics, ['sleep_hours', 'heart_rate_bpm', 'mood_score']))
      && object(environment) && (environment.co2_ppm === null || finite(environment.co2_ppm))
      && (environment.cabin_temp_c === null || finite(environment.cabin_temp_c))
      && optionalDate(environment.measured_at) && environment.measurement_zone === 'habitat'
      && (environment.latest_metrics === undefined || metrics(environment.latest_metrics, ['co2_ppm', 'cabin_temp_c']))
      && Array.isArray(value.alerts) && value.alerts.every(alert => object(alert) && id(alert.id)
        && STATUSES.includes(String(alert.level)) && text(alert.label) && text(alert.explanation))
      && Array.isArray(value.pending_followups) && value.pending_followups.every(check => object(check)
        && id(check.id) && id(check.investigation_id) && typeof check.kind === 'string' && Object.hasOwn(UNITS, check.kind)
        && (check.astronaut_id === null || text(check.astronaut_id)) && text(check.reason)
        && check.status === 'pending' && optionalDate(check.due_at) && timestamp(check.created_at)
        && check.completed_at === null && check.measurement_id === null)
      && optionalDate(value.last_investigation_at) && typeof value.has_unanalyzed_measurements === 'boolean';
  }
  if (!valid) throw new Error('O servidor retornou dados de dashboard inválidos.');
  return value as DashboardResponse;
}

export async function fetchDashboard(signal: AbortSignal): Promise<DashboardResponse> {
  return parseDashboard(await cachedRead<DashboardResponse>('dashboard', async () => {
    let response: Response;
    try {
      response = await fetch('/api/dashboard', {
        method: 'GET', signal, cache: 'no-store', headers: { Accept: 'application/json' },
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error('Não foi possível conectar ao servidor da missão.');
    }
    if (!response.ok) throw new Error('Não foi possível consultar os dados da missão.');
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new Error('O servidor retornou uma resposta inválida.'); }
    return parseDashboard(body);
  }));
}

export function nasaReferenceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'nasa.gov' || url.hostname.endsWith('.nasa.gov'))
      && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
