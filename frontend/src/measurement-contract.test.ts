import type { MeasurementCreate } from './types';

const reading = { value: 5, measured_at: '2026-11-14T14:00:00Z', source: 'manual' } as const;

const validMeasurements = [
  { ...reading, kind: 'sleep_hours', unit: 'h', astronaut_id: 'A1' },
  { ...reading, kind: 'heart_rate_bpm', unit: 'bpm', astronaut_id: 'A1' },
  { ...reading, kind: 'mood_score', unit: 'score_1_to_5', astronaut_id: 'A1' },
  { ...reading, kind: 'co2_ppm', unit: 'ppm' },
  { ...reading, kind: 'cabin_temp_c', unit: 'C', astronaut_id: null },
] satisfies MeasurementCreate[];

// @ts-expect-error Sleep uses hours.
const wrongCrewUnit: MeasurementCreate = { ...reading, kind: 'sleep_hours', unit: 'bpm', astronaut_id: 'A1' };

// @ts-expect-error Cabin CO₂ uses ppm.
const wrongHabitatUnit: MeasurementCreate = { ...reading, kind: 'co2_ppm', unit: 'h' };

// @ts-expect-error A crew measurement requires a subject.
const missingCrewSubject: MeasurementCreate = { ...reading, kind: 'mood_score', unit: 'score_1_to_5' };

// @ts-expect-error A habitat measurement has no crew subject.
const unexpectedHabitatSubject: MeasurementCreate = { ...reading, kind: 'co2_ppm', unit: 'ppm', astronaut_id: 'A1' };
