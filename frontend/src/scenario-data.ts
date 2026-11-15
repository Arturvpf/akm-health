/** AKM-34: deterministic comparison of simulated observations; no clinical interpretations. */
import type { Kind } from './types';
export type SimulatedProfile = { id: string; name: string; metrics: Partial<Record<Kind, number>> };
export const SAMPLE_PROFILES: SimulatedProfile[] = [
  { id: 'A1', name: 'Aurora', metrics: { sleep_hours: 5.4, heart_rate_bpm: 74, mood_score: 3 } },
  { id: 'A2', name: 'Orion', metrics: { sleep_hours: 5.7, heart_rate_bpm: 71, mood_score: 3 } },
  { id: 'A3', name: 'Vega', metrics: { sleep_hours: 5.6, heart_rate_bpm: 76 } }, // mood absent in seed
  { id: 'A4', name: 'Lyra', metrics: { sleep_hours: 7.9, mood_score: 4 } }, // HR absent in seed
];
export const SAMPLE_HABITAT = { co2_ppm: 980, cabin_temp_c: 22.2 } as const;
export const DISPLAY_METRICS: readonly { id: Kind; label: string; unit: string; min: number; max: number; step: number }[] = [
  { id: 'sleep_hours', label: 'Sleep (estimate)', unit: 'h', min: 0, max: 24, step: 0.1 },
  { id: 'heart_rate_bpm', label: 'Heart rate (spot reading)', unit: 'bpm', min: 1, max: 300, step: 1 },
  { id: 'mood_score', label: 'Self-reported well-being', unit: '1–5', min: 1, max: 5, step: 1 },
  { id: 'co2_ppm', label: 'Habitat CO₂', unit: 'ppm', min: 0, max: 10_000, step: 1 },
  { id: 'cabin_temp_c', label: 'Cabin temperature', unit: '°C', min: -50, max: 80, step: 0.1 },
];
export type Comparison = { baseline: number | null; hypothetical: number | null; difference: number | null; unit: string };
export function compareMetric(kind: Kind, baseline: number | null | undefined, hypothetical: number | null | undefined): Comparison {
  const definition = DISPLAY_METRICS.find(item => item.id === kind);
  if (!definition) throw new Error('Unknown metric');
  const valid = (number: number | null | undefined) =>
    number !== null && number !== undefined && Number.isFinite(number) && number >= definition.min
    && number <= definition.max && (kind !== 'mood_score' || Number.isInteger(number));
  const base = valid(baseline) ? baseline! : null;
  const alternative = valid(hypothetical) ? hypothetical! : null;
  return { baseline: base, hypothetical: alternative,
    difference: base === null || alternative === null ? null : Number((alternative - base).toFixed(4)), unit: definition.unit };
}
