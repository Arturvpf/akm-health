/** AKM-12 — named P0 sections, deliberately without a router dependency. */
export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', description: 'Mission overview' },
  { id: 'registrar', label: 'Register', description: 'New measurement' },
  { id: 'historico', label: 'History', description: 'Recorded measurements' },
  { id: 'investigacao', label: 'Investigation', description: 'Analysis and follow-up' },
] as const;

export const EXPERIMENTAL_NAVIGATION = [
  { id: 'comparador', label: 'Scenario comparator', description: 'AKM-34 · Simulated comparison' },
  { id: 'ambientes', label: 'Mission environments', description: 'AKM-35 · NASA context' },
  { id: 'corpo', label: 'Body map', description: 'AKM-36 · Educational links' },
  { id: 'autocuidado', label: 'Self-care journey', description: 'AKM-37 · Participation points' },
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
