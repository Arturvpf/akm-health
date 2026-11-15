/** AKM-12 — named P0 sections, deliberately without a router dependency. */
export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', description: 'Mission overview' },
  { id: 'registrar', label: 'Register', description: 'New measurement' },
  { id: 'historico', label: 'History', description: 'Recorded measurements' },
  { id: 'investigacao', label: 'Investigation', description: 'Analysis and follow-up' },
] as const;

export type PageId = (typeof NAVIGATION)[number]['id'];
export const DEFAULT_PAGE: PageId = 'dashboard';

export function parsePage(hash: string): PageId {
  const candidate = hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const match = NAVIGATION.find((item) => item.id === candidate);
  return match ? match.id : DEFAULT_PAGE;
}

export function pageHref(page: PageId): string {
  return `#/${page}`;
}
