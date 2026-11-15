# AKM-31 verification — 15 November 2026

This task documents current main at **19c7b4e3c9838988d873717110afb150000b0f07**. The English-interface PR #29 was still separate when this guide was prepared; its results are not claimed as this task's execution. No application code, HTTP contract, schema or dependency manifest was changed by AKM-31.

## Clean installation and environment

A git archive of the base revision was extracted into a separate clean directory, without the existing .venv, node_modules or development database. A new virtual environment was created with Python 3.14.7 on Windows. requirements-dev.txt was installed from the package index, then pip check reported no broken requirements. npm ci installed the lockfile graph from scratch: 69 packages added, 70 audited, zero vulnerabilities reported at installation time. This is an npm audit result, not a security certification.

| Component | Verified version |
| --- | --- |
| Python / pip | 3.14.7 / 26.2.1 |
| Node / npm | 22.12.0 / 10.9.0 |
| FastAPI / Uvicorn | 0.163.1 / 0.54.0 |
| SQLModel / SQLAlchemy | 0.0.50 / 2.1.8 |
| Pydantic / Starlette | 2.14.3 / 1.10.0 |
| Pytest / HTTPX / Ruff | 9.2.0 / 0.28.1 / 0.15.0 |
| React / React DOM | 19.3.1 / 19.3.1 |
| TypeScript / Vite | 5.9.3 / 7.3.8 |

[Full dependency/license metadata](dependency-inventory.json) is a snapshot of this installation, not a Python lockfile or a promise that future resolutions are identical. Node was already available as a portable installation. Python 3.13 and macOS/Linux commands were reviewed, but **not executed** in this Windows task.

## Commands and results

Executed against the clean code export:

| Command / operation | Result |
| --- | --- |
| python -m venv .venv | New environment created |
| python -m pip install -r backend/requirements-dev.txt | Installed successfully |
| python -m pip check | No broken requirements |
| npm --prefix frontend ci | Successful after correcting the executor's Windows environment |
| python -m app.seed, twice, from backend with one absolute AKM_DB_PATH | First: 4 profiles / 29 measurements; second: 0 / 0 |
| Uvicorn startup, HTTP health, /docs and /openapi.json | 200; health confirms sqlite_reachable |
| GET /api/astronauts and /api/nasa/references | 4 profiles; 3 HRP entries; imported; 864 historical values |
| npm --prefix frontend run dev -- --port 5173 --strictPort | Started at 127.0.0.1:5173; /api/health proxy returned the API health response on port 8000 |
| python scripts/demo_investigation_flow.py | Passed; reused=true, compatible completion, new explicit investigation ID |
| python scripts/demo_adaptive_routine.py | Passed; routine/window/compatible completion assertions |
| python scripts/check.py | Exit 0: Ruff, 338 backend tests and TypeScript passed |
| Frontend node --test command from README | 39 passed, including registration with real FastAPI/TestClient and temporary SQLite |
| npm --prefix frontend run typecheck | Passed |
| npm --prefix frontend run test:navigation | Passed, four destinations |
| npm --prefix frontend run build | Passed, TypeScript and Vite production assets |
| Documentation links / whitespace | Checked before PR publication |

The standard scripts/check.py runner completed successfully after fixing the executor environment. It does not include frontend node tests, browser acceptance or clinical review.

The test suite emits the existing Starlette/httpx deprecation warning. No dependency was silently changed to suppress it.

### Executor recovery

The first npm attempt used a stripped orchestration environment without Windows ComSpec and failed in process spawning. After adding it, a forward-slash ComSpec path was not recognized as cmd.exe by the shell launcher, affecting npm script execution. Restoring the normal backslash Windows shell path and PATH fixed the executor; npm ci, build, typecheck and navigation were rerun. No application change was needed. These failures are not presented as successful commands or as repository bugs.

## NASA verification

The exact NASA RR-1 telemetry API returned HTTP 200. All **288 local timestamps / 864 values** matched the corresponding ISS fields at the source CSV's two-decimal precision. This was a fresh comparison in AKM-31, separate from the original AKM-38/39 audit.

The full original audited CSV was not available in this checkout. Therefore full CSV regeneration was **not rerun**; its command, byte-hash precondition and overwrite behavior were checked against scripts/import_rr1_reference.py. The included JSON was read and compared directly with the official source; it was not regenerated or modified. Do not confuse the original CSV hash with a JSON or download hash.

NASA policy links were consulted for attribution/terms. The guide retains the distinction between a general NASA-led mission-data policy and a dataset-specific notice; it does not assign CC0 to NASA logos or web pages. See [data sources](data-sources.md).

## Limits and handoff

This task did not repeat complete visual, screen-reader, keyboard or offline acceptance. Documentation/startup/API reproduction is not the full AKM-30 T01–T15 matrix. Existing per-feature browser evidence remains separately identified.

The README's deterministic script uses TestClient and a frozen clock; its recheck is inserted through SQLModel. It is not proof of the browser registration journey. Normal UI results depend on the real clock, the 48-hour window, quality and actual observations.

At the time of the AKM-31 verification, the root project license was undecided. The requester subsequently authorized applying [Apache-2.0](../LICENSE); see [NOTICE](../NOTICE). Remaining team decisions/reviews: full contributor/tool disclosure, Research/Safety approval and event-specific submission requirements. Do not interpret documentation, passing checks or a PR as merge, deployment, clinical validation or submission.
