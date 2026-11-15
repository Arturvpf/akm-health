/** AKM-12 — named P0 sections, deliberately without a router dependency. */
export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', description: 'Visão da missão' },
  { id: 'registrar', label: 'Registrar', description: 'Nova medição' },
  { id: 'historico', label: 'Histórico', description: 'Medições registradas' },
  { id: 'investigacao', label: 'Investigação', description: 'Análise e acompanhamento' },
] as const;

export const EXPERIMENTAL_NAVIGATION = [
  { id: 'comparador', label: 'Cenários hipotéticos', description: 'AKM-34 · comparação simulada' },
  { id: 'ambientes', label: 'Ambientes de missão', description: 'AKM-35 · contexto NASA' },
  { id: 'corpo', label: 'Corpo interativo', description: 'AKM-36 · associação educativa' },
] as const;
export const ALL_NAVIGATION = [...NAVIGATION, ...EXPERIMENTAL_NAVIGATION] as const;
export type PageId = (typeof ALL_NAVIGATION)[number]['id'];
export const DEFAULT_PAGE: PageId = 'dashboard';

export function parsePage(hash: string): PageId {
  const candidate = hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const match = ALL_NAVIGATION.find((item) => item.id === candidate);
  return match ? match.id : DEFAULT_PAGE;
}

export function pageHref(page: PageId): string {
  return `#/${page}`;
}
