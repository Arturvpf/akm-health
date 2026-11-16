# AKM-13 — Crew dashboard

The dashboard route reads `GET /api/dashboard` on mount and when the user selects **Refresh data**. It renders API crew identities, the latest usable sleep/heart-rate/mood measurements, habitat CO₂/temperature, persisted assessment labels and pending measurements in server priority order. Other routes remain the AKM-11 previews and are labelled accordingly.

## Data and assessment boundaries

- Opening or refreshing the page never creates an investigation or completes a follow-up. The investigation action belongs to AKM-16.
- Until `last_investigation_at` exists, crew badges say **Not evaluated by the engine** and no assessment alerts are shown. Afterwards the page displays the server statuses and explanations without calculating thresholds. The last-investigation timestamp is explicitly global and does not imply every profile was assessed then.
- `has_unanalyzed_measurements` displays **New measurements available — update the investigation**. Existing persisted results remain visible. The link to investigation still leads to a labelled preview in this increment.
- Manual and synthetic sources use shared, textual provenance badges. The NASA public-reference card links only to an HTTPS NASA hostname, separately from fictional crew observations. Historical series are not displayed; AKM-38/39 own that integration. Red remains restricted to the reserved protocol legend; a `critical` API value receives a neutral reserved-protocol notice.
- All observation and investigation times are shown in UTC. Missing readings say **Sem registro**; zero remains zero. Follow-ups retain the API reason, target and optional deadline.

## Loading, errors and empty storage

The client validates the rendered response fields, finite values, metric units, timestamps with a timezone, known statuses and observation sources. Malformed JSON, invalid payloads, HTTP errors and network failures show a Portuguese error and retry action. There is no production fixture fallback. Requests time out after ten seconds.

During refresh and after refresh failure the last confirmed response remains visible with an explicit potentially-outdated warning; its successful-retrieval time is preserved. Only a successful newer request replaces it. Navigating away aborts the active request and prevents further state updates. Empty crew, absent measurements, no pending follow-ups and no investigation each have explicit copy.

The API now adds `source` to metric snapshots and `latest_metrics` to the environment, retaining the existing flat fields. Values, origin and per-metric observation time come from the same `quality=ok` record (latest `measured_at`, highest ID for a tie). A newer suspect record cannot replace them. Old API responses without provenance show **Source not reported** and an unknown individual time. No new persistence tables or migrations are introduced.

## Reproduce locally

Use the README dependency setup. Start the API on port 8000 and the Vite server using `npm --prefix frontend run dev`; its existing `/api` proxy forwards requests. Open the dashboard route.

1. With a fresh database, verify the explicit empty states and absent investigation.
2. From `backend/`, run `python -m app.seed` against that database. Refresh the page: the synthetic crew and observations appear, with the new-measurements notice and no invented assessment.
3. Execute the explicit investigation using the API docs (`POST /api/investigations/run`, body `{"scope":"crew"}`), then refresh. The persisted statuses, alerts, global investigation time and pending follow-ups become visible.
4. Register another compatible observation and refresh. The new-data notice appears while the previous persisted assessment remains.
5. Stop the API and refresh: the last confirmed data remains labelled as potentially outdated. Restart the API and retry to recover. An initial failed load must display no example crew.

Use a separate `AKM_DB_PATH` for experiments if existing local data must be preserved. NASA context URLs are references, not a source of live crew readings or clinical advice.

## Verification

```sh
python scripts/check.py
npm --prefix frontend run test:dashboard
npm --prefix frontend run test:navigation
npm --prefix frontend run test:wireframe
npm --prefix frontend run build
```

The dashboard suite compiles the actual client/controller/components and uses React server rendering. It verifies GET-only behavior, validation, provenance, zero/absent readings, persisted-only analysis, NASA URL safety, loading/failure/recovery, timeout, abort and out-of-order responses. Backend tests cover real HTTP projection of per-metric provenance, suspect samples, tie-breaking and unchanged investigation counts.

Automated checks passed at delivery. Browser control initially timed out; the native-app fallback then opened a local demonstration tab, but stopped because it could not determine the browser URL with enough confidence to enforce its policy. No dashboard browser validation was completed. Responsive layout, keyboard interaction and screen-reader behavior still need an interactive pass; server-rendered markup assertions are not browser validation.
