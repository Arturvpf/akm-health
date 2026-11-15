# AKM-33 to AKM-36 — Verification record and handoff

**Baseline:** ZIP `akm-health-main.zip` supplied for this run (contents extracted without overwriting the remote repository). This record documents the original hand-off; the current test counts are in the pull request that supersedes it.

## Deliverables by task

| Task | Main files | Implementation |
|---|---|---|
| AKM-33 | `backend/app/offline_sync.py`, `models.py`, `db.py`, `schemas.py`, `main.py`; `frontend/src/offline-store.ts`, `OfflineStatus.tsx`, `public/sw.js` | Persistent per-operation outbox, resend with a fixed UUID, server idempotency, conflict detection, explicit cache, local draft |
| AKM-34 | `frontend/src/ScenarioComparator.tsx`, `scenario-data.ts` | Arithmetic comparisons of 5 metrics over an immutable synthetic seed, explicit assumptions and absences |
| AKM-35 | `frontend/src/EnvironmentView.tsx`, `environment-data.ts` | 4 hypothetical environments, NASA references, variable context, clinical engine untouched |
| AKM-36 | `frontend/src/BodyExplorer.tsx`, `experiments.css` | Vector silhouette, native keyboard-accessible controls, association of indicators with explicit limits |

Other modified files: `frontend/src/App.tsx`, `navigation.ts`, `measurement-api.ts`, `MeasurementForm.tsx`, `api.ts`, `history-data.ts`, `investigation-api.ts`, `OfflineStatus.tsx`, `frontend/package.json`, `README.md`, `docs/database.md`, `backend/tests/test_database.py`.

## What was verified in that environment

| Test | Result |
|---|---|
| `python -m compileall -q backend` | **PASSED** — valid Python syntax |
| `tsc --noEmit` on the pure TypeScript contract, data and outbox modules | **PASSED** |
| `node frontend/scripts/test-p2-experiments.cjs` | **PASSED** — gravity/context and simulated values |
| `node frontend/scripts/test-p2-offline.cjs` | **PASSED** — simulated persistence, lost network response, receipt and conflict retention |
| Parsing of every `.ts`/`.tsx` file with TypeScript | **PASSED** — zero parsing errors |
| `python -m pytest -q backend` | **NOT RUN** — `sqlmodel` dependency missing and installation blocked by lack of network |
| `npm --prefix frontend ci`, `npm run build` | **NOT RUN** — React/Vite `node_modules` unavailable in that environment |
| Real Chromium browser / IndexedDB E2E | **BLOCKED** — HTTP and file navigation by Chromium was blocked by the environment; a simulated unit test exists, but it does not replace E2E |

Unit test results do not replace real testing with the backend, database and browser. Do not present these tasks as QA-approved before those checks.

## Validation for the team (when an environment with dependencies is available)

1. Back up the existing SQLite database and install the project dependencies.
2. Start FastAPI and run `python -m pytest -q backend`. The AKM-33 tests cover v1 migration, re-execution, conflict and concurrency.
3. Run `npm --prefix frontend ci`, `npm --prefix frontend run build`, `npm --prefix frontend run test:p2` and `npm --prefix frontend run test:offline`.
4. Run `npm --prefix frontend run preview`; load the app at least once to install the Service Worker.
5. Turn off the API and record a fictional measurement; reload the browser; verify the queue is preserved; turn the API back on and sync; check count 1 and receipt 201/200.
6. Force a resend of the same UUID with a different body: HTTP 409, item retained in the outbox, JSON export available.
7. Visit `#/scenarios`, `#/environments` and `#/body`, including on a phone and using the **keyboard only**.
8. Confirm that real NASA data do not appear as crew measurements and that changing the environment does not alter health statuses or the main tables.

## Remaining risks and limits

- Only **new measurement records** are queued automatically in AKM-33. Investigation and follow-up completion require the API to be online, to avoid running on a possibly outdated context. The team must decide whether official acceptance of AKM-33 also requires those two actions offline; if so, additional work is needed.
- IndexedDB depends on browser policies and capacity; there is no absolute guarantee after manual clearing, exhausted quota or a device change. An operation with a storage error is not sent to the server.
- Selected environments are **hypothetical contexts**, not sensor data and not a change to the active mission.
- A schematic body map is not a diagnostic instrument and shows no real body readings.
- NASA's contextual scientific content supports the types of hazards; it does not validate clinical heuristics or synthetic numbers.
