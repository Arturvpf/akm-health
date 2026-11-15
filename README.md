# AKM Health — Space Health Monitoring

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

Open [AKM Health](http://127.0.0.1:5173/#/dashboard). All four mission screens use the API. Route identifiers are `dashboard`, `register`, `history` and `investigation` (plus `scenarios`, `environments`, `body` and `self-care`); earlier Portuguese hashes such as `#/registrar` redirect to them. The interface labels and the investigation narratives returned by the API are in English.

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

**Time matters:** the seed follows the clock. `python -m app.seed` (run from `backend/`) shifts the synthetic 13–14 November 2026 observations so the latest one lands about two minutes before "now", keeping them inside the detector's default 48-hour window; a new database plus the seed therefore shows the collective attention scenario (A1, A2, A3) immediately. `--fixed-dates` reproduces the original 13–14 November 2026 timestamps (they age out of the 48-hour window, so expect `insufficient_data` later). The seed is idempotent: to start over, use a new database file (a new `AKM_DB_PATH`). Details are in the [interactive demo walkthrough](docs/demo-script.md).

## Data, NASA and limitations

- Mission records are manual or synthetic, stored with origin, quality, unit and UTC time. Missing data is not zero; quality=ok does not mean clinically safe.
- The app includes a **NASA OSDR EDA Rodent Research-1 ISS environmental telemetry excerpt**, 1 October 2014: 288 timestamps / 864 values. Local JSON is displayed separately in Dashboard and Investigation, never as current mission telemetry or detector input.
- Three NASA HRP entries provide research context, not measurements. Mars gravity is a static reference, not a measured cabin value.
- [Exact sources, hashes, transformations, reuse terms and import](docs/data-sources.md), [third-party notices](docs/third-party-notices.md), [AI assistance disclosure](docs/ai-usage.md).
- The engine is deterministic Python, not an LLM service. Only POST /api/investigations/run executes investigation; GET does not run rules. Recording does not automatically complete follow-ups or reclassify saved results.
- Demo thresholds are software parameters, not clinical thresholds. No automatic critical medical alarm or proven causal relation is produced. Missing/suspect evidence and uncertainty remain explicit.
- The offline shell (service worker) is registered only in production builds: use `npm --prefix frontend run build` and `npm --prefix frontend run preview` (or the deployed site) to demo offline; `npm run dev` has no offline shell. The first visit precaches the whole app shell and fonts, so a reload offline works right after it.
- Local offline use requires installed packages and local NASA files. New measurements can be queued offline in the browser and synced later (AKM-33); investigations still need the API. This guide does not claim a full mobile offline app, connected sensors, authentication or production deployment. Keep loopback bindings: there is no authentication layer.

## Check the checkout

The canonical integration and accessibility matrix (T01–T15) and its browser suite are documented in [AKM-30 acceptance](docs/akm-30-acceptance.md); the suite uses a disposable fixture and a separately installed browser.

Windows commands, repository root. On Bash/Zsh replace the Python prefix with python after activation:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
node --test frontend/scripts/test-dashboard.cjs frontend/scripts/test-nasa-panels.cjs frontend/scripts/test-history.cjs frontend/scripts/test-investigation-api.cjs frontend/scripts/test-registration.cjs
npm --prefix frontend run test:navigation
npm --prefix frontend run build
```

scripts/check.py covers Ruff, backend tests and TypeScript, **not** the complete frontend/browser suite. Registration integration expects the repository .venv; PYTHON may select another interpreter. The [verification record](docs/akm-31-verification.md) separates executed commands from remaining browser, accessibility and scientific review. Automated success does not mean visual approval, merge or clinical validation.

## Space Apps 2026 submission and acceptance

- [Requirements-to-evidence audit](docs/space-apps-2026-final-audit.md) distinguishes verified functionality from pending scientific sign-off and official submission; its status update covers PRs #33 and #34.
- [AKM-30 acceptance](docs/akm-30-acceptance.md) records T01–T15; an English screen-reader walkthrough and a visual focus check of date/time inputs still need a person. The AKM-32 submission task (tracked in the team's internal Notion workspace, which is in Portuguese and not part of the submission) must be completed with evidence; a merged PR or passing unit tests alone are not the final event submission.
- The GitHub Actions workflow in `.github/workflows/ci.yml` is manual only (`workflow_dispatch`); it does not run on pull requests or pushes.
- The 2026 NASA Space Apps submission deadline is November 15 at 11:59 PM in the applicable event's local time: [official event page](https://www.spaceappschallenge.org/2026/). Check the team's Project tab and any earlier local deadline. Do not claim the project has been submitted without confirmation.
- The challenge's complete Resources tab and exact project-form requirements still require verification in the signed-in Space Apps platform. The credited NASA RR-1 historical excerpt is an input for contextual visualization, not a real clinical astronaut dataset or a medical threshold.

## Architecture and contributing

[Executable architecture/API](docs/architecture-backend.md) describes the four tables, transactions, UTC, idempotency and configuration. Keep Python schemas and TypeScript contracts aligned.

| Path | Responsibility |
| --- | --- |
| backend/app/ | FastAPI, SQLite, rules, prioritization, guidance and local NASA loader |
| backend/data/nasa/ | Credited HRP catalog and read-only RR-1 excerpt |
| frontend/src/ | React/TypeScript/Vite interface and API clients |
| scripts/ | Checks, isolated demos and audited-CSV importer |
| docs/ | Contracts, sources, feature records and verification (English) |
| docs/internal-pt/ | Internal working records kept in Portuguese; not part of the submission documentation |

Start a task branch from main. Consult the [executable architecture](docs/architecture-backend.md) and the task description before changing contracts; compare plans with code and OpenAPI. Review PRs and record tests/limitations before closing tasks. Do not add the assistant as commit coauthor.

[Measurement protocol](docs/akm-06-measurement-protocol.md) · [Safety matrix](docs/akm-08-alert-safety.md) · [Guidance](docs/akm-09-guidance-library.md) · [Scientific sources](docs/scientific-sources.md) · [NASA feature evidence](docs/akm-39-nasa-references.md)

## Troubleshooting

- **No crew:** seed the same absolute database path used by the API. An unseeded database legitimately has no profiles.
- **API errors:** check health on port 8000. Vite proxies /api to 127.0.0.1:8000; a different API port requires updating the proxy. API and frontend are separate processes.
- **Port occupied:** stop your own previous server or use another port and update the proxy. Do not terminate unrelated processes.
- **No collective pattern:** check time, coverage, quality and the 48-hour window. Use the deterministic script for the fixed scenario; do not change medical meanings to force a result.
- **Uncertain POST:** check History before retrying. The original `POST /api/measurements` has no idempotency key (the AKM-33 sync endpoint does); local duplicate-click protection does not deduplicate concurrent writers.
- **Schema error:** check AKM_DB_PATH and [database notes](docs/database.md). Back up data; do not delete the database as a first response.
- **NASA unavailable:** missing/invalid history yields not_imported without fabricated values; a broken HRP catalog yields 503. Restore trusted artifacts using the [data guide](docs/data-sources.md).

## Exploratory P1/P2 tools (AKM-33 to AKM-37)

These additions are experimental and do not change the P0 investigation engine. Open them from **Exploratory tools (P1/P2)** in the sidebar.

- [AKM-33 · Offline persistence and sync conflicts](docs/akm-33-offline-sync.md): new manual measurements are queued in IndexedDB with a stable UUID and sent to `POST /api/sync/measurements`, which is idempotent and returns 409 on a conflicting body. Only **new measurements** are queued offline; investigations and follow-up completion still need the API online.
- [AKM-34 · Hypothetical scenarios](docs/akm-34-hypothetical-scenarios.md): arithmetic comparison over immutable synthetic seed values, with assumptions shown.
- [AKM-35 · Mission environments](docs/akm-35-environments.md): four hypothetical contexts with NASA gravity references; switching does not alter health states.
- [AKM-36 · Interactive body map](docs/akm-36-body-explorer.md): keyboard-accessible schematic showing the latest stored reading per region; not a diagnostic instrument.
- AKM-37 · Self-care journey: participation points from stored readings and completed follow-ups; values never change points. See [ZIP, Figma Make and design-document integration](docs/akm-36-37-figma-integration.md).

**Back up existing SQLite files.** AKM-33 adds a `sync_operations` table and migrates `PRAGMA user_version` from 1 to 2 on first start. The migration is forward-only: commits older than PR #33 refuse a version-2 file (`Unsupported AKM database schema version: 2`), so do not reuse a migrated file with an older checkout. The service worker only caches the production build served from a secure origin (localhost or HTTPS): `npm --prefix frontend run build && npm --prefix frontend run preview`. Extra checks: `npm --prefix frontend run test:p2` and `npm --prefix frontend run test:offline`. See the [AKM-33–36 verification record](docs/akm-33-36-verification.md).

## License

Original AKM Health source code and documentation are licensed under the [Apache License 2.0](LICENSE). Copyright 2026 AKM Health contributors; see [NOTICE](NOTICE). Third-party dependencies, NASA data and external content retain their own terms and attribution requirements; see [third-party notices](docs/third-party-notices.md) and [data sources](docs/data-sources.md). This license does not grant rights to NASA names or marks or imply endorsement.
