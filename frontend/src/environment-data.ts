/** AKM-35: research context only, not a clinical threshold, sensor input or actual mission relocation. */
export type EnvironmentId = 'earth_analog' | 'iss_microgravity' | 'lunar_surface' | 'mars_surface';
export type MissionEnvironment = {
  id: EnvironmentId;
  name: string;
  setting: string;
  gravity: string;
  gravityRatio: number | null;
  factors: readonly string[];
  implications: string;
  limitations: string;
  sources: readonly { title: string; url: string }[];
};
const HAZARDS = 'https://www.nasa.gov/hrp/hazards/';
const FACT_SHEET = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
const RISKS = 'https://www.nasa.gov/hrp/risks/';
export const ENVIRONMENTS: readonly MissionEnvironment[] = [
  {
    id: 'mars_surface', name: 'Mars surface', setting: 'Fictional surface habitat',
    gravity: '3.7 m/s² (~0.38 Earth g)', gravityRatio: 3.7 / 9.8,
    factors: ['Partial gravity', 'Distance from Earth', 'Closed environment', 'Space radiation'],
    implications: 'Crew autonomy and monitoring of habitat conditions are relevant themes. Partial gravity changes the physical context of the mission, not the app rules.',
    limitations: 'Outside Martian temperature is not cabin temperature; this selection does not modify ODYSSEY-26 records.',
    sources: [{ title: 'NASA Planetary Fact Sheet', url: FACT_SHEET }, { title: 'NASA HRP — Five Hazards', url: HAZARDS }],
  },
  {
    id: 'lunar_surface', name: 'Lunar surface', setting: 'Hypothetical lunar habitat',
    gravity: '1.6 m/s² (~0.16 Earth g)', gravityRatio: 1.6 / 9.8,
    factors: ['Partial gravity', 'Closed environment', 'Space exposure (context)'],
    implications: 'Lunar gravity is lower than Earth gravity and the habitat needs environmental control. Displayed readings stay simulated; no thresholds are recalibrated.',
    limitations: 'MVP crew data are not lunar mission data. Do not extrapolate quantitative clinical risk.',
    sources: [{ title: 'NASA Planetary Fact Sheet', url: FACT_SHEET }, { title: 'NASA HRP — Five Hazards', url: HAZARDS }],
  },
  {
    id: 'iss_microgravity', name: 'Low Earth orbit / ISS', setting: 'Hypothetical orbital habitat',
    gravity: 'Orbital microgravity (no numeric value estimated in this demo)', gravityRatio: null,
    factors: ['Microgravity', 'Closed environment', 'Isolation', 'Space radiation'],
    implications: 'NASA studies how microgravity and closed environments affect the body and performance. This panel only gives context for those categories.',
    limitations: 'Local gravity is not literally zero. Fictional habitat CO₂ data are not ISS telemetry.',
    sources: [{ title: 'NASA HRP — Five Hazards', url: HAZARDS }, { title: 'NASA HRP — Risks', url: RISKS }],
  },
  {
    id: 'earth_analog', name: 'Earth analog', setting: 'Simulation habitat on Earth',
    gravity: '9.8 m/s² (1 Earth g)', gravityRatio: 1,
    factors: ['Experimental isolation', 'Controlled environment', 'Earth conditions'],
    implications: 'Earth analogs help study isolation and performance factors. This MVP data source remains synthetic.',
    limitations: 'An Earth analog does not reproduce space radiation or microgravity. Do not use it as a clinical rule.',
    sources: [{ title: 'NASA Planetary Fact Sheet', url: FACT_SHEET }, { title: 'NASA HRP — Five Hazards', url: HAZARDS }],
  },
] as const;
export const DEFAULT_ENVIRONMENT: EnvironmentId = 'mars_surface';
export const ENVIRONMENT_KEY = 'akm-demonstration-environment-v1';
export function environmentById(value: string | null): MissionEnvironment {
  return ENVIRONMENTS.find(item => item.id === value) ?? ENVIRONMENTS[0];
}
export function readEnvironment(): EnvironmentId {
  try { return environmentById(localStorage.getItem(ENVIRONMENT_KEY)).id; } catch { return DEFAULT_ENVIRONMENT; }
}
export function writeEnvironment(id: EnvironmentId) {
  try { localStorage.setItem(ENVIRONMENT_KEY, id); } catch { /* non-persistent fallback */ }
  window.dispatchEvent(new Event('akm-environment-change'));
}
