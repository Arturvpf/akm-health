# AKM Health

AKM Health is an experimental health-monitoring demo for the NASA Space Apps Challenge. It uses a fictional crew and simulated habitat readings to demonstrate how to record measurements, investigate patterns, and verify a finding with a new observation.

## Run the local foundation

Use Python 3.13 and Node.js 22, the versions used in CI. Run these commands from the repository root.

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
- The API uses `backend/akm.db` by default. Set `AKM_DB_PATH` to use a different SQLite file. Startup creates or migrates the local database. The TypeScript project currently contains shared contracts. Browser navigation and integration are tracked in AKM-12 through AKM-16.

Run the same checks as CI from the root in a terminal with the virtual environment active.

```sh
python -m ruff check backend
python -m pytest -q backend
npm --prefix frontend run typecheck
```

The API, tests, and type checking run locally after dependency installation. The interactive Swagger UI currently loads assets from a CDN. The health endpoint and JSON OpenAPI schema are served locally.

To apply the SQLite schema separately, run `python -m app.db` with `backend/` as the working directory. See the [database notes](docs/database.md) for schema versioning and cases that require review.

To load the simulated ODYSSEY-26 profiles and readings, run `python -m app.seed` from `backend/`. See the [scenario and data dictionary](docs/synthetic-data.md) for the optional CO₂ recheck and the expected gaps in the sample.

## Repository layout and contribution

| Path | Responsibility |
| --- | --- |
| `backend/app/` | FastAPI application, SQLite connectivity and Pydantic contracts |
| `backend/tests/` | Backend smoke and contract tests |
| `frontend/src/` | TypeScript contracts and location for the future React application |
| `docs/` | Decisions, investigation behavior, evidence and scientific references |
| `.github/workflows/` | Backend lint/tests and frontend type checks for pull requests |

Start a topic branch from `main`. Group commits by deliverable and open a PR with the AKM task IDs, acceptance criteria, commands run and any gaps. Ask the relevant frontend, backend or research owner to review contract or scientific changes before merging. Keep Pydantic and TypeScript aligned, follow the canonical HTTP and UTC conventions, and update the affected contract tests and examples together.

[Canonical architecture and API](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [Contract review](docs/contracts-v2-review.md) · [Investigation flow](docs/akm-04-investigation-flow.md) · [NASA scientific sources and hypothesis matrix](docs/scientific-sources.md)
