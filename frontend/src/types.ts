/** AKM-03 contracts: frontend must not calculate clinical alerts. */
export type Kind = 'sleep_hours' | 'heart_rate_bpm' | 'mood_score' | 'co2_ppm' | 'cabin_temp_c';
export type MetricUnit = 'h' | 'bpm' | 'score_1_to_5' | 'ppm' | 'C';
export type MeasurementZone = 'astronaut' | 'habitat';
export type DataSource = 'manual' | 'synthetic';
export type Quality = 'ok' | 'suspect';
export type InvestigationStatus = 'normal' | 'attention' | 'critical' | 'insufficient_data';
export interface AstronautRead { id: string; name: string; role: string | null; baseline_sleep_hours: number }
interface MeasurementFields {
  kind: Kind; value: number; unit: MetricUnit; measured_at: string; source: DataSource;
}
type HabitatKind = 'co2_ppm' | 'cabin_temp_c';
export type MeasurementCreate = MeasurementFields & { quality?: Quality } & (
  | { kind: Exclude<Kind, HabitatKind>; astronaut_id: string }
  | { kind: HabitatKind; astronaut_id?: null }
);
export interface MeasurementRead extends MeasurementFields {
  astronaut_id: string | null;
  id: number; measurement_zone: MeasurementZone; recorded_at: string; quality: Quality;
}
export type InvestigationRequest = { scope: 'crew'; astronaut_id?: null } | { scope: 'individual'; astronaut_id: string };
export interface InvestigationEvidence { kind: Kind; astronaut_ids: string[]; quality: Quality }
export interface InvestigationHypothesis { label: string; certainty: 'unconfirmed'; explanation: string }
export interface NextCheck {
  kind: Kind; astronaut_id: string | null; reason: string; effort: 'low' | 'medium' | 'high';
}
export interface EducationalGuidance { text: string; source_id: string }
export interface InvestigationResult {
  id: number; scope: 'crew' | 'individual'; astronaut_id: string | null;
  status: InvestigationStatus; created_at: string; rules_version: string;
  input_fingerprint: string; reused: boolean; findings: string[];
  evidence: InvestigationEvidence[]; hypotheses: InvestigationHypothesis[];
  next_check: NextCheck | null; followup_id: number | null;
  guidance: EducationalGuidance[]; demo_only: true;
}
export interface FollowupCompleteRequest { status: 'completed'; measurement_id: number }
export interface FollowupRead {
  id: number; investigation_id: number; astronaut_id: string | null; kind: Kind;
  reason: string; status: 'pending' | 'completed'; due_at: string | null;
  created_at: string; completed_at: string | null; measurement_id: number | null;
}
export interface MetricSnapshot { value: number; unit: MetricUnit; measured_at: string }
export interface AstronautDashboardRead {
  id: string; name: string; latest_metrics: Partial<Record<Kind, MetricSnapshot>>; status: InvestigationStatus;
}
export interface DashboardAlert { id: number; level: InvestigationStatus; label: string; explanation: string }
export interface DashboardResponse {
  mission: { name: string; day: number; destination: 'mars_surface'; gravity_g_reference: number;
    context_source_url: string; demo_only: true };
  astronauts: AstronautDashboardRead[];
  environment: { co2_ppm: number | null; cabin_temp_c: number | null;
    measured_at: string | null; measurement_zone: 'habitat' };
  alerts: DashboardAlert[]; pending_followups: FollowupRead[];
  last_investigation_at: string | null; has_unanalyzed_measurements: boolean;
}
export type NASAHistoricalObservation = {
  source: string; source_url: string; mission_id: string; parameter: string;
  value: number; unit: string; instrument?: string | null; context: string;
} & (
  | { observed_at: string; mars_sol?: number | null }
  | { observed_at?: string | null; mars_sol: number }
);
export interface NASAReferenceResponse {
  scientific_references: Array<{ source: string; title: string; url: string; type: 'research_reference' }>;
  historical_series: NASAHistoricalObservation[];
  historical_data_status: 'not_imported' | 'imported';
}
