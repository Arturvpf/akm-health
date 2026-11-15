# AKM-33 to AKM-37 — Integration of the team ZIP, Figma Make and design document

**Date:** 15 November 2026 · **Branch:** `feat/akm-33-36-p1-p2` · **Status:** P1/P2 exploratory work. It must not delay the P0 flow, AKM-30 or the AKM-32 submission.

## Inputs and the task each one maps to

| Input | What it contains | Backlog task |
| --- | --- | --- |
| `AKM_Health_AKM33_34_35_36_Completo.zip` | Repository snapshot built on `19c7b4e` (PR #28) plus 35 changed files | AKM-33 offline sync, AKM-34 scenario comparator, AKM-35 mission environments, AKM-36 body map |
| [Figma Make — AKM Health Mission Monitoring](https://www.figma.com/make/zu8Tq9w8gElqjLBJWlUEfP/) | Standalone React/Tailwind prototype in Portuguese. All data are hard-coded and nothing calls the API | AKM-36 body map (`HumanHealthMap`), AKM-37 gamification (`SelfCareJourney`), AKM-11 brand identity (logo, dark palette), AKM Predict mock, NASA EDA panel |
| `docs/design/AKM_Health_Design_System_v1.0.docx` | Design-system and product document by The Bug Bang Theory | AKM-11 design system, input for AKM-32 submission material and review rules for AKM-36/37 |

## Which version wins, and why

| Topic | ZIP | Figma Make | Decision |
| --- | --- | --- | --- |
| AKM-33/34/35 | Implemented, with backend sync endpoint, migration and tests | Absent | **ZIP**, merged onto current `main` and translated to English |
| AKM-36 body map | Accessible native buttons, list alternative, NASA links, explicit limits. Includes a "muscles/bones" region with no measured metric, and shows no readings | Richer data panel (value, time, source, links to History/Register), cabin readings separate from the body. Values are hard-coded and the SVG regions are not native buttons | **Hybrid:** ZIP structure plus Make's data panel, wired to `/api/dashboard`. Region model from the design document: head → mood, chest → heart rate; sleep and cabin readings sit outside the anatomy. The region without a metric is removed |
| AKM-37 gamification | Absent | Participation points and achievements, but kept in local state with fixed dates | **Make design ported** and wired to the API: an activity counts only when a reading or completed follow-up exists in the last 24 h. The daily check-in is a local acknowledgement |
| Brand | Letter "A" | Orbit + pulse + star logo | **Make logo** used in the sidebar and favicon (`frontend/public/akm-mark.svg`) |
| Dark palette / full Make UI | — | Navy theme, AKM Predict, static charts | **Not ported.** It would replace API-backed P0 screens with mock data a few hours before submission. AKM Predict shows a trend with no model behind it, which the design document itself says must not be presented as a prediction |

## Safety rules applied (from the design document, section 9)

No points for normal readings; a low mood reading earns the same points as a high one. No penalties, no ranking between crew members, no prompts to measure outside the schedule, and points are never a health score. Missing data is shown as "Insufficient data", never as normal.

## Design-document statements that are now outdated

The document reviewed the Figma Make snapshot, not the repository. Before using it in the submission, update the following:

- "Dataset NASA pendente de seleção" / RF-13 not complete: `main` ships the credited NASA OSDR RR-1 excerpt (AKM-38/39).
- "Nenhuma chamada a API": the repository screens use the FastAPI backend; only the Make prototype is offline-mock.
- History and Registration "estado local": in the repository both persist through the API (and AKM-33 adds an offline queue).

## Verification on this branch

- Backend: Ruff clean, `pytest` **345 passed** (includes the new AKM-33 sync tests; one invalid ZIP test was fixed — CO₂ is cabin-only, so the unknown-astronaut case now uses a personal metric).
- Frontend: `tsc` + Vite build OK; node tests 40/40; navigation, AKM-34/35 logic and AKM-33 outbox tests pass.
- Headless Chrome at 1280 px and 360 px: body map and self-care journey render with API data and no console errors. A manual mood reading (value 2) plus the check-in produced 35 points; keyboard selection of the head region showed that reading.
- **Not done:** screen-reader review, real offline/IndexedDB end-to-end test (AKM-33 step 5–6 of `akm-33-36-verification.md`), Research/Safety review of the new copy.
