# AKM-33 — Offline persistence, reconnection and explicit conflict resolution

**Status:** technical implementation delivered for review; it is not a certification of clinical reliability.

## Safety principle

Repeating a POST after the response is lost can duplicate a reading even if the server saved the first POST. To prevent this, the client assigns a stable UUID to each **recording operation**, persists that operation in IndexedDB **before the first network call**, and uses `POST /api/sync/measurements` for every attempt to synchronize records made through the interface. The server associates the UUID with the SHA-256 of the validated content and with the measurement ID in a single SQLite transaction.

- **201**: reading created and operation recorded; the client accepts the receipt and removes the item from the local queue.
- **200**: UUID already processed with the same content; the server returns the original ID (`reused: true`) without duplicating the measurement.
- **409**: same UUID with different content; permanent conflict, and the earlier measurement is not overwritten.
- **404/422**: invalid record or missing subject; the pending item is shown as a conflict and no local data is discarded.
- **Network/5xx/invalid receipt/timeout**: keep the record and the same UUID; resending later is safe.

## Components

| Component | Responsibility |
|---|---|
| `frontend/src/offline-store.ts` | IndexedDB v1, cached snapshots, outbox, resends and durable confirmation |
| `frontend/src/OfflineStatus.tsx` | Pending items, conflicts, JSON export and manual/automatic synchronization |
| `frontend/public/sw.js` | Shell and local resource caching in production; **never automatic caching of `/api`** |
| `frontend/src/measurement-api.ts` | The interface uses `durableSaveMeasurement`; the legacy `saveMeasurement` helper is kept only for compatibility and older tests |
| `backend/app/offline_sync.py` | Idempotent transaction, validation and conflict control |
| `backend/app/models.py` | New auxiliary table `sync_operations` |
| `backend/app/db.py` | **Schema v1→v2** migration, preserving earlier data |
| `backend/tests/test_akm33_sync.py` | Replays, conflict, timestamps, migration and concurrency |

### Migration and backup

The original MVP used 4 tables and `PRAGMA user_version=1`. The P2 extension uses **5 tables** (the original 4 plus `sync_operations`) with `user_version=2`. No original measurement needs to be modified. The migration runs at startup or with `cd backend && python -m app.db`.

**Before updating** an existing local database, stop the server and make a backup: `cp backend/akm.db backend/akm.db.bak-before-akm33`. If the schema is not recognized, the migration must fail rather than create incompatible structures.

## Offline → online demonstration

1. Start the backend and the frontend in local production mode (`npm run build` and `npm run preview`), run the seed, and visit the application at least once with a working network so the shell is stored in the browser.
2. Leave the backend unavailable and record a **fictional** reading; the form shows the operation saved locally, and the global banner shows 1 pending item.
3. Refresh the page without restoring the API. IndexedDB must keep the pending item. The form also persists the draft in `localStorage`.
4. Restart the server and click **Sync now**. The pending count must drop to zero and a new row must appear in the history.
5. Simulate a lost response after the server has written; resend the same UUID with the same content: you receive 200, `reused=true`, with a **single measurement ID** in the database.
6. Resend the same UUID with a different value: you receive 409, the queue must record the conflict and show the option to **export the JSON** without deleting the reading.

## Important limitations

- This implementation guarantees idempotency **for readings sent through the `/api/sync/measurements` endpoint**. The older `POST /api/measurements` endpoint remains available for legacy clients and does **not** receive this guarantee.
- The interface caches responses for the dashboard, history, profiles and schedules already viewed, and flags when it uses a possibly outdated copy. Without a first online visit, there is no data to consult offline. Results are never generated artificially.
- The automatic write queue covers **new measurements**. Investigations and follow-up completion depend on the server and are neither run nor invented offline; doing so on a possibly outdated state would require an additional specification. This limit must be presented to the team before the task is accepted as "fully offline" in every flow.
- IndexedDB persistence depends on browser policies, quota and manual data clearing. The queue export option protects against some risks; it is not a guaranteed backup.
- Without authentication, do not synchronize health data of real people. All records are fictional or manual demonstration entries. Do not confuse `quality=ok` with normal health.

**NASA:** reference for autonomy and distance from Earth at https://www.nasa.gov/hrp/hazards/ ; these are not medical triage rules.
