import type { Kind, MeasurementCreate, Quality, DataSource } from './types';

export const FORM_METRICS = {
  sleep_hours: { unit: 'h', displayUnit: 'h', zone: 'astronaut', id: 'MED-SLEEP',
    instruction: 'Estimate how long you slept during your last completed sleep period. Enter when you woke up and the UTC offset. Leave the reading blank if you do not know the duration.',
    limit: 'Enter 0 to 24 h. Enter zero only if you did not sleep.',
    url: 'https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100' },
  heart_rate_bpm: { unit: 'bpm', displayUnit: 'bpm', zone: 'astronaut', id: 'MED-HR',
    instruction: 'Select the crew member. Record one reading from the monitor in bpm and enter the time it was taken. For comparison, take readings under similar conditions, preferably at rest.',
    limit: 'Enter a finite value greater than zero. Resting conditions, measurement technique, and device accuracy are outside the demo.',
    url: 'https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/' },
  mood_score: { unit: 'score_1_to_5', displayUnit: '1–5 scale', zone: 'astronaut', id: 'MED-MOOD',
    instruction: 'How would you rate your emotional well-being now? Choose from 1 (very poor) to 5 (very good).',
    limit: 'This is a subjective check-in on a demonstration scale with no clinical validation.',
    url: 'https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=99' },
  co2_ppm: { unit: 'ppm', displayUnit: 'ppm', zone: 'habitat', id: 'MED-CO2',
    instruction: 'Enter the cabin air CO₂ reading in ppm, the observation time, and the source. Mark unstable readings as suspect.',
    limit: 'Use a finite, nonnegative value for the simulated cabin air. Determining cabin safety is outside the demo.',
    url: 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/' },
  cabin_temp_c: { unit: 'C', displayUnit: '°C', zone: 'habitat', id: 'MED-TEMP',
    instruction: 'Record cabin air temperature in °C and the observation time.',
    limit: 'Use a finite value for the air inside the habitat.',
    url: 'https://www.nasa.gov/hrp/hazards/' },
} as const;

export interface MeasurementDraft {
  kind: Kind; astronaut: string; value: string; localTime: string; offset: string;
  source: DataSource; quality: Quality;
}
export const EMPTY_DRAFT: MeasurementDraft = {
  kind: 'sleep_hours', astronaut: '', value: '', localTime: '', offset: '+00:00', source: 'manual', quality: 'ok',
};
export type FieldErrors = Partial<Record<keyof MeasurementDraft, string>>;
export const DRAFT_STORAGE_KEY = 'akm-measurement-draft-v1';

/**
 * Once a reading is confirmed by the server or held in the local outbox, its values must not
 * linger as a persisted draft: reopening the form would offer the same reading for a second,
 * non-idempotent submission. Keep only the selected metric.
 */
export function draftAfterSubmission(draft: MeasurementDraft): MeasurementDraft {
  return { ...EMPTY_DRAFT, kind: draft.kind };
}

/** Explicit fixed UTC offset avoids ambiguous local/DST conversions. Calendar dates cannot roll over. */
export function measurementTime(local: string, offset: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(local)
    || !/^[+-](?:[01]\d|2[0-3]):[0-5]\d$/.test(offset) || local.startsWith('0000')) return null;
  const wall = new Date(`${local}Z`);
  if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0, local.length) !== local) return null;
  const instant = new Date(`${local}${offset}`);
  if (!Number.isFinite(instant.getTime()) || instant.getUTCFullYear() < 1 || instant.getUTCFullYear() > 9999) return null;
  return instant.toISOString();
}

export function validateDraft(draft: MeasurementDraft, astronautIds: string[]):
  { errors: FieldErrors; payload: MeasurementCreate | null } {
  const errors: FieldErrors = {};
  const metric = FORM_METRICS[draft.kind];
  if (metric.zone === 'astronaut' && !astronautIds.includes(draft.astronaut)) errors.astronaut = 'Select an available crew member.';
  // Accept decimal comma for Portuguese input, without accepting grouping or empty-as-zero.
  const raw = draft.value.trim().replace(',', '.');
  const value = Number(raw);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(value)) errors.value = 'Enter a finite number or leave the reading unrecorded.';
  else if (draft.kind === 'sleep_hours' && (value < 0 || value > 24)) errors.value = 'Enter a duration from 0 to 24 hours.';
  else if (draft.kind === 'heart_rate_bpm' && value <= 0) errors.value = 'Enter a reading greater than zero in bpm.';
  else if (draft.kind === 'mood_score' && (!Number.isInteger(value) || value < 1 || value > 5)) errors.value = 'Choose an integer from 1 to 5.';
  else if (draft.kind === 'co2_ppm' && value < 0) errors.value = 'Enter a nonnegative CO₂ reading.';
  const measuredAt = measurementTime(draft.localTime, draft.offset);
  if (!measuredAt) {
    errors.localTime = 'Enter a valid date and time and check the UTC offset.';
    if (!/^[+-](?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.offset)) errors.offset = 'Use +00:00 or -03:00 format, with hours from 00 to 23 and minutes from 00 to 59.';
  }
  if (draft.source !== 'manual' && draft.source !== 'synthetic') errors.source = 'Choose a manual or simulated source.';
  if (draft.quality !== 'ok' && draft.quality !== 'suspect') errors.quality = 'Choose the technical quality of the reading.';
  if (Object.keys(errors).length || !measuredAt) return { errors, payload: null };
  return { errors, payload: { kind: draft.kind, unit: metric.unit, value, measured_at: measuredAt,
    astronaut_id: metric.zone === 'habitat' ? null : draft.astronaut, source: draft.source, quality: draft.quality } as MeasurementCreate };
}
