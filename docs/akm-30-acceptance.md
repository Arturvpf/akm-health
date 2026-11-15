# AKM-30 · MVP integration and accessibility acceptance

[Task](https://app.notion.com/p/4189432b222281b799e9ca40f6f3ec9c) · [Canonical T01–T15](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4)

The acceptance suite exercises the fictional mission and existing contracts. It is not medical, scientific or production certification. Tests never reset a developer's mission database or modify the NASA artifacts.

## Reproduce

Install dependencies from the README. Run from the repository root, using the virtual environment interpreter on Windows (or python in an activated environment):

~~~powershell
.\.venv\Scripts\python.exe -m pytest -q backend/tests/test_mvp_acceptance.py
npm --prefix frontend run build
npm --prefix frontend run test:mvp:install
npm --prefix frontend run test:mvp
~~~

The install command downloads Chromium Headless Shell; it requires internet only during tool preparation. Browser tests require Python backend dependencies, installed frontend dev dependencies, the production build and free loopback ports **8765, 8766, 8767**. PYTHON may select the interpreter. The runner fails rather than reusing a pre-existing service on these ports. Close your own prior test process before retrying; do not terminate unrelated services.

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
| T03 | 201 personal sleep, UTC normalization, persisted History, no implicit investigation | API test + browser registration→History |
| T04 | Invalid unit, unknown profile, out-of-domain mood, missing timezone, NaN, habitat/profile mismatch; no write | API test |
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

Results, source revision, captures and remaining gaps are recorded below after execution and in the PR/Notion task. Earlier feature or API-suite successes do not substitute for a failed/new browser run.

### Recorded run

Base main: `5645a03dc8f6301df67984c6d49c4c72038debf8`; branch `test/akm-30-mvp-acceptance`. See [execution metadata](evidence/akm30/execution.json) and [full browser report](evidence/akm30/report.json). The report was collected after both application fixes below; stale captures from failed harness attempts were excluded.

- Backend: **340 passed**, Ruff passed; the two integrated API acceptance tests also passed in a focused run. No backend implementation changed after this run.
- Frontend: **41 passed** (35 dashboard/registration/wireframe plus 6 history/investigation API), including the new embedded-window regression; navigation, TypeScript and production Vite build passed.
- Browser: **8 scenario groups passed**, Chromium **159.0.8154.6**, **12 axe audits / zero violations**, zero JavaScript errors. All four routes passed document-overflow assertions at 320 and 1280 CSS px with external browser requests blocked. No external requests were attempted.
- Corrected two findings: Other pages now has a named navigation landmark (removing an aria-prohibited-attr incomplete result), and the persisted dashboard observation-window sentence translates inside longer paragraphs without changing UTC timestamps. API contracts and database schema are unchanged.

Captures: [dashboard desktop](evidence/akm30/dashboard-1280.png), [dashboard mobile](evidence/akm30/dashboard-320.png), [registration desktop](evidence/akm30/registrar-1280.png), [registration mobile](evidence/akm30/registrar-320.png), [History desktop](evidence/akm30/historico-1280.png), [History mobile](evidence/akm30/historico-320.png), [investigation desktop](evidence/akm30/investigacao-1280.png), [investigation mobile](evidence/akm30/investigacao-320.png), [receipt](evidence/akm30/receipt.png), [completed-check journey](evidence/akm30/investigation.png).

The final dashboard desktop, registration desktop, History mobile and investigation mobile captures were visually inspected: labels, origin/time, uncertainty and sections remain legible without page-wide horizontal clipping. History's chart/table intentionally scroll internally at 320 px. This is captured-layout review, not a full human interaction approval.

### axe incomplete review and remaining acceptance

Only color-contrast incomplete results remain in the final report. Nodes are decorative/non-text symbols, SVG chart text (axe cannot establish a background inside the image), or table cells partially outside a named horizontal scroll region. Visible labels accompany status symbols, and exact chart data has a table alternative. Source colors were checked separately: muted SVG text #465d74 on white **6.82:1**, caution #664900 on #fff3ce **7.53:1**, positive #20583d on #e7f4eb **7.34:1**, primary white on #244e6e **8.79:1**, neutral #374553 on #eff2f5 **8.74:1**. These checks resolve the observed color pairs; they do not certify all platform/font/assistive-technology combinations. The suite fails on any violation or non-contrast incomplete rule.

**T14 remains partially accepted.** Desktop app inventory returned a computer-use timeout. No successful screen-reader listening occurred. Before closing AKM-30, perform and record a human English screen-reader/keyboard walkthrough: skip link and landmarks; form labels/instructions/errors and native datetime segments; saved receipt announcement/focus; History chart/table and horizontal keyboard scroll; investigation status/uncertainty; compatible completion and reanalysis; empty/error recovery. Record OS/browser/reader versions and actual outcomes.

**T15 evidence is scoped to local-app operation after installation** with browser external-request blocking. It is not evidence of an operating system disconnected from the network, a PWA or later synchronization. If physical/network-adapter disconnection is required by review, record that separately. This PR is ready for technical review; full accessibility acceptance and merge remain pending.
