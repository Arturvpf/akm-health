import type { Kind, MeasurementCreate, Quality, DataSource } from './types';

export const FORM_METRICS = {
  sleep_hours: { unit: 'h', displayUnit: 'h', zone: 'astronaut', id: 'MED-SONO',
    instruction: 'Estime quantas horas você dormiu no último período completo. Informe o horário em que acordou, com fuso. Se não souber a duração, deixe sem registro.',
    limit: 'De 0 a 24 h. Zero significa que efetivamente não houve sono; ausência de informação não é zero.',
    url: 'https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100' },
  heart_rate_bpm: { unit: 'bpm', displayUnit: 'bpm', zone: 'astronaut', id: 'MED-FC',
    instruction: 'Selecione o tripulante. Registre a leitura do monitor em bpm e o horário. Para comparar duas leituras, prefira condições semelhantes, como repouso.',
    limit: 'Leitura positiva e finita. O app não verifica repouso, técnica ou precisão do aparelho.',
    url: 'https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/' },
  mood_score: { unit: 'score_1_to_5', displayUnit: 'escala de 1 a 5', zone: 'astronaut', id: 'MED-HUMOR',
    instruction: 'Como você avalia seu bem-estar emocional agora? Escolha de 1 (muito ruim) a 5 (muito bom).',
    limit: 'Check-in subjetivo da demonstração. Esta escala não é um instrumento clínico validado.',
    url: 'https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=99' },
  co2_ppm: { unit: 'ppm', displayUnit: 'ppm', zone: 'habitat', id: 'MED-CO2',
    instruction: 'Informe a leitura de CO₂ do ar interno em ppm, o horário e a origem. Se a leitura estiver instável, marque como suspeita.',
    limit: 'Valor finito e não negativo. Apenas o ar interno do habitat fictício; uma leitura isolada não classifica segurança.',
    url: 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/' },
  cabin_temp_c: { unit: 'C', displayUnit: '°C', zone: 'habitat', id: 'MED-TEMP',
    instruction: 'Registre a temperatura do ar interno em °C e o horário da leitura.',
    limit: 'Valor finito. Não é temperatura corporal nem do ambiente externo de Marte.',
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
  if (metric.zone === 'astronaut' && !astronautIds.includes(draft.astronaut)) errors.astronaut = 'Selecione um tripulante disponível.';
  // Accept decimal comma for Portuguese input, without accepting grouping or empty-as-zero.
  const raw = draft.value.trim().replace(',', '.');
  const value = Number(raw);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(value)) errors.value = 'Informe um número finito; dado ausente deve ficar sem registro.';
  else if (draft.kind === 'sleep_hours' && (value < 0 || value > 24)) errors.value = 'Informe uma duração de 0 a 24 horas.';
  else if (draft.kind === 'heart_rate_bpm' && value <= 0) errors.value = 'Informe uma leitura maior que zero em bpm.';
  else if (draft.kind === 'mood_score' && (!Number.isInteger(value) || value < 1 || value > 5)) errors.value = 'Escolha um número inteiro de 1 a 5.';
  else if (draft.kind === 'co2_ppm' && value < 0) errors.value = 'Informe uma leitura de CO₂ maior ou igual a zero.';
  const measuredAt = measurementTime(draft.localTime, draft.offset);
  if (!measuredAt) {
    errors.localTime = 'Informe uma data e hora válidas e confira o fuso UTC.';
    if (!/^[+-](?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.offset)) errors.offset = 'Use o formato +00:00 ou -03:00, com horas de 00 a 23 e minutos de 00 a 59.';
  }
  if (draft.source !== 'manual' && draft.source !== 'synthetic') errors.source = 'Selecione a origem manual ou simulada.';
  if (draft.quality !== 'ok' && draft.quality !== 'suspect') errors.quality = 'Selecione a qualidade técnica da leitura.';
  if (Object.keys(errors).length || !measuredAt) return { errors, payload: null };
  return { errors, payload: { kind: draft.kind, unit: metric.unit, value, measured_at: measuredAt,
    astronaut_id: metric.zone === 'habitat' ? null : draft.astronaut, source: draft.source, quality: draft.quality } as MeasurementCreate };
}
