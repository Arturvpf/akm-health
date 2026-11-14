# AKM Health — AKM-03 | Technical contracts reviewed, v2.0

Canonical architecture: https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4

## Four tables; no extra NASA data table

- astronauts: id, name, role, baseline_sleep_hours (>0).
- measurements: id, astronaut_id, kind, value, unit, measurement_zone, measured_at, recorded_at, source, quality.
- investigations: id, scope, astronaut_id, status, created_at, rules_version, input_fingerprint UNIQUE, result_json.
- followups: id, investigation_id, astronaut_id, kind, reason, status, due_at, created_at, completed_at, measurement_id.

A completed follow-up MUST reference an actual later compatible measurement. Fingerprint is SHA-256 of stable sorted inputs + scope/subject/rules_version. On duplicate return existing investigation (reused=true) and do not recreate follow-ups. Persist investigation and follow-up atomically.

## Canonical ten endpoints

1. GET /api/health
2. GET /api/astronauts
3. GET /api/measurements?astronaut_id=...&kind=...&from=...&to=...
4. POST /api/measurements
5. GET /api/dashboard
6. POST /api/investigations/run
7. GET /api/investigations/{id}
8. GET /api/followups
9. PATCH /api/followups/{id}
10. GET /api/nasa/references

All timestamps UTC with Z. Invalid payload 422, absent resource 404, state conflict 409. For Python query parameter "from", use alias. POST creates measurement with measurement_zone derived from kind and recorded_at set by server. Investigation POST accepts scope crew or individual, returning findings, evidence, hypotheses, next_check, followup_id, reused, demo_only. PATCH follow-up requires {"status":"completed","measurement_id":123}; server validates same kind, astronaut/zone, quality ok and recording after followup creation.

Measurement values must be finite JSON numbers. Booleans and numeric strings return 422. For habitat measurements, clients may omit `astronaut_id` or send `null`. Crew measurements require an astronaut ID.

## Dashboard and data provenance

Dashboard includes mission, astronauts, environment, alerts, pending_followups, last_investigation_at and has_unanalyzed_measurements. Empty dataset with no investigation => false and insufficient_data; new measurement after last collective investigation => true. GET dashboard must never run rules implicitly.

NASA HRP risks and planetary fact sheet are contextual research, not astronaut measurements. NASA EDA/OSDR cabin history and MEDA/PDS Mars exterior history require verified actual file, units, instrument, period, URL and rights before historical_series is populated. If not imported, historical_data_status=not_imported.

No clinical diagnosis, use synthetic heuristics and mark all demonstration data. The critical/red state may be displayed as legend but must not be triggered using unvalidated rules.

## Implemented vs pending

The foundation provides Pydantic and TypeScript contracts, the SQLModel schema, the synthetic seed, `GET /api/health` and `GET /api/nasa/references`. The latter returns the HRP catalog with an empty historical series. The measurement validation route is for tests. Measurement persistence over HTTP, other business routes, the investigation engine, real dataset import and the React application remain pending.


## AKM-06 integrated — clinical and data provenance boundary

See [AKM-06 protocol](./akm-06-measurement-protocol.md). The five metrics are sleep_hours (estimated actual sleep duration, h), heart_rate_bpm (point BPM, ideally rest), mood_score (ordinal non-validated self report 1..5), co2_ppm (internal habitat) and cabin_temp_c (internal cabin air, C). Their recommended demo cadences are UX choices, not NASA operational protocols.

Crew and dashboard timestamps require an explicit timezone and are normalized to UTC, including MetricSnapshot, HabitatSnapshot and last_investigation_at. NASA reference timestamps remain in their source-native time base; Mars sol must not be converted to Earth UTC without reference metadata. NASA history requires HTTPS source URL plus observed_at or mars_sol, and this schema is not proof of authentic provenance.

The environmental snapshot measured_at field describes the most recent available environmental measurement, not proof CO2 and temperature were sampled simultaneously. Missing data is absent (not zero); quality=ok is not a statement of health. Clinical thresholds, red alerts, diagnosis and equipment certifications remain outside the MVP. The pending business routes are tracked in AKM-18/19/20/39.
