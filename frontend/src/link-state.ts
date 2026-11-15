/**
 * Simulated loss of the link to the mission server, for demonstrating local-first use on a long mission.
 * While the link is "lost", every request to /api fails exactly like a network outage, so the real offline
 * paths run: readings go to the device queue, the dashboard falls back to its saved copy, and everything
 * is delivered once the link is restored. Nothing here changes what the server stores.
 */
import { announceDataChange } from './data-changes';

const KEY = 'akm-link-lost-v1';
export const LINK_CHANGED_EVENT = 'akm-link-change';

function readFlag(): boolean {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

let lost = typeof window === 'undefined' ? false : readFlag();

export function isLinkLost(): boolean {
  return lost;
}

export function setLinkLost(next: boolean) {
  if (lost === next) return;
  lost = next;
  try {
    if (next) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY);
  } catch { /* The simulation still works for this page view. */ }
  window.dispatchEvent(new Event(LINK_CHANGED_EVENT));
  // Views reload now: they show the saved copy during the outage and live data after it.
  announceDataChange();
}

let installed = false;

/** Wraps fetch once so API calls fail while the simulated link is down. Static files are never blocked. */
export function installLinkGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (lost) {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      let path = raw;
      try { path = new URL(raw, window.location.href).pathname; } catch { /* Keep the raw value. */ }
      if (path.startsWith('/api/')) return Promise.reject(new TypeError('Failed to fetch (simulated link loss)'));
    }
    return original(input, init);
  };
}
