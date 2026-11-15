# AKM Health

Experimental NASA Space Apps Challenge prototype: record observations for a fictional crew, inspect history, explicitly investigate patterns and verify a finding with a new observation. ODYSSEY-26, its crew and mission readings are fictional. This is not a medical device, diagnosis, prescription, clinical validation or live astronaut monitoring.

## Start locally

Prerequisites: Git, Python 3.13+ and Node.js 22 (22.12+). The python, node and npm commands must resolve on PATH. Internet is needed for initial package installation. Python dependencies use version ranges, not a complete lock file. See the [actual verification environment](docs/akm-31-verification.md).

```sh
git clone https://github.com/Arturvpf/akm-health.git
cd akm-health
python -m venv .venv
```

**Windows PowerShell**, repository root. Using the environment interpreter directly avoids changing execution policy:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
$env:AKM_DB_PATH = Join-Path (Get-Location) 'work/demo.db'
Push-Location backend
..\.venv\Scripts\python.exe -m app.seed
Pop-Location
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

**macOS/Linux (Bash/Zsh)**, repository root:

```sh
source .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
export AKM_DB_PATH="$PWD/work/demo.db"
(cd backend && python -m app.seed)
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Keep the API running. In a **second terminal**, at the repository root:

```sh
npm --prefix frontend run dev -- --port 5173 --strictPort
```

Open [AKM Health](http://127.0.0.1:5173/#/dashboard). All four mission screens use the API. Route identifiers remain dashboard, registrar, historico, investigacao. Current main has Portuguese labels; a separate English-interface PR may change labels without changing route identifiers.

Check [health](http://127.0.0.1:8000/api/health), [OpenAPI JSON](http://127.0.0.1:8000/openapi.json) and [NASA references](http://127.0.0.1:8000/api/nasa/references). Health returns status=ok and storage=sqlite_reachable. [Swagger UI](http://127.0.0.1:8000/docs) loads CDN assets and may not render offline.

Use the same **absolute AKM_DB_PATH** for seed and API. The path above isolates demo data; the default is backend/akm.db. Seed is idempotent, not a reset. Back up existing data before changing it. No destructive reset is required.

## Reproduce the demonstration

No running server is needed for this isolated HTTP demonstration:

```powershell
# Windows, repository root
.\.venv\Scripts\python.exe scripts/demo_investigation_flow.py
```

```sh
# Bash/Zsh, activated virtual environment
python scripts/demo_investigation_flow.py
```

It uses FastAPI TestClient, temporary SQLite and a frozen demo clock. It checks explicit investigation, reuse, recovery, completion with compatible measurement evidence and explicit reanalysis. Expect repeat_reused=true, new_data_requires_explicit_run=true and a new investigation ID. It restores its environment and does not modify the normal demo database. The recheck is inserted through SQLModel; this is not a browser or POST-registration acceptance test.

**Time matters:** seed dates are 13–14 November 2026, while the normal API uses the current clock. The default 48-hour window can exclude older samples. Insufficient data is valid; do not promise a collective/yellow result from an aged seed. See the [interactive demo walkthrough](docs/demo-script.md).

## Data, NASA and limitations

- Mission records are manual or synthetic, stored with origin, quality, unit and UTC time. Missing data is not zero; quality=ok does not mean clinically safe.
- The app includes a **NASA OSDR EDA Rodent Research-1 ISS environmental telemetry excerpt**, 1 October 2014: 288 timestamps / 864 values. Local JSON is displayed separately in Dashboard and Investigation, never as current mission telemetry or detector input.
- Three NASA HRP entries provide research context, not measurements. Mars gravity is a static reference, not a measured cabin value.
- [Exact sources, hashes, transformations, reuse terms and import](docs/data-sources.md), [third-party notices](docs/third-party-notices.md), [AI assistance disclosure](docs/ai-usage.md).
- The engine is deterministic Python, not an LLM service. Only POST /api/investigations/run executes investigation; GET does not run rules. Recording does not automatically complete follow-ups or reclassify saved results.
- Demo thresholds are software parameters, not clinical thresholds. No automatic critical medical alarm or proven causal relation is produced. Missing/suspect evidence and uncertainty remain explicit.
- Local offline use requires installed packages and local NASA files. This guide does not claim mobile PWA persistence/sync, connected sensors, authentication or production deployment. Keep loopback bindings: there is no authentication layer.

## Check the checkout

Windows commands, repository root. On Bash/Zsh replace the Python prefix with python after activation:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
node --test frontend/scripts/test-dashboard.cjs frontend/scripts/test-history.cjs frontend/scripts/test-investigation-api.cjs frontend/scripts/test-registration.cjs frontend/scripts/test-wireframe.cjs
npm --prefix frontend run test:navigation
npm --prefix frontend run build
```

scripts/check.py covers Ruff, backend tests and TypeScript, **not** the complete frontend/browser suite. Registration integration expects the repository .venv; PYTHON may select another interpreter. The [verification record](docs/akm-31-verification.md) separates executed commands from remaining browser, accessibility and scientific review. Automated success does not mean visual approval, merge or clinical validation.

## Architecture and contributing

[Executable architecture/API](docs/architecture-backend.md) describes the four tables, transactions, UTC, idempotency and configuration. Keep Python schemas and TypeScript contracts aligned.

| Path | Responsibility |
| --- | --- |
| backend/app/ | FastAPI, SQLite, rules, prioritization, guidance and local NASA loader |
| backend/data/nasa/ | Credited HRP catalog and read-only RR-1 excerpt |
| frontend/src/ | React/TypeScript/Vite interface and API clients |
| scripts/ | Checks, isolated demos and audited-CSV importer |
| docs/ | Contracts, sources, feature records and verification |

Start a task branch from main. Consult the [Notion architecture](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) and task before changing contracts; compare plans with code and OpenAPI. Review PRs and record tests/limitations before closing tasks. Do not add the assistant as commit coauthor.

[Measurement protocol](docs/akm-06-measurement-protocol.md) · [Safety matrix](docs/akm-08-alert-safety.md) · [Guidance](docs/akm-09-guidance-library.md) · [Scientific sources](docs/scientific-sources.md) · [NASA feature evidence](docs/akm-39-nasa-references.md)

## Troubleshooting

- **No crew:** seed the same absolute database path used by the API. An unseeded database legitimately has no profiles.
- **API errors:** check health on port 8000. Vite proxies /api to 127.0.0.1:8000; a different API port requires updating the proxy. API and frontend are separate processes.
- **Port occupied:** stop your own previous server or use another port and update the proxy. Do not terminate unrelated processes.
- **No collective pattern:** check time, coverage, quality and the 48-hour window. Use the deterministic script for the fixed scenario; do not change medical meanings to force a result.
- **Uncertain POST:** check History before retrying. Measurements have no server idempotency key; local duplicate-click protection does not deduplicate concurrent writers.
- **Schema error:** check AKM_DB_PATH and [database notes](docs/database.md). Back up data; do not delete the database as a first response.
- **NASA unavailable:** missing/invalid history yields not_imported without fabricated values; a broken HRP catalog yields 503. Restore trusted artifacts using the [data guide](docs/data-sources.md).
