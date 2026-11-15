# AKM-30 · MVP integration and accessibility acceptance

[Task](https://app.notion.com/p/4189432b222281b799e9ca40f6f3ec9c) · [Canonical T01–T15](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4)

The acceptance suite exercises the fictional mission and existing contracts. It is not medical, scientific or production certification. Tests never reset a developer's mission database or modify the NASA artifacts.

## Reproduce

Install dependencies from the README. Run from the repository root, using the virtual environment interpreter on Windows (or python in an activated environment):

~~~powershell
Push-Location backend
..\.venv\Scripts\python.exe -m pytest -q tests/test_mvp_acceptance.py
Pop-Location
npm --prefix frontend run build
npm --prefix frontend run test:mvp:install
npm --prefix frontend run test:mvp
~~~

The install command downloads Chromium Headless Shell; it requires internet only during tool preparation. Browser tests require Python backend dependencies, installed frontend dev dependencies, the production build and free loopback ports **8765, 8766, 8767**. PYTHON may select the interpreter. The runner fails rather than reusing a pre-existing service on these ports. Close your own prior test process before retrying; do not terminate unrelated services.

Optional overrides: AKM_ACCEPTANCE_API_PORT, AKM_ACCEPTANCE_PREVIEW_PORT and AKM_ACCEPTANCE_EMPTY_PORT select other free loopback ports (defaults 8765/8766/8767); AKM_ACCEPTANCE_BROWSER_CHANNEL=chrome uses an installed Google Chrome instead of the downloaded Chromium shell. The test context blocks the AKM-33 shell service worker so that request routing, response assertions and the external-request block observe every page request.

Browser reports and captures go to frontend/node_modules/.cache/akm30 by default. AKM_ACCEPTANCE_OUTPUT may select another absolute output directory. JSON includes exercised cases, axe violations/incomplete checks, JavaScript errors and limitations. A failed assertion produces report.json and attempts a failure capture/body dump.

## Isolation and real vs simulated behavior

- API acceptance uses real FastAPI routes, Pydantic, SQLModel and temporary SQLite with the existing fixed test clock fixture. It covers writes, replays, rejection/rollback, persistence across startup and NASA separation.
- scripts/serve_acceptance_fixture.py runs only on 127.0.0.1. It creates a disposable database, removes inherited routine configuration and uses the current real clock.
- Its seeded mission measurements are explicitly synthetic and shifted by one common delta from the fixed seed into the current window, preserving relative intervals and source/quality. It does not freeze the production clock or alter NASA timestamps/values.
- The runner also starts a genuinely empty database. Empty-state requests are forwarded to that real API; crew readings are not invented in mocked JSON.
- Registration, investigation, check linkage and reanalysis use real HTTP against the seeded API. Tests that intentionally return 503 to the browser are labeled transport-failure simulations.
- External browser requests are blocked while loopback services stay online. This tests local-app operation after installation; it is not a mobile PWA offline/synchronization claim or proof that the operating system has no network access.
- Fixture processes and temporary database directories are owned and cleaned by the runner, including process trees on Windows. No fixture-control endpoints are added to the production API.

## Matrix and evidence boundaries

| ID | Exercise | Executable evidence |
| --- | --- | --- |
| T01 | health, /docs, OpenAPI 200 and real POST schema | test_t01_t12_mvp_acceptance |
| T02 | Seed twice: 4 profiles / 29 samples, then 0 / 0 | Same API test |
| T03 | 201 personal sleep, UTC normalization, persisted History, no implicit investigation; saved reading not kept as a resubmittable draft | API tests (direct and AKM-33 outbox endpoint) + browser registration→History |
| T04 | Invalid unit, unknown profile, out-of-domain mood, missing timezone, NaN, habitat/profile mismatch; no write | API tests (direct and outbox endpoint) + browser live 422/404 through the outbox |
| T05 | Habitat CO₂ 201, null subject, habitat zone | API test + browser recheck |
| T06 | Empty and suspect-only evidence is insufficient_data, never normal by absence | API test; separate real-empty API in browser |
| T07 | Explicit analysis, same-ID replay/reused, stable check count | API test + browser investigation/reanalysis |
| T08 | New observation signals fresh inputs, changes fingerprint only on explicit run | API test + browser flow |
| T09 | Missing, mismatched or suspect completion evidence rejected; check remains pending | API test; suspect option excluded in browser |
| T10 | Compatible linkage, completed_at/measurement_id, same-evidence replay, conflicting evidence 409, recovery after restart | API test + real browser PATCH |
| T11 | Missing/corrupt local historical artifact → not_imported, no invented NASA values | API test in isolated source directory |
| T12 | Local NASA source/period/parameters, 864 values, unchanged after seed/analysis | API test + distinct browser NASA panel |
| T13 | Register→History→investigation→recheck→link→reanalyze | test-mvp-browser.mjs |
| T14 | Origins, uncertainty, empty/error states, labels/focus, accessible markup and responsive layout | Browser + axe + existing component/controller suites |
| T15 | All four built-app routes with external browser requests blocked, local API/SQLite/NASA available | Browser, loopback preview |

T12 verifies provenance/structure and separation of the checked-in archive. It does not repeat the independent original-CSV scientific/source audit; that evidence is in [data sources](data-sources.md) and [AKM-31 verification](akm-31-verification.md). The /docs HTML 200 check does not claim Swagger CDN assets work offline.

## Accessibility scope

The browser suite checks the skip link, native controls, a keyboard-triggered save, focus/receipt and axe WCAG 2/2.1 A/AA rules in exercised states and widths. Each route is checked at 320 and 1280 CSS px for document overflow; scrollable data tables/charts may intentionally scroll inside their named regions.

Zero axe violations is not a blanket accessibility approval. Incomplete checks must be inspected and documented. Filling datetime-local uses Playwright; all internal native date segments have not been manually certified. Real screen-reader listening and full human keyboard review remain separate acceptance evidence. Desktop control attempts must not be reported as successful screen-reader tests.

## Execution record

Earlier feature or API-suite successes do not substitute for a failed/new browser run. The run below supersedes the earlier record made on base 5645a03, before the AKM-33 offline outbox (PR #33) reached main.

### Recorded run: integrated main + PR #32 + PR #34 (2026-11-15)

| Item | Value |
| --- | --- |
| Tested tree | ac6e9ab85e8a17eabe09d16e757804aa01f227b4 = scratch merge of main f714cbc (includes PR #33) + PR #32 head 21d7d67 + this branch at 6479dec. |
| OS | Ubuntu 24.04.5 LTS, Linux 6.18 (container) |
| Browser | Headless Google Chrome for Testing 153.0.8010.12 (AKM_ACCEPTANCE_BROWSER_CHANNEL=chrome; Playwright Core 1.65.1, axe-core 4.14.0). Supplementary check: Python Playwright 1.63.0, same Chrome. |
| Runtimes | Python 3.13.18, Node 22.23.4 |
| Ports | API 8500, preview 4500, empty API 8501 (via the AKM_ACCEPTANCE_* overrides) |

Commands and outcomes (all executed on the tested tree):

- scripts/check.py: Ruff passed; backend **348 passed**; TypeScript passed.
- node --test: dashboard 19, history 4, investigation-api 2, registration 16, wireframe 4, navigation 1, p2-experiments 1, p2-offline 1 — **48 passed, 0 failed**. npm run test:navigation passed. Production build passed. scripts/demo_investigation_flow.py exited 0.
- backend/tests/test_mvp_acceptance.py: 3 passed (test_t01_t12_mvp_acceptance, test_t06_suspect_only_is_not_normal, test_t03_t04_registration_outbox_path).
- npm run test:mvp: **11 scenario groups passed**, **23 axe audits / 0 violations**, 0 JavaScript errors, 0 external requests attempted; only color-contrast incomplete results ([report](evidence/akm30/report.json)).
- Supplementary check ([script](evidence/akm30/supplementary-check.py), [report](evidence/akm30/supplementary-report.json)): all 8 routes with the service worker **allowed** and Chrome DNS resolution limited to 127.0.0.1; axe at 320/1280; Tab-only pass; text+icon check on notices/badges.

### T01–T15

| ID | Steps | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| T01 | GET /api/health, /docs, /openapi.json; POST schema present | 200; health ok | As expected | PASS | test_t01_t12_mvp_acceptance |
| T02 | Seed twice | 4 profiles/29 samples, then 0/0 | As expected | PASS | test_t01_t12_mvp_acceptance |
| T03 | Register sleep (UTC−3) via /api/measurements and via the outbox /api/sync/measurements; replay same operation ID; browser keyboard registration → receipt → History; reopen Register | 201, UTC-normalized, persisted, no implicit investigation, replay 200 same ID, form not prefilled with the saved reading | As expected after fix 1 below (before: form reopened prefilled with the saved value 5.2) | PASS | API tests; browser "T13 keyboard registration", "T03/T13 confirmed reading is not kept…"; receipt.png |
| T04 | Invalid unit, unknown profile, mood 6, no timezone, NaN, habitat/profile mismatch on both endpoints; browser: live 422 (model rule), 422 (quality field), 404 (profile) through the outbox | 422/404, no write; form shows correctable error, nothing queued | As expected; field-level 422 marks the field aria-invalid; model-level 422 shows the general message | PASS | API tests; browser "T03/T04 outbox path" |
| T05 | Habitat CO₂ 201, null subject, habitat zone; browser recheck | As stated | As expected | PASS | API test; browser recheck flow |
| T06 | Empty storage and suspect-only evidence | insufficient_data, never normal; empty UI invents no crew | As expected | PASS | API tests; browser "T06/T14 real empty storage" |
| T07 | Explicit run, same-scope replay | reused=true, same ID, stable check count; GET never runs rules | As expected (2 POSTs, 0 on navigation) | PASS | API test; browser "T07" |
| T08 | New observation after analysis, explicit reanalysis | Fresh-input signal; fingerprint changes only on explicit run | As expected | PASS | API test; browser "T08–T10/T13" |
| T09 | Missing, mismatched, suspect completion evidence | Rejected, check stays pending; suspect not offered in UI | As expected | PASS | API test; browser |
| T10 | Compatible link, replay, conflicting evidence, restart | 200 with measurement_id; 409 on conflict; survives restart | As expected | PASS | API test; browser PATCH; investigation.png |
| T11 | Missing/corrupt local NASA artifact | not_imported, no invented values | As expected | PASS | test_t01_t12_mvp_acceptance |
| T12 | Local NASA source/period/parameters | 864 values, unchanged after seed/analysis, separate panel | As expected | PASS | API test; browser; supplementary (864 via preview proxy) |
| T13 | Browser Register→History→Investigate→select check→link compatible reading→Reanalyze | Each step through real HTTP to the seeded API | As expected | PASS | browser suite; receipt.png, investigation.png |
| T14 | axe WCAG 2/2.1 A/AA at 320/1280 on 8 routes and exercised states; skip link; keyboard save; Tab-only pass; text+icon on notices; empty/error/stale states | 0 violations; labeled states; focus visible | 0 violations (after fixes 3–4); stale copy labeled (fix 2); notices carry text plus aria-hidden icon; datetime inputs (Register, History filters) show no outline in computed style during Tab pass — needs human visual check | PASS (automated) / **requires human** | report.json, supplementary-report.json, captures |
| T14-SR | Real screen-reader listening | — | Not executed (no screen reader available to the executor) | **requires human** | — |
| T15 | Built app, all 8 routes, external requests blocked (Playwright) and, separately, DNS limited to loopback with service worker allowed; NASA from local API | No non-loopback request; NASA loads | 0 external/non-loopback requests in both runs; 864 NASA values served locally | PASS (scoped: browser-level isolation, not an OS with networking disabled) | report.json, supplementary-report.json |

### Defects found in the integrated build and fixed on this branch

1. **Saved reading reappeared as a draft** (AKM-33 localStorage draft): after a confirmed save, reopening Register prefilled the same value/time/target, inviting a duplicate with a new operation ID. Now cleared on saved/queued; metric kept. Unit + browser regression (browser assertion fails without the fix: actual 5.2).
2. **Cached dashboard announced as a confirmed refresh**: on API failure the cache fallback was shown with "Dashboard updated." and the current time as "Last confirmed refresh". Now labeled "Could not get current data… copy saved on this device at …" with the save time. Unit + browser regression; [capture](evidence/akm30/dashboard-stale-copy.png).
3. **Every error state was labeled "Connection error"**, including server validation rejections. Generic label is now "Error"; messages keep the specific cause.
4. **Exploratory pages axe findings**: body map buttons failed label-in-name (serious, 2 nodes); self-care score used aria-label on a generic div (aria-prohibited-attr). Both fixed; these pages are now audited in the suite.
5. **Browser suite out of date with main**: it waited for /api/measurements while the UI saves through /api/sync/measurements, and the shell service worker could hide requests from routing. Updated; ports/browser channel configurable.

### axe incomplete review

Only color-contrast incomplete results remain: decorative/non-text symbols, SVG chart text and cells partially outside a horizontal scroll region. Colors were not changed by this branch; the earlier source-color ratios still apply (muted SVG text #465d74 on white 6.82:1, caution #664900 on #fff3ce 7.53:1, positive #20583d on #e7f4eb 7.34:1, primary white on #244e6e 8.79:1, neutral #374553 on #eff2f5 8.74:1). Zero axe violations is not a blanket accessibility approval.

### Remaining for humans

- **T14 screen reader**: English screen-reader walkthrough (skip link and landmarks; form labels/errors and native datetime segments; receipt announcement/focus; History chart/table horizontal scroll; investigation status/uncertainty; completion and reanalysis; empty/error/stale-copy recovery). Record OS/browser/reader versions.
- **T14 visual focus** on datetime-local inputs (Register, History filters).
- **T15** if reviewers require an OS-level disconnected run, record it separately; evidence here is browser-level isolation.
- README still says the guide "does not claim mobile PWA persistence/sync"; main now ships the AKM-33 offline outbox — wording to be reconciled by the doc owner.
- CI in PR #32 does not run test-p2-experiments.cjs, test-p2-offline.cjs or the browser suite.

Captures: [dashboard desktop](evidence/akm30/dashboard-1280.png), [dashboard mobile](evidence/akm30/dashboard-320.png), [registration desktop](evidence/akm30/registrar-1280.png), [registration mobile](evidence/akm30/registrar-320.png), [History desktop](evidence/akm30/historico-1280.png), [History mobile](evidence/akm30/historico-320.png), [investigation desktop](evidence/akm30/investigacao-1280.png), [investigation mobile](evidence/akm30/investigacao-320.png), [receipt](evidence/akm30/receipt.png), [completed-check journey](evidence/akm30/investigation.png), [stale dashboard copy](evidence/akm30/dashboard-stale-copy.png); exploratory pages comparador/ambientes/corpo/autocuidado at 320 and 1280 in evidence/akm30.
