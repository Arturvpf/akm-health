# AKM Health — NASA Space Apps 2026 final-readiness audit

**Audit basis:** GitHub `main` at `5645a03dc8f6301df67984c6d49c4c72038debf8`, Notion AKM Health canonical architecture and backlog, project documentation, and publicly retrievable 2026 Space Apps materials. Prepared on **15 November 2026**. This is a **read-only conformance assessment plus proposed CI/documentation fixes**, not NASA certification, medical validation, full local rerun, or a successful Project submission.

## Status update — after PRs #33 and #34 (15 November 2026, afternoon)

This audit was written against `5645a03`. Since then `main` gained PR #33 (AKM-33 to AKM-37 exploratory tools) and PR #34 (AKM-30 acceptance). Where this update and the original text below disagree, this update wins:

- **AKM-30 (T01–T15):** executed on `main` + PR #32 + PR #34 and recorded in [AKM-30 acceptance](akm-30-acceptance.md). T01–T13 pass; T14 automated checks pass (axe at 320/1280 px, keyboard, text + icon). An English screen-reader walkthrough and a visual focus check of the date/time inputs still need a person. T15 passed as browser-level isolation (no external requests), not with the operating system's network turned off. AKM-30 is marked Done in the internal Notion workspace with those items recorded as pending.
- **Counts on the integrated tree (evening update):** 380 backend tests (the earlier 345 and 348 figures in other records are historical). At the time of the first update: 348 backend tests, 48/48 frontend node tests, 11/11 browser scenario groups, 23 axe audits with 0 violations.
- **Idempotency:** new registrations go through `POST /api/sync/measurements` with a client `operation_id`; a replay returns the original receipt and a different body returns 409. The original `POST /api/measurements` still has no idempotency key.
- **Offline and P1/P2 tools now on `main`:** IndexedDB outbox for new measurements (investigations and follow-up completion still need the API), service worker for the production build, scenario comparator, mission environments, body map and self-care journey — eight routes in total. They are exploratory and secondary to the investigation loop.
- **Schema:** AKM-33 migrates SQLite from `user_version` 1 to 2, forward-only.
- **CI:** the workflow added by this PR is **manual only** (`workflow_dispatch`); it does not run on pull requests or pushes. Local commands in section 6 remain the reference verification.
- **Judging criteria:** the official judging guide names the first criterion **Influence**; "Impact" appears in award names.

## 0. Verdict and non-negotiable next steps

**Substantial implementation exists, but 100% compliance is NOT established.** The software corresponds to the 2026 challenge theme: it records fictional crew observations, displays history, explicitly runs deterministic investigations, suggests a check, links actual new evidence to follow-ups, and can reanalyze. The source also ships a credited NASA OSDR RR-1 environmental excerpt. The remaining high-impact risks are **full acceptance of the integrated checkout (AKM-30), final submission material and Project submission (AKM-32), source eligibility from the exact challenge Resources tab, and human science/AI disclosures**.

Before the event deadline:

1. **AKM-32 / human team lead:** Open the team's signed-in *Project* tab and submit; verify a submitted state, not just saved draft. The [2026 Space Apps site](https://www.spaceappschallenge.org/2026/) states November 15, 11:59 PM in the event's applicable local time. Also check local-event requirements.
2. **AKM-30 / QA:** Execute and record T01–T15 (including all four screens, error and empty states, offline after installation and narrator/keyboard review); log the test revision, device, result, evidence and actual limitations. Feature screenshots/axe subset checks do not by themselves complete the matrix.
3. **Research/Safety:** Review every displayed health-related instruction and synthetic rule; reject any text implying clinical limits or verified causes. Document approval or openly state absent approval.
4. **NASA data owner:** Confirm via the signed-in challenge's **Resources tab** that the actual NASA resources used are eligible and accurately represented. The publicly indexed challenge intro confirms the problem, but the full Resources list could not be independently retrieved here. Do not fabricate a confirmation.
5. **AI/permissions owner:** Complete contributor-by-contributor disclosure of AI tools and actual use; confirm rights to all code, data and visual materials, including third-party terms. Current `docs/ai-usage.md` explicitly declares an incomplete inventory.
6. **Presentation owner:** Provide accessible, no-login demonstration link, correctly sized video or slide presentation according to the **actual 2026 Project form and local event**, sources, limitations and concise evidence of the action loop. Prior/local guidance about 30-second videos or 7 slides must **not** be assumed to be a universal 2026 requirement.

## 1. What the official challenge actually asks

[Official challenge](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/): build health monitoring software that **gathers health indicators and enables astronauts to evaluate and act on their health status** during long missions. The public introduction describes radiation, isolation/confinement, altered gravity and hostile/closed environments. This is a challenge description, **not** an endorsement of the AKM's chosen clinical indicators or thresholds.

[2026 event](https://www.spaceappschallenge.org/2026/): November 14–15, up to six team members, official registration and submission from the team's Project tab. [Participant Terms](https://www.spaceappschallenge.org/legal/) require suitable license documentation and references to every incorporated source, including open/free sources. 2026 local event pages describe five judging dimensions — **Impact, Creativity, Validity, Relevance, Presentation** — but do **not** justify assigning a globally applicable numeric weight. Specific required fields and the complete challenge Resources tab still need signed-in verification.

**Scope boundary:** A prototype is not a flight-certified autonomous medical device, a real crew record, a live flight sensor network or a claim of clinical efficacy.

## 2. Requirements → actual code and evidence

| Requirement | Code / source evidence at audit SHA | Assessment | What remains |
| --- | --- | --- | --- |
| Four navigable mission screens | `frontend/src/App.tsx`, `Dashboard.tsx`, `MeasurementForm.tsx`, `HistoryTrend.tsx`, `InvestigationPage.tsx`; [merged PR #29](https://github.com/Arturvpf/akm-health/pull/29) | **Implemented; tested on PR** | Complete integrated-main browser and screen-reader sign-off |
| Collect five distinct indicators with units/origin/time | `backend/app/schemas.py`, `main.py`, `models.py`, registration UI and `backend/tests/test_measurements.py` | **Implemented** | Sign off exact copy and protocol for each type |
| Persist history and show trends | `backend/app/db.py`, `main.py`, `dashboard.py`, `frontend/src/HistoryTrend.tsx`; PR #24 | **Implemented** | AKM-30 boundary, empty and stale-state checks |
| Detect individual/collective changes without diagnosis | `backend/app/rules.py`, `alerts.py`, `investigations.py`; matching backend tests | **Implemented as a demonstration rule** | Clinical/operational validation intentionally NOT claimed |
| Suggest an informative next check | `backend/app/next_check.py`, `guidance.py`, `investigation_config.json`; `test_next_check.py` | **Implemented** | Evaluate practicality with Research/Safety; informational scoring is heuristic |
| Link a new measurement to a follow-up and explicitly reanalyze | `backend/app/investigations.py`, `models.py`, `main.py`, `frontend/src/InvestigationPage.tsx` and tests | **Implemented; prior browser evidence** | Reproduce T07–T10 / T13 on frozen submission revision |
| Synthetic mission clearly differentiated | `backend/app/seed.py`; `source=synthetic`; UI simulation notices | **Implemented** | Confirm every outward presentation and screenshot keeps source context |
| Public NASA datasets inside running product | `backend/data/nasa/reference.json`, `nasa_reference.py`, `frontend/src/NasaReferences.tsx`, `docs/akm-39-nasa-references.md` | **Implemented** | Confirm official Resources eligibility; no real astronaut measurements |
| NASA research/context citations | `backend/data/nasa/hrp_catalog.json`, `docs/scientific-sources.md` | **Implemented** | Research/Safety approval and resource selection |
| Mars environment | `backend/app/mission_environment.json`, NASA fact references | **Static planetary reference** | PDS MEDA **not** incorporated; do not claim otherwise |
| Transparent limitations, license and third-party notices | `LICENSE` Apache-2.0, `NOTICE`, `docs/third-party-notices.md`, README | **Documented** | Human confirmation of rights/attribution and final submission |
| AI transparency | `docs/ai-usage.md` | **Partial** | It admits model/version/tool use is incomplete for other contributors |
| Accessibility | React ARIA labels, text+icons with color, keyboard flows; [PR #29](https://github.com/Arturvpf/akm-health/pull/29) reports Chromium/axe checks | **Partial verification** | Narrator in **English**, other states and AKM-30 matrix |
| Local/offline operation | Local FastAPI/SQLite/Vite, bundled NASA JSON and seed; README | **Local-only after installation** | Not full independent mobile browser/PWA offline; T15 sign-off |
| Continuous integration / reproducible verification | Existing tests and `scripts/check.py`; `.github/workflows/ci.yml` added by this PR | **Manual workflow only** (`workflow_dispatch`) | Run it from the Actions tab when wanted; local commands remain the reference |
| Actual 2026 Project submission | Notion AKM-32 (Backlog) | **Not verified** | Human team submission + confirmation required |

## 3. NASA historical data: what can and cannot be claimed

The `NASA OSDR EDA / Rodent Research-1 (RR-1)` artifact is a **historic environmental ISS channel**, not astronaut clinical telemetry, not the ODYSSEY-26 habitat, and not Mars. The repository contains **288 timestamps / 864 numerical ISS values** for 1 October 2014, sampled from the verified RR-1 telemetry export and presented in separate Dashboard/Investigation panels. The original CSV audit reports **12,087 rows / six numeric channels** with SHA-256 `6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805`. Only three ISS channels (CO₂, temperature, humidity) enter the shipped excerpt. The extraction script rejects mismatched CSV hashes and excludes ground control/radiation.

Reference: [NASA OSDR EDA](https://visualization.osdr.nasa.gov/eda/), [specific RR-1 telemetry API](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/), [NASA OSDR export tutorial](https://github.com/nasa/OSDR_Tutorials/blob/main/source/pages/guides/environmental_data_application.md), [repository provenance](data-sources.md), [repository import evidence](akm-39-nasa-references.md). OSDR [terms/citation](https://science.nasa.gov/reference/osdr-help-terms-and-conditions/) and [NASA-led mission data policy](https://science.data.nasa.gov/about/license) are documented. The team's interpretation of redistribution terms must remain subject to any specific source notice. The historical series is **not** a CO₂ medical safety limit and cannot establish sleep/CO₂ causality.

**Key impact trade-off:** NASA data is used as a credible *separately identified reference/visualization*. The executable sleep/cohort detector uses **simulated mission inputs**, not the historical NASA series. Present this accurately in the pitch: NASA data grounds environmental context, not validation of the health algorithm. Do not claim NASA-trained diagnosis, NASA benchmark efficacy, autonomous clinical decisions, or imported MEDA weather.

## 4. Canonical AKM-30 T01–T15 — acceptance evidence required

This matrix follows the Notion canonical architecture (internal Notion page; Portuguese, not part of the submission); individual unit and feature tests are not a substitute for executing all scenarios on the **final merged commit**.

| ID | Acceptance action | Evidence previously documented / remaining |
| --- | --- | --- |
| T01 | HTTP health, docs and OpenAPI | Prior AKM-31 local 200 and schema checks; repeat on submission build |
| T02 | Two seeds, four crew, no duplicates | AKM-31 clean install and `test_seed.py`; repeat |
| T03 | Valid sleep POST, UTC, zone and persistence | Unit/API tests and feature acceptance; repeat |
| T04 | Wrong units, unknown astronaut, NaN, mood out of range | 422/404 tests; confirm no write |
| T05 | Habitat CO₂ with null astronaut | Backend schemas and tests |
| T06 | Missing/suspect data handled as uncertainty | Rules/tests; inspect UI, avoid false normal |
| T07 | Same investigation input reuses ID and follow-up | Tests and isolated script; browser replay |
| T08 | New evidence flags unanalyzed data then new fingerprint | Tests, script and frontend state |
| T09 | Wrong/missing follow-up evidence rejected | Backend 422, pending state |
| T10 | Matching evidence completes exactly once | Persistence tests and prior browser check |
| T11 | NASA historical file missing/invalid | `not_imported` response, no fabricated data; tested |
| T12 | Valid NASA history isolated from synthetic seed | 864 values + provenance + separate NASA UI; tested in PR #28 |
| T13 | Register → History → Investigate → Check → Reanalyze in browser | PR #29 reports IDs #1 → measurement #30 → follow-up #1 → investigation #2; **repeat on merged SHA** |
| T14 | Accessible, text+icon alerts, empty/error/loading states | Axe 320/1280 only for exercised states; **English screen reader remains** |
| T15 | Offline after initial dependency installation | Prior feature evidence blocked external requests for NASA section; **full application offline check still open** |

For every row, record **OS + browser + backend version + exact Git SHA + test steps + expected/actual + screenshot/log + reviewer**. Do not mark AKM-30 done based solely on this table.

## 5. Technical and procedural risks — order to fix

**P0 / cannot truthfully mark 100%:**
- No proof of actual submission or required final Project form fields; this must be performed by the team lead before deadline.
- AKM-30 full integrated acceptance and English screen-reader approval remain open.
- Challenge Resources source eligibility is unconfirmed from accessible public challenge material.
- Research/Safety sign-off and complete team AI-use inventory are incomplete.
- No tracked CI workflow at audit baseline; this PR adds one as a **manual-only** workflow (`workflow_dispatch`), so no automatic run is claimed.

**P1 / important trade-offs to disclose:**
- Runtime Python dependency ranges are not pinned with a full lock, so future clean installs may vary; compare actual versions and keep the verification record.
- Default seed sample dates are fixed to 13–14 November 2026; live 48-hour investigation windows age out. An `insufficient_data` result can be correct. For a repeatable demo use the isolated fixed-clock script or controlled new synthetic observations.
- Unauthenticated FastAPI is intended only for loopback. Do not deploy it directly to the public internet with personal data.
- Measurements lack a server-side idempotency key for concurrent client retries. The interface handles uncertain POSTs defensively, but multiple writers can still duplicate a record.
- NASA RR-1 is a contextual history, not a substitute for physiological flight validation; MEDA remains optional/not shipped.
- Full PWA offline synchronization, multi-environment switching and hypothetical comparators are P1 improvements. Do not prioritize them ahead of AKM-30/32 during the event.

**P2 / documentation consistency:**
- The README at the baseline inaccurately describes main as Portuguese although PR #29 has been merged. This PR updates that passage.

## 6. How to reproduce technical checks

```bash
python -m venv .venv
# activate it
python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
python scripts/check.py
node --test frontend/scripts/test-dashboard.cjs frontend/scripts/test-nasa-panels.cjs frontend/scripts/test-history.cjs frontend/scripts/test-investigation-api.cjs frontend/scripts/test-registration.cjs
npm --prefix frontend run test:navigation
npm --prefix frontend run build
python scripts/demo_investigation_flow.py
```

The registration integration test accepts `PYTHON=python` when the environment is active; otherwise it looks for a repository-local virtualenv. The GitHub Actions workflow (manual trigger only) runs lint, backend tests, TypeScript, frontend node tests, navigation and build when started from the Actions tab. **Chromium browser, screen reader, offline runtime and NASA site submission remain separate manual gates**.

Evidence already committed in prior revisions: [AKM-31 Windows clean install](akm-31-verification.md) reports Ruff + **338** pytest tests, frontend node tests and Vite build; [PR #29](https://github.com/Arturvpf/akm-health/pull/29) reports **40** frontend tests and exercised browser paths at 320/1280 with zero detected axe A/AA issues in those states. These are **their recorded test claims**, not tests independently rerun by this audit. GitHub Actions only listed older successful workflow runs at the time of this review; a successful CI run for the **current main baseline** was **not** established.

## 7. Judge-ready story (accurate, not overstated)

**Problem:** during delayed-communication missions, detecting changes and knowing which observation to verify next is difficult.

**Solution:** AKM Health helps a *fictional* crew record five kinds of readings, view historical changes, explicitly investigate individual/collective patterns, receive a transparent next-check suggestion, attach a new observation and reanalyze with traceability.

**What is real:** NASA HRP descriptions of spaceflight hazards and a credited, historical NASA OSDR RR-1 ISS environmental archive shown separately.

**What is simulated:** the four ODYSSEY-26 astronauts, sleep/heart rate/mood, habitat conditions and demonstration thresholds. NASA RR-1 is *not* inserted into clinical or mission measurements.

**Technical approach:** local FastAPI + SQLModel/SQLite, deterministic interpretable rules, React/Vite UI with no external LLM requirement, local NASA reference artifacts and tests.

**Limitations:** demonstration only; no astronaut health outcome validation, no diagnosis/prescription, no causal proof, no real-time sensors, no fully offline independent PWA, no NASA approval.

**Judging dimensions:** Impact (reduce observation uncertainty), Creativity (prioritized next check and evidence loop), Validity (auditable claims and conservative uncertainty), Relevance (astronaut actions with health indicators), Presentation (one complete live story, source citations and visible limitations). These are positioning recommendations, not NASA scores.

## 8. Evidence sources

- [2026 challenge](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)
- [2026 dates/submission](https://www.spaceappschallenge.org/2026/)
- [2026 participant terms](https://www.spaceappschallenge.org/legal/)
- [NASA HRP hazards](https://www.nasa.gov/hrp/hazards/) and [NASA risks](https://www.nasa.gov/hrp/risks/)
- [NASA OSDR EDA](https://visualization.osdr.nasa.gov/eda/)
- [NASA science-data licensing](https://science.data.nasa.gov/about/license)
- Notion architecture (internal Notion page; Portuguese, not part of the submission) and backlog (internal Notion page; Portuguese, not part of the submission)
- Notion AKM-30 (internal Notion page; Portuguese, not part of the submission), AKM-32 (internal Notion page; Portuguese, not part of the submission)
- [Clean-install results](akm-31-verification.md), [English UI PR #29](https://github.com/Arturvpf/akm-health/pull/29), [NASA integration PR #28](https://github.com/Arturvpf/akm-health/pull/28)

**Scope of this audit:** static inspection of the complete tracked tree, selective source inspection, Notion comparison, official web research and review of existing test evidence. The auditor could not clone/install/run the entire codebase in the current environment due to blocked GitHub DNS; therefore no new end-to-end test pass is asserted. Changes are isolated on the audit branch until reviewed and merged.
