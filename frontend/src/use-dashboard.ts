import { useCallback, useEffect, useState } from 'react';
import { fetchDashboard } from './api';
import { onDataChange } from './data-changes';
import type { DashboardResponse } from './types';

/** Read-only dashboard snapshot shared by the exploratory P2 views (AKM-36, AKM-37). */
export type DashboardSnapshot =
  | { phase: 'loading'; data: DashboardResponse | null; error: null }
  | { phase: 'ready'; data: DashboardResponse; error: null }
  | { phase: 'error'; data: DashboardResponse | null; error: string };

export function useDashboardSnapshot() {
  const [state, setState] = useState<DashboardSnapshot>({ phase: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ phase: 'loading', data: previous.data, error: null }));
    fetchDashboard(controller.signal)
      .then(data => setState({ phase: 'ready', data, error: null }))
      .catch(error => {
        if (controller.signal.aborted) return;
        setState(previous => ({ phase: 'error', data: previous.data,
          error: error instanceof Error ? error.message : 'Could not retrieve mission data.' }));
      });
    return () => controller.abort();
  }, [attempt]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => onDataChange(retry), [retry]);
  return { ...state, retry };
}

const timeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
});

export function formatUtc(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? `${timeFormat.format(parsed)} UTC` : value;
}
