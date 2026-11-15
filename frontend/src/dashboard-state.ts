import { fetchDashboard } from './api';
import type { DashboardResponse } from './types';

export interface DashboardState {
  data: DashboardResponse | null;
  phase: 'loading' | 'ready' | 'error';
  error: string | null;
  receivedAt: string | null;
  /** Device save time of a local copy shown because the server could not be reached; null for live data. */
  cachedAt?: string | null;
}
export const INITIAL_DASHBOARD_STATE: DashboardState = {
  data: null, phase: 'loading', error: null, receivedAt: null, cachedAt: null,
};

/** Owns only GET requests; old or unmounted requests can never replace confirmed data. */
export function createDashboardController(
  load: (signal: AbortSignal, onCached?: (savedAt: string) => void) => Promise<DashboardResponse> = fetchDashboard,
  timeoutMs = 10_000,
) {
  let state = INITIAL_DASHBOARD_STATE;
  let sequence = 0;
  let disposed = false;
  let active: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(state: DashboardState) => void>();
  function publish(next: DashboardState) {
    state = next;
    for (const listener of listeners) listener(state);
  }
  function cancel() {
    active?.abort();
    clearTimeout(timer);
  }
  return {
    getState: () => state,
    subscribe(listener: (state: DashboardState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async refresh() {
      if (disposed) return;
      const current = ++sequence;
      cancel();
      const controller = new AbortController();
      active = controller;
      let timedOut = false;
      publish({ ...state, phase: 'loading', error: null });
      // Race also settles when a custom transport ignores AbortSignal.
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(new Error('The request timed out.'));
          }, timeoutMs);
          timer = timeout;
        });
        let cachedAt: string | null = null;
        const data = await Promise.race([load(controller.signal, savedAt => { cachedAt = savedAt; }), deadline]);
        if (disposed || current !== sequence) return;
        // A device copy is not a confirmed refresh: keep its own save time and flag it as stale.
        publish(cachedAt === null
          ? { data, phase: 'ready', error: null, receivedAt: new Date().toISOString(), cachedAt: null }
          : { data, phase: 'ready', error: null, receivedAt: cachedAt, cachedAt });
      } catch (error) {
        if (disposed || current !== sequence) return;
        publish({ ...state, phase: 'error', error: timedOut ? 'The request timed out.'
          : error instanceof Error ? error.message : 'Could not retrieve mission data.' });
      } finally {
        clearTimeout(timeout);
        if (current === sequence) active = null;
      }
    },
    dispose() { disposed = true; ++sequence; cancel(); listeners.clear(); },
  };
}
