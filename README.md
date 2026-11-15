# AKM Health — Space Health Monitoring

**A health-monitoring assistant for a crew that cannot just call a doctor.** AKM Health turns scattered readings (sleep, heart rate, mood, cabin air) into plain, checkable findings, explains exactly why each one appeared, and keeps working when the link to Earth drops.

Built by **The Bug Bang Theory** for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/) challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

**Live demo:** <https://akm-health.vercel.app> (the hosted demo keeps its data in temporary storage, so it resets when the server restarts). Click **Take the 2-minute tour** on the home page for a guided walk-through.

> ODYSSEY-26, its crew and every reading are fictional. AKM Health is a software prototype, not a medical device. It makes no diagnosis, prescription or clinical claim, and it does not monitor real astronauts.

## The problem

On a long mission the crew faces health hazards that build up slowly and rarely arrive alone: radiation, isolation and confinement, altered gravity, and a hostile, closed environment. Small changes, such as two short nights in a row while cabin CO₂ drifts up, are easy to miss. Three things make them hard to catch:

- **The data is scattered.** Sleep, vitals, mood and cabin sensors live in different places and are rarely read together.
- **Help is far away.** Communication with Earth is delayed or interrupted, so the crew and a ground team cannot rely on a live conversation.
- **Trust is earned.** Anything that flags a crew member must say why, admit what it does not know, and leave the decision to people. A black box, or an alarm that claims a cause, is worse than nothing.

## The solution

AKM Health is a small, end-to-end system. Record an observation, ask the engine to investigate, read what it found and why, then verify the finding with one new observation.

1. **Record** manual or synthetic readings with their origin, quality, unit and UTC time.
2. **Investigate** on request. A deterministic rules engine looks at each crew member and at the crew as a whole, and compares cabin CO₂ and temperature as context.
3. **Explain.** Every result lists its findings, evidence, uncertainty, limits and NASA research references, plus a **Why this finding** panel with the rule, the threshold, and the exact readings used.
4. **Check next.** The engine suggests the single most useful follow-up measurement. Completing it closes the loop and the next run takes it into account.
5. **Report.** One click produces a printable **downlink report** for ground control: crew status, findings and pending checks on one page.

## What makes it different

- **Auditable, not a black box.** The engine is plain deterministic Python with versioned rules (`demo-v1`), not an LLM. The same data always gives the same answer, and the stored audit lets you see the rule, threshold and readings behind it without recalculating anything.
- **Honest about uncertainty.** Hypotheses are always labelled unconfirmed, a shared timing is never called a cause, suspect readings are excluded and said so, and there is no automatic critical alarm. Missing data is never treated as zero.
- **Built for a bad link.** It is offline-first: a service worker caches the whole app, new readings queue in the browser and sync later without duplicates, and a built-in **Simulate link loss** switch lets you rehearse a communication blackout.
- **Closes the loop.** It does not stop at flagging. It picks the next check, tracks it on a follow-up schedule and updates every screen as soon as data changes.
- **Grounded in NASA research.** NASA Human Research Program hazards frame the interface, and real historical data from NASA OSDR Rodent Research-1 (ISS environment telemetry, radiation dose, CO₂) is shown, credited and kept separate from the simulated crew.
- **Accessible and teachable.** English interface built for keyboard use and checked with automated accessibility tests (a human screen-reader pass is still pending), and a guided tour that walks a new user through the whole flow in about two minutes.
- **Ready to hand over.** Contracts are validated in Python and TypeScript, and the repository ships its tests, source and AI-use documentation.

## Features at a glance

| Area | What you get |
| --- | --- |
| Dashboard | Crew status, latest readings with origin and time, cabin air, upcoming checks, downlink report export |
| Register | Manual measurement form with validation, offline queue and sync |
| History | Trend charts and a full measurement log |
| Investigation | Run, read and re-open results; evidence, hypotheses, next check, human review, NASA references, **Why this finding** |
| Link loss | Simulated blackout with cached data and a queue that syncs on restore |
| Labs | Hypothetical scenarios, mission environments, body map, self-care journey |

## Where the data comes from

- Crew and cabin readings are **simulated or entered by hand**. Baselines are simulated per crew member.
- NASA material is context, never detector input: three Human Research Program entries, and a credited OSDR RR-1 excerpt (ISS environmental telemetry, daily radiation dose, CO₂ summary). It is shown separately and never presented as current mission telemetry.
- Sources, file hashes, transformations and reuse terms are in [docs/data-sources.md](docs/data-sources.md) and [docs/third-party-notices.md](docs/third-party-notices.md).
- AI assistance is disclosed in [docs/ai-usage.md](docs/ai-usage.md).

## How the rules work

| Rule | Plain meaning |
| --- | --- |
| DR-01 | A crew member is flagged when their two latest usable sleep observations, on distinct UTC days within 48 hours, are both at or below 80% of their simulated baseline. |
| DR-02 | A crew pattern is reported when at least two members with comparable periods are flagged by DR-01. |
| DR-03 | Cabin CO₂ and temperature near those periods are compared with an earlier reference (12 h tolerance). A shared direction is context only. |
| DR-04 | Readings marked suspect are excluded, and the result says so. |

These are software parameters for the demo, not clinical thresholds. `GET /api/investigations/{id}/basis` returns the stored rule, threshold and readings behind any result.

## Limitations

- Prototype with simulated data. No diagnosis, clinical validation, authentication or connected sensors. Keep loopback bindings when running locally.
- Only `POST /api/investigations/run` executes rules. Recording data does not rerun them or reclassify saved results.
- Offline mode queues new measurements only. Investigations and follow-up completion need the API.
- The hosted demo uses temporary storage that resets.

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

## Architecture and contributing

[Executable architecture/API](docs/architecture-backend.md) describes the four tables, transactions, UTC, idempotency and configuration. Keep Python schemas and TypeScript contracts aligned.

| Path | Responsibility |
| --- | --- |
| backend/app/ | FastAPI, SQLite, rules, prioritization, guidance and local NASA loader |
| backend/data/nasa/ | Credited HRP catalog and read-only RR-1 excerpt |
| frontend/src/ | React/TypeScript/Vite interface and API clients |
| scripts/ | Checks, isolated demos and audited-CSV importer |
| docs/ | Contracts, sources, feature records and verification (English) |
| docs/internal-records/ | Internal working records (translated to English); not part of the submission documentation |

Start a task branch from main. Consult the [executable architecture](docs/architecture-backend.md) and the task description before changing contracts; compare plans with code and OpenAPI. Review PRs and record tests/limitations before closing tasks.

[Measurement protocol](docs/akm-06-measurement-protocol.md) · [Safety matrix](docs/akm-08-alert-safety.md) · [Guidance](docs/akm-09-guidance-library.md) · [Scientific sources](docs/scientific-sources.md) · [NASA feature evidence](docs/akm-39-nasa-references.md)

## Troubleshooting

- **No crew:** seed the same absolute database path used by the API. An unseeded database legitimately has no profiles.
- **API errors:** check health on port 8000. Vite proxies /api to 127.0.0.1:8000; a different API port requires updating the proxy. API and frontend are separate processes.
- **Port occupied:** stop your own previous server or use another port and update the proxy. Do not terminate unrelated processes.
- **No collective pattern:** check time, coverage, quality and the 48-hour window. Use the deterministic script for the fixed scenario; do not change medical meanings to force a result.
- **Uncertain POST:** check History before retrying. The original `POST /api/measurements` has no idempotency key (the AKM-33 sync endpoint does); local duplicate-click protection does not deduplicate concurrent writers.
- **Schema error:** check AKM_DB_PATH and [database notes](docs/database.md). Back up data; do not delete the database as a first response.
- **NASA unavailable:** missing/invalid history yields not_imported without fabricated values; a broken HRP catalog yields 503. Restore trusted artifacts using the [data guide](docs/data-sources.md).

## Labs: exploratory tools (AKM-33 to AKM-37)

These additions are experimental and do not change the P0 investigation engine. Open them from the **Labs** tabs in the header.

- [AKM-33 · Offline persistence and sync conflicts](docs/akm-33-offline-sync.md): new manual measurements are queued in IndexedDB with a stable UUID and sent to `POST /api/sync/measurements`, which is idempotent and returns 409 on a conflicting body. Only **new measurements** are queued offline; investigations and follow-up completion still need the API online.
- [AKM-34 · Hypothetical scenarios](docs/akm-34-hypothetical-scenarios.md): arithmetic comparison over immutable synthetic seed values, with assumptions shown.
- [AKM-35 · Mission environments](docs/akm-35-environments.md): four hypothetical contexts with NASA gravity references; switching does not alter health states.
- [AKM-36 · Interactive body map](docs/akm-36-body-explorer.md): keyboard-accessible schematic showing the latest stored reading per region; not a diagnostic instrument.
- AKM-37 · Self-care journey: participation points from stored readings and completed follow-ups; values never change points. See [ZIP, Figma Make and design-document integration](docs/akm-36-37-figma-integration.md).

**Back up existing SQLite files.** AKM-33 adds a `sync_operations` table and migrates `PRAGMA user_version` from 1 to 2 on first start. The migration is forward-only: commits older than PR #33 refuse a version-2 file (`Unsupported AKM database schema version: 2`), so do not reuse a migrated file with an older checkout. The service worker only caches the production build served from a secure origin (localhost or HTTPS): `npm --prefix frontend run build && npm --prefix frontend run preview`. Extra checks: `npm --prefix frontend run test:p2` and `npm --prefix frontend run test:offline`. See the [AKM-33–36 verification record](docs/akm-33-36-verification.md).

## License

Original AKM Health source code and documentation are licensed under the [Apache License 2.0](LICENSE). Copyright 2026 AKM Health contributors; see [NOTICE](NOTICE). Third-party dependencies, NASA data and external content retain their own terms and attribution requirements; see [third-party notices](docs/third-party-notices.md) and [data sources](docs/data-sources.md). This license does not grant rights to NASA names or marks or imply endorsement.
