# AKM Health

AKM Health is an experimental health-monitoring demo for the NASA Space Apps Challenge. It uses a fictional crew and simulated habitat readings to demonstrate how to record measurements, investigate patterns, and verify a finding with a new observation.

## Run the local foundation

Use Python 3.13 and Node.js 22. Run these commands from the repository root.

```sh
python -m venv .venv
```

Activate the environment using the command for your shell.

```powershell
.\.venv\Scripts\Activate.ps1
```

```sh
# Bash / Zsh
source .venv/bin/activate
```

Install dependencies and start the API.

```sh
python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

- [Health check](http://127.0.0.1:8000/api/health) returns HTTP 200 with `{"status":"ok","storage":"sqlite_reachable"}`.
- [Interactive API docs](http://127.0.0.1:8000/docs) and the [OpenAPI schema](http://127.0.0.1:8000/openapi.json) describe the running foundation.
- [Dashboard API](http://127.0.0.1:8000/api/dashboard) shows the latest usable readings and whether new data awaits investigation. See the [measurement API notes](docs/contracts-v2-review.md#registering-a-measurement) for a request example.
- [AKM-19 read APIs](docs/akm-19-read-apis.md) document profile, history and agenda queries, inclusive UTC filters, pagination, habitat readings and reproducible examples.
- [AKM-20 investigation persistence](docs/akm-20-investigation-persistence.md) documents run/recovery/completion endpoints, idempotency, audit and the isolated HTTP demo (`python scripts/demo_investigation_flow.py`).
- [AKM-25 adaptive routine](docs/akm-25-adaptive-routine.md) documents explicit collection windows, the prioritized persisted agenda and an isolated HTTP demo (`python scripts/demo_adaptive_routine.py`).
- [AKM-21 individual detector](docs/akm-21-individual-detector.md) documents the pure sleep-change rule, evidence selection, limitations and an in-memory demo (`python scripts/demo_individual_detection.py`).
- [AKM-22 collective detector](docs/akm-22-collective-detector.md) documents comparable crew periods and uncertain environmental coincidences (`python scripts/demo_collective_detection.py`).
- The API uses `backend/akm.db` by default. Set `AKM_DB_PATH` to use a different SQLite file. Startup creates or migrates the local database.
- Run `npm --prefix frontend run dev` to open the React application. The [AKM-13 crew dashboard](docs/akm-13-crew-dashboard.md) reads the local API; the [AKM-14 registration form](docs/akm-14-measurement-forms.md) saves the five supported measurements through the API. See the [AKM-10/12 walkthrough](docs/akm-10-12-wireframes-and-shell.md) for the original prototype and build commands.
- The [AKM-11 design system](docs/akm-11-accessible-design-system.md) documents shared React components, accessible status and provenance labels, and how to exercise the simulated interface states.

After installing the dependencies, run the local checks with the virtual environment active.

```sh
python scripts/check.py
```

The command runs Ruff, Pytest and the TypeScript type check. Run it before opening a PR and include its result in the PR description.

[AKM-29 investigation engine validation](docs/akm-29-investigation-engine-validation.md) links the rules and acceptance cases to automated tests and shows how to reproduce the synthetic HTTP flow.

The API, tests, and type checking run locally after dependency installation. The interactive Swagger UI currently loads assets from a CDN. The health endpoint and JSON OpenAPI schema are served locally.

To apply the SQLite schema separately, run `python -m app.db` with `backend/` as the working directory. See the [database notes](docs/database.md) for schema versioning and cases that require review.

To load the simulated ODYSSEY-26 profiles and readings, run `python -m app.seed` from `backend/`. See the [scenario and data dictionary](docs/synthetic-data.md) for the optional CO₂ recheck and the expected gaps in the sample.

## Repository layout and contribution

| Path | Responsibility |
| --- | --- |
| `backend/app/` | FastAPI application, SQLite connectivity and Pydantic contracts |
| `backend/tests/` | Backend smoke and contract tests |
| `frontend/src/` | API-connected dashboard and guided registration, history, navigation shell, simulated previews, and shared TypeScript contracts |
| `docs/` | Decisions, investigation behavior, evidence and scientific references |
| `scripts/check.py` | Local backend lint/tests and frontend type checks |

Start a topic branch from `main`. Group commits by deliverable and open a PR with the AKM task IDs, acceptance criteria, commands run and any gaps. Ask the relevant frontend, backend or research owner to review contract or scientific changes before merging. Keep Pydantic and TypeScript aligned, follow the canonical HTTP and UTC conventions, and update the affected contract tests and examples together.

[Canonical architecture and API](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [Contract review](docs/contracts-v2-review.md) · [Investigation flow](docs/akm-04-investigation-flow.md) · [NASA scientific sources and hypothesis matrix](docs/scientific-sources.md)

[EP-01 foundation and architecture evidence](docs/ep-01-foundation-and-architecture.md) covers the local verification procedure, shared contracts, and available API operations.

[Alert and safety criteria](docs/akm-08-alert-safety.md) · [Educational guidance and measurement copy](docs/akm-09-guidance-library.md)

[EP-05 scientific foundation and safety evidence, including NASA RR-1 provenance](docs/ep-05-scientific-foundation-and-safety.md)

[AKM-39 NASA references](docs/akm-39-nasa-references.md) credits the NASA OSDR Environmental Data Application for the RR-1 historical excerpt and documents the source, access date, reuse terms and local reproduction. Dashboard and Investigation show the archive in a separate NASA reference section.

[AKM-24 alert presentation](docs/akm-24-alert-presentation.md) describes status labels, icons, colors and the reserved red legend (`python scripts/demo_alerts.py`).

[AKM-23 next check](docs/akm-23-next-check.md) documents explainable scoring, resource availability, protocol priority and feasible alternatives (`python scripts/demo_next_check.py`).

[AKM-26 investigation explanation](docs/akm-26-investigation-explanation.md) documents the API fields for coverage, reference links, uncertainty and human review, with a reproducible synthetic example.
