# Executable architecture — canonical v2 contract

This document maps the canonical [Notion v2.0/v2.1 contract](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) to implemented files. The application is a local modular monolith, with separate frontend and API development processes; no microservice, external queue or paid LLM is required.

~~~mermaid
flowchart LR
  Browser[React / TypeScript / Vite] -->|JSON /api| API[FastAPI routes and Pydantic schemas]
  API -->|SQLModel transactions| DB[(SQLite: four tables)]
  API -->|explicit investigation POST| Rules[Pure detectors / next check / routine]
  Rules --> API
  API --> NASA[Read-only local HRP and RR-1 JSON]
~~~

## Run and configuration

Follow the [README](../README.md) for installation, seeding and two-terminal startup. Vite's development proxy sends /api to http://127.0.0.1:8000. The production build in frontend/dist is static assets; opening index.html as a file does not provide an API/proxy. Production hosting and authentication are outside this local guide.

| Configuration | Consumer | Behavior |
| --- | --- | --- |
| AKM_DB_PATH | backend/app/db.py | SQLite path; default backend/akm.db, absolute path recommended |
| AKM_INVESTIGATION_CONFIG | backend/app/investigations.py | Explicit investigation/resource/routine settings; default investigation_config.json |
| backend/app/mission_environment.json | dashboard | Fictional ODYSSEY-26 / Mars context |
| backend/data/nasa/*.json | nasa_reference.py | Read-only catalog and historical excerpt, not SQLite seed |

Changing investigation settings requires restarting the API. Optional routine_demo_config.json enables demonstration collection windows when selected before startup. The default configuration does not enable periodic background scheduling. See [routine details](akm-25-adaptive-routine.md).

## Persistence and contracts

The SQLite schema version is 1. Startup creates/checks the schema and enables foreign keys. An unsupported or unversioned conflicting schema fails explicitly; it is not silently deleted or reset. See [migration and backup notes](database.md).

| Table | Responsibility |
| --- | --- |
| astronauts | Four fictional profiles and positive synthetic sleep baseline |
| measurements | Mission observations, target, kind, unit, origin, quality, measured_at and recorded_at |
| investigations | Persisted immutable result/audit, scope, rule version and unique input fingerprint |
| followups | Pending/completed verification and optional compatible measurement_id evidence |

backend/app/schemas.py and frontend/src/types.ts define aligned HTTP contracts. measurement_zone and recorded_at are derived on the server, not writable form fields. Human kinds require a known astronaut; habitat kinds require null. Values must be finite with kind-specific technical domains. Aware timestamps normalize to UTC; no time zone is inferred for an ambiguous input. Data origin and technical quality are distinct from investigation classification.

| Method | Endpoint | Effect |
| --- | --- | --- |
| GET | /api/health | Check SQLite reachability |
| GET | /api/astronauts | Read profiles |
| GET | /api/measurements | Read history; kind, astronaut_id, from/to, limit/offset |
| POST | /api/measurements | Persist one valid mission observation; 201 receipt |
| GET | /api/dashboard | Read snapshot and persisted analysis freshness |
| POST | /api/investigations/run | Explicitly compute or reuse and persist investigation |
| GET | /api/investigations/{id} | Recover saved result |
| GET | /api/followups | Read agenda, optionally target/status filtered |
| PATCH | /api/followups/{id} | Complete with compatible persisted measurement evidence |
| GET | /api/nasa/references | Read credited local NASA reference/history |

/docs and /openapi.json expose real API documentation. The extra POST /api/_contract/validate-measurement is a testing-only validation route, not an eleventh business feature. Errors follow FastAPI detail: 422 invalid input/transition, 404 missing resource, 409 conflicting completion; NASA catalog unavailability returns 503. Do not copy example IDs as actual responses.

## Explicit investigation and atomicity

1. A measurement POST persists a receipt; it does not run rules or complete a check.
2. GET dashboard/history/agenda never executes investigation. Freshness indicates valid new inputs not covered by the relevant persisted analysis; a GET failure is not a clinical result.
3. POST investigation validates crew vs individual scope, takes an input snapshot and computes a stable SHA-256 fingerprint incorporating scope/target, rule version, relevant readings/baselines and configuration. With routine enabled, its collection window also matters.
4. An existing fingerprint returns its historical result with reused=true. Otherwise pure detector/prioritization functions return evidence, limitations, hypotheses and a next check; the transaction persists investigation plus creates/reuses equivalent pending follow-up. SQLite locking/unique fingerprint handle collisions. A replay preserves the original analysis clock/window; see [persistence details](akm-20-investigation-persistence.md).
5. Completion requires a persisted compatible kind/target/zone, quality ok, recorded after the request, and a permitted time. Same measurement replay is idempotent; a different measurement on an already completed check conflicts. The server creates completed_at.
6. A new observation permits a subsequent explicit reanalysis. No automatic causal conclusion or background job is implied.

Measurement creation has **no server idempotency key**. The form prevents concurrent local clicks but cannot deduplicate separate writers or a user retry after an uncertain response.

## Rule and source boundaries

rules.py detects individual/collective sleep patterns; next_check.py prioritizes feasible checks, routine.py plans configured demo windows, guidance.py explains limitations and references. The default sleep window is 48 hours, using distinct UTC dates as an approximation of sleep periods. The 80% baseline threshold is synthetic software configuration, not a validated clinical threshold. Critical is reserved and not automatically triggered.

NASA HRP references and RR-1 archive are served by nasa_reference.py without mission database access and are not rule inputs. See [provenance and failure behavior](data-sources.md). Real measurements, medical approval, production security, autonomous offline synchronization and submission acceptance are not established by this architecture.

## Verification boundaries

[AKM-31 verification](akm-31-verification.md) records executed commands, not a blanket certification. [AKM-29](akm-29-investigation-engine-validation.md) covers rule tests. Full browser/assistive-technology acceptance and Research/Safety approval are separate work. Do not infer merge or deployment from a passing build.
