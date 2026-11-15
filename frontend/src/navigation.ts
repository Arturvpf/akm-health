/** AKM-12 — named P0 sections, deliberately without a router dependency. */
export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', description: 'Mission overview' },
  { id: 'register', label: 'Register', description: 'New measurement' },
  { id: 'history', label: 'History', description: 'Recorded measurements' },
  { id: 'investigation', label: 'Investigation', description: 'Analysis and follow-up' },
] as const;

export const EXPERIMENTAL_NAVIGATION = [
  { id: 'scenarios', label: 'Scenario comparator', description: 'AKM-34 · Simulated comparison' },
  { id: 'environments', label: 'Mission environments', description: 'AKM-35 · NASA context' },
  { id: 'body', label: 'Body map', description: 'AKM-36 · Educational links' },
  { id: 'self-care', label: 'Self-care journey', description: 'AKM-37 · Participation points' },
] as const;
/** Landing page: the front door of the site, outside the four mission pages. */
export const HOME = { id: 'home', label: 'Home', description: 'Overview of AKM Health' } as const;
export const ALL_NAVIGATION = [HOME, ...NAVIGATION, ...EXPERIMENTAL_NAVIGATION] as const;
export type PageId = (typeof ALL_NAVIGATION)[number]['id'];
export const DEFAULT_PAGE: PageId = 'home';

function routeCandidate(hash: string): string {
  return hash.replace(/^#\/?/, '').replace(/\/$/, '');
}

export function parsePage(hash: string): PageId {
  const candidate = routeCandidate(hash);
  const match = ALL_NAVIGATION.find((item) => item.id === candidate);
  return match ? match.id : DEFAULT_PAGE;
}

/** Returns the canonical hash when `hash` uses a legacy id, otherwise null. */

export function pageHref(page: PageId): string {
  return `#/${page}`;
}
