import type { AstronautRead, Kind, MeasurementRead } from './types';

export const METRICS = {
  sleep_hours: { label: 'Sleep duration', unit: 'h' },
  heart_rate_bpm: { label: 'Heart rate', unit: 'bpm' },
  mood_score: { label: 'Mood', unit: 'points (1–5)' },
  co2_ppm: { label: 'Cabin CO₂', unit: 'ppm' },
  cabin_temp_c: { label: 'Cabin temperature', unit: '°C' },
} as const satisfies Record<Kind, { label: string; unit: string }>;

export const CREW_KINDS = ['sleep_hours', 'heart_rate_bpm', 'mood_score'] as const;
export const HABITAT_KINDS = ['co2_ppm', 'cabin_temp_c'] as const;

export interface HistoryFilters {
  astronautId: string | null;
  kind: Kind;
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;
const PAGE_SIZE = 100;

async function readList<T>(endpoint: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(endpoint, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error('Resposta inesperada');
  return body as T[];
}

export function readProfiles(signal: AbortSignal) {
  return readList<AstronautRead>('/api/astronauts', signal);
}

export async function readHistory(filters: HistoryFilters, signal: AbortSignal) {
  const params = new URLSearchParams({ kind: filters.kind, limit: String(PAGE_SIZE) });
  if (filters.astronautId !== null) params.set('astronaut_id', filters.astronautId);
  if (filters.start) params.set('from', `${filters.start}T00:00:00Z`);
  if (filters.end) params.set('to', `${filters.end}T23:59:59.999999Z`);
  const observations: MeasurementRead[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    params.set('offset', String(offset));
    const page = await readList<MeasurementRead>(`/api/measurements?${params}`, signal);
    observations.push(...page);
    if (page.length < PAGE_SIZE) return observations;
  }
}

function dayAt(timestamp: number) {
  return Math.floor(timestamp / DAY_MS);
}

export function dayStart(day: number) {
  return day * DAY_MS;
}

type ObservationPoint = { time: number; value: number; id: number };
type Gap = { firstDay: number; lastDay: number };

export function summarizeSeries(rows: [MeasurementRead, ...MeasurementRead[]], filters: HistoryFilters) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const start = Date.parse(filters.start ? `${filters.start}T00:00:00Z` : first.measured_at);
  const end = Date.parse(filters.end ? `${filters.end}T23:59:59.999Z` : last.measured_at);
  const gaps: Gap[] = [];
  const segments: ObservationPoint[][] = [];
  const suspect: ObservationPoint[] = [];
  let previousDay = dayAt(start) - 1;
  let segment: ObservationPoint[] = [];
  let minimum = first.value;
  let maximum = first.value;
  let missingDays = 0;

  function addGap(firstDay: number, lastDay: number) {
    gaps.push({ firstDay, lastDay });
    missingDays += lastDay - firstDay + 1;
    segment = [];
  }

  for (const row of rows) {
    const point = { time: Date.parse(row.measured_at), value: row.value, id: row.id };
    const day = dayAt(point.time);
    if (day > previousDay + 1) addGap(previousDay + 1, day - 1);
    previousDay = day;
    minimum = Math.min(minimum, point.value);
    maximum = Math.max(maximum, point.value);
    if (row.quality === 'suspect') {
      suspect.push(point);
      segment = [];
    } else {
      if (segment.length === 0) segments.push(segment);
      segment.push(point);
    }
  }
  if (previousDay < dayAt(end)) addGap(previousDay + 1, dayAt(end));

  return { first, last, start, end, gaps, missingDays, segments, suspect, minimum, maximum };
}
