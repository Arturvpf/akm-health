import { useCallback, useEffect, useState } from 'react';
import { isLinkLost, LINK_CHANGED_EVENT, setLinkLost } from './link-state';
import { listOutbox, synchronizeOutbox, type OutboxEntry } from './offline-store';
import './offline.css';

export function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkLost, setLinkLostState] = useState(isLinkLost);
  const refresh = useCallback(() => {
    void listOutbox().then(setEntries).catch(() => setError('Local storage is unavailable. Do not register measurements until storage is confirmed.'));
  }, []);
  const sync = useCallback(async () => {
    setBusy(true);
    try { await synchronizeOutbox(); refresh(); }
    catch { setError('Sync failed. Queued operations remain on this device.'); }
    finally { setBusy(false); }
  }, [refresh]);
  useEffect(() => {
    refresh();
    const changed = () => refresh();
    const connected = () => { setOnline(true); void sync(); };
    const disconnected = () => setOnline(false);
    const cacheUsed = () => setCached(true);
    const serverReachable = () => setCached(false);
    const linkChanged = () => {
      setLinkLostState(isLinkLost());
      if (isLinkLost()) return;
      // Probe the server so the banner stops saying the copy on screen is cached, then deliver the queue.
      void fetch('/api/health', { cache: 'no-store' })
        .then(response => { if (response.ok) window.dispatchEvent(new Event('akm-server-reachable')); })
        .catch(() => undefined);
      void sync();
    };
    window.addEventListener(LINK_CHANGED_EVENT, linkChanged);
    window.addEventListener('akm-cached-response', cacheUsed);
    window.addEventListener('akm-server-reachable', serverReachable);
    window.addEventListener('akm-outbox-change', changed);
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected);
    const poll = window.setInterval(() => { void sync(); }, 30_000);
    void sync();
    if (navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined);
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    return () => { window.removeEventListener(LINK_CHANGED_EVENT, linkChanged); window.clearInterval(poll); window.removeEventListener('akm-outbox-change', changed);
      window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected);
      window.removeEventListener('akm-cached-response', cacheUsed);
      window.removeEventListener('akm-server-reachable', serverReachable); };
  }, [refresh, sync]);
  const pending = entries.filter(entry => entry.status === 'pending');
  const conflicts = entries.filter(entry => entry.status === 'conflict');
  function exportQueue() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = href; link.download = 'akm-offline-outbox-backup.json';
    link.click(); URL.revokeObjectURL(href);
  }
  return <aside className={linkLost ? 'offline-banner is-lost' : 'offline-banner'} aria-label="Sync status">
    <div role="status">
      <strong>{linkLost ? 'Link to the mission server lost (simulated)' : cached ? 'Showing cached copy (may be out of date)' : online ? 'Network connected' : 'No network'}</strong> · {pending.length} pending · {conflicts.length} conflict(s)
      {(linkLost || !online || pending.length > 0) && <span> · Local data may be out of date</span>}
      {linkLost && <span className="offline-hint"> · Readings you record now stay on this device and are sent when the link returns.</span>}
    </div>
    <div className="offline-actions">
      <button type="button" className={linkLost ? 'offline-restore' : undefined} onClick={() => setLinkLost(!linkLost)}
        aria-pressed={linkLost}>{linkLost ? 'Restore link' : 'Simulate link loss'}</button>
      <button type="button" onClick={() => void sync()} disabled={busy || linkLost || pending.length === 0}>
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
      {entries.length > 0 && <button type="button" onClick={exportQueue}>Export queue</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {conflicts.length > 0 && <details><summary>Conflicts need review ({conflicts.length})</summary>
      <p>Conflicting operations are never discarded automatically. Export the queue and check the server data before correcting.</p>
      <ul>{conflicts.map(item => <li key={item.id}><code>{item.id}</code>: {item.error}</li>)}</ul>
    </details>}
  </aside>;
}
