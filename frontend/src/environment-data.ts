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
    id: 'mars_surface', name: 'Superfície de Marte', setting: 'Habitat fictício de superfície',
    gravity: '3,7 m/s² (~0,38 g terrestre)', gravityRatio: 3.7 / 9.8,
    factors: ['Gravidade parcial', 'Distância da Terra', 'Ambiente fechado', 'Radiação espacial'],
    implications: 'A autonomia e o monitoramento de condições internas são temas relevantes. A gravidade parcial muda o contexto físico da missão, não as regras médicas do aplicativo.',
    limitations: 'A temperatura externa marciana não é a temperatura interna da cabine; a seleção não modifica os registros da ODYSSEY-26.',
    sources: [{ title: 'NASA Planetary Fact Sheet', url: FACT_SHEET }, { title: 'NASA HRP — Five Hazards', url: HAZARDS }],
  },
  {
    id: 'lunar_surface', name: 'Superfície lunar', setting: 'Habitat lunar hipotético',
    gravity: '1,6 m/s² (~0,16 g terrestre)', gravityRatio: 1.6 / 9.8,
    factors: ['Gravidade parcial', 'Ambiente fechado', 'Exposição espacial contextual'],
    implications: 'A gravidade lunar é menor que a terrestre e o habitat requer controle ambiental. As leituras exibidas seguem simuladas, sem recalibrar limites clínicos.',
    limitations: 'Os dados de tripulação do MVP não são dados de uma missão lunar. Não extrapolar riscos clínicos quantitativos.',
    sources: [{ title: 'NASA Planetary Fact Sheet', url: FACT_SHEET }, { title: 'NASA HRP — Five Hazards', url: HAZARDS }],
  },
  {
    id: 'iss_microgravity', name: 'Órbita terrestre / ISS', setting: 'Habitat orbital hipotético',
    gravity: 'Microgravidade orbital (sem valor numérico estimado nesta demo)', gravityRatio: null,
    factors: ['Microgravidade', 'Ambiente fechado', 'Isolamento', 'Radiação espacial'],
    implications: 'A NASA estuda como a microgravidade e ambientes fechados afetam o corpo e o desempenho. O painel apenas contextualiza essas categorias.',
    limitations: 'A gravidade local não é literalmente zero. Os dados de CO₂ do habitat fictício não são telemetria da ISS.',
    sources: [{ title: 'NASA HRP — Five Hazards', url: HAZARDS }, { title: 'NASA HRP — Risks', url: RISKS }],
  },
  {
    id: 'earth_analog', name: 'Análogo terrestre', setting: 'Habitat de simulação na Terra',
    gravity: '9,8 m/s² (1 g terrestre)', gravityRatio: 1,
    factors: ['Isolamento experimental', 'Ambiente controlado', 'Condições terrestres'],
    implications: 'Análogos terrestres ajudam a estudar fatores de isolamento e desempenho. A fonte de dados deste MVP continua sintética.',
    limitations: 'Um análogo terrestre não reproduz radiação espacial nem microgravidade. Não usar sua referência como regra clínica.',
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
