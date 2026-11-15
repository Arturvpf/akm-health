# AKM-20 — persisted investigations and follow-up completion

The API now connects the AKM-21/22 detectors and AKM-23 prioritization to the four existing SQLite tables. It persists the original response, evidence, explanations, input snapshot and rule settings. AKM-24 labels describe persisted statuses on the dashboard. No schema migration or TypeScript contract change is needed.

## HTTP workflow

Run the API as described in the README. The canonical architecture remains [the Notion specification](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4).

1. `POST /api/investigations/run` with `{"scope":"crew"}` or `{"scope":"individual","astronaut_id":"A1"}` returns HTTP 200 and the canonical `InvestigationResult`.
2. Repeat with unchanged inputs: HTTP 200, same ID and creation time, `reused:true`. The stored response itself always has `reused:false`.
3. `GET /api/investigations/{id}` returns the original immutable response. Completing a follow-up does not rewrite its historical analysis; use `GET /api/followups` for current tracking state.
4. Register a usable observation with `POST /api/measurements`. This flags the dashboard for an explicit new analysis; it does not invoke the motor automatically.
5. `PATCH /api/followups/{id}` with `{"status":"completed","measurement_id":123}` completes the persisted check. Replace 123 with the ID returned by the measurement endpoint.
6. Run the investigation explicitly again to evaluate the new input.

Unknown investigation, follow-up, measurement or individual profile returns 404. Invalid bodies, positive SQLite ID overflow and incompatible evidence return 422. A completed follow-up repeated with the same measurement returns the same HTTP 200 representation, including its original `completed_at`; a different measurement returns 409. A storage failure returns a generic 500 and rolls back the entire write. Logs record the exception class, without database parameters or measurements. Invalid stored responses return a controlled 500 from the recovery endpoint.

Completion requires the same metric, astronaut (or null habitat target), canonical zone and `quality:"ok"`. The measurement must already exist, have `recorded_at > followup.created_at`, and have neither registration nor observation in the future. The canonical v2.0 completion criterion is registration time: an older observation registered after the request can satisfy it. No additional observation-time cutoff is inferred.

## Stable fingerprint and transaction

The SHA-256 hash uses canonical sorted JSON containing:

- Scope and subject, individual baselines or the crew profile/baseline list.
- All persisted measurements visible at analysis time for the scope (subject plus habitat for individual scope; all subjects for crew), including ID, value, unit, timestamps, source, quality and zone. Measurements are sorted by observation time and ID. Suspect rows remain in the audit, while rules exclude them from usable evidence.
- Rule version, thresholds, time window, environmental tolerance, explicit resource availability/effort, optional validated protocol and prioritization policy version. Resource order is normalized; protocol preference order is meaningful.

The invocation clock is recorded in the audit but excluded from the fingerprint. Repeating identical inputs retrieves the original historical assessment even after its window ages; it is not a fresh assessment of the current time. Its creation time and observed window remain visible. New data, baseline, rule/configuration or resource changes produce another fingerprint. New registrations become visible only when their server `recorded_at` is at or before the run. The input list conservatively includes rows the detector may discard, making input and quality changes traceable.

`BEGIN IMMEDIATE` acquires the SQLite writer lock before snapshot reads, deduplication and pending-target lookup. The investigation, response envelope and optional follow-up commit together. `investigations.input_fingerprint` retains its UNIQUE constraint; a unique collision rolls back and retrieves the existing result. Concurrent runs cannot create duplicate pending targets. Existing pending checks with the same kind and subject are reused globally, retaining their original creation time, reason and creator investigation. Each new analysis stores its own selection explanation and reference to that check.

`result_json` contains an internal envelope (`schema_version:1`) with `response` and `audit`. The latter stores the complete snapshot, settings, detector output and selection scoring. The HTTP response exposes only canonical fields. Existing flat canonical responses remain readable. Empty pre-implementation placeholder payloads have no alert to project on the dashboard.

## Configuration and uncertainty

`backend/app/investigation_config.json` explicitly declares the **simulated** resources for A1–A4 and the habitat. Set `AKM_INVESTIGATION_CONFIG` to another JSON path before startup to change availability, effort, rule settings or an approved protocol; invalid or missing required configuration fails startup. Profiles absent from the resource catalog are not presumed to have a measurement resource. No protocol is authorized by default.

Empty storage or incomplete coverage yields `insufficient_data` with the detector's limitation and, where feasible, a data-collection check. An empty crew has no invented subject. When all relevant resources are unavailable, `next_check` and `followup_id` are null and findings explain the missing alternative. Environmental hypotheses retain `certainty:"unconfirmed"`; `guidance` stays empty, `demo_only` stays true, and the demo never emits automatic `critical` status or a medical diagnosis.

The dashboard reads stored analyses in one SQLite read transaction and never runs the motor. The newest individual assessment or crew member assessment supplies each profile's status; a collective attention status does not make every astronaut attention. Individual alerts superseded by a newer crew assessment are omitted, including when creation timestamps tie (higher ID wins). The latest collective alert remains a separate collective assessment until another crew run supersedes it. Its alerts use AKM-24 labels.

Freshness compares usable measurement IDs against the newest relevant audit separately for each astronaut and the habitat, catching equal timestamps and observations committed after the snapshot. An individual run covers its own subject and habitat inputs, never another astronaut's readings. Coverage can combine different subjects' latest audits; it does not imply a fresh collective assessment. `last_investigation_at` includes valid individual runs. Legacy crew records without an audit retain the prior `recorded_at` comparison, while invalid individual placeholders do not claim coverage or update the timestamp. Latest readings may therefore be newer than the frozen assessment; the freshness flag makes this visible.

## Reproduce and verify

With development dependencies installed and the virtual environment active:

```sh
python scripts/demo_investigation_flow.py
python -m pytest backend/tests/test_investigations.py -q
python scripts/check.py
```

The demo uses a temporary database and a clock fixed to the synthetic scenario; it restores process configuration and removes the database afterwards. It executes the HTTP run/replay/recovery/completion/reanalysis flow, asserting stable IDs, unchanged replay completion and a new investigation for new input. The synthetic recheck is inserted with explicit registration time to keep the demo reproducible independently of today's date. Production endpoints always use the server clock.

Integration tests cover canonical recovery and audit, fingerprint inputs, empty and unavailable states, atomic rollback, unique-collision recovery, restart persistence, concurrent run/completion, invalid IDs and incompatible evidence, immutable history and dashboard freshness. The fixed seed alone will age outside the experimental 48-hour window in a normal running server; use fresh synthetic observations to demonstrate a current assessment.
