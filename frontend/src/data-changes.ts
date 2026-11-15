/**
 * Tells every mounted view that server data changed (a reading was confirmed, an investigation ran, a check was
 * completed) so schedules and dashboards reload at once instead of waiting for a manual refresh.
 * The same signal reaches other tabs of this app through BroadcastChannel and, when a tab becomes visible
 * again, a throttled reload covers changes this tab could not hear about.
 */
export const DATA_CHANGED_EVENT = 'akm-data-changed';
const CHANNEL = 'akm-data-changes';
const VISIBLE_RELOAD_MS = 5_000;

function openChannel(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL); } catch { return null; }
}

/** `everywhere` also wakes views in this tab; `other-tabs` is for callers that already refreshed their own page. */
export function announceDataChange(reach: 'everywhere' | 'other-tabs' = 'everywhere') {
  if (typeof window === 'undefined') return;
  if (reach === 'everywhere') window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  const channel = openChannel();
  if (channel) { channel.postMessage('changed'); channel.close(); }
}

/** Calls `listener` whenever data may have changed. Returns the unsubscribe function. */
export function onDataChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const channel = openChannel();
  let hiddenAt = 0;
  const visible = () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt >= VISIBLE_RELOAD_MS) listener();
    hiddenAt = 0;
  };
  window.addEventListener(DATA_CHANGED_EVENT, listener);
  document.addEventListener('visibilitychange', visible);
  if (channel) channel.onmessage = listener;
  return () => {
    window.removeEventListener(DATA_CHANGED_EVENT, listener);
    document.removeEventListener('visibilitychange', visible);
    channel?.close();
  };
}
