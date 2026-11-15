# AKM-14 · Guided measurement registration

The #/register route reads the mission and profiles from GET /api/dashboard and sends one measurement per POST /api/measurements. The existing HTTP/Python/TypeScript contract was preserved; there is no migration and no new endpoint.

## Behavior

- Five indicators: sleep (0–24 h), heart rate (>0 bpm), emotional well-being (integer 1–5), internal CO₂ (≥0 ppm) and internal air temperature (finite, including negative). These are technical validations, with no clinical thresholds. (Later tightened to plausibility ranges; see the measurement protocol.)
- A crew member is required for personal metrics, chosen only from API profiles. The habitat sends astronaut_id=null. The server derives measurement_zone and recorded_at.
- Empty values stay absent; zero is only accepted when entered and allowed. The numeric field accepts a decimal comma with no thousands separator.
- A date/time and an explicit UTC offset are required. The initial +00:00 offset is shown as UTC and can be changed; it is not inferred from the computer. Invalid calendar dates are rejected and the instant sent is normalized to UTC.
- Origin manual or synthetic, quality ok or suspect. Manual is still a record of this fictional demo. Historical NASA is not an origin option.
- Mission and destination come from the validated API context; the zone is shown automatically. There is no field for measured gravity, pressure or body/exterior temperature.
- MED-SLEEP/HR/MOOD/CO2/TEMP instructions adapted from the AKM-09 library and the AKM-06 protocol, with contextual NASA sources and explicit limits. The mood scale is not clinically validated.

## Confirmation and recovery

During the POST the fields are locked and the controller accepts only one submission. Only HTTP 201 with a valid response compatible with the payload produces a confirmation, with the ID, value, target, origin, quality, measured time and registration time shown separately.

HTTP 422 keeps the fields and ties recognized errors to the controls; general rejections ask the user to review the fields. HTTP 404 requires refreshing the mission/list and selecting the crew member again. Loading failures keep the draft, state that the context may be out of date and block submission until recovery. A database with no profiles allows registering the habitat after the context loads.

A network error, a 10 s timeout, 5xx, an unexpected status or an invalid/incompatible 201 response make the result **uncertain**. There is no automatic resend. The screen keeps and locks the draft, opens the history in a new tab and requires an explicit action from whoever checked for the absence before allowing another submission. The API offers no idempotency key for measurements: the human check does not guarantee deduplication against concurrent writers.

After saving, GET /api/dashboard is queried again. A failure in that query does not undo or hide the confirmed receipt. POST /api/investigations/run and the follow-up PATCH are never triggered by the form. The receipt guides the user to the dashboard/history and to continue the investigation separately.

**Editing:** fields are editable before submission. The contract has no PATCH/PUT for measurements; we do not offer changing a saved record. Registering another measurement is an explicit action after the receipt. Drafts are kept in memory during errors on this screen; leaving or reloading loses the draft and the local lock. Offline persistence and sync belong to AKM-33.

## Reproduction and checks

With the README dependencies installed:

1. Start the API and the frontend; for fictional profiles, use the seed as described in the README.
2. Open #/register, choose a crew member, Sleep, 5.2 h and a date/time with a time zone. Check the UTC conversion and save.
3. Check the receipt ID and times, look at the history/dashboard and verify that no investigation ran automatically.
4. Record CO₂ or temperature in the Habitat zone; try suspect quality and a simulated origin. Check the origins in the history.
5. Try an empty value, sleep outside 0–24, zero heart rate, an invalid time zone and an invalid calendar date. No record should be sent.
6. Interrupt the API or use an inconclusive response during the POST: check the uncertain state and the history before allowing a new submission.

Validation commands:

- python scripts/check.py — Ruff, backend and TypeScript.
- npm --prefix frontend run test:registration — validation of the five payloads, calendar/time zone, 201/422/404, uncertain failures, single flight, timeout, late responses, discard after unmount and real React rendering. It includes integration of frontend payloads with FastAPI/TestClient and a temporary SQLite database, a history/dashboard query, and an unchanged count of investigations/follow-ups.
- npm --prefix frontend run test:dashboard
- npm --prefix frontend run test:history
- npm --prefix frontend run test:wireframe
- npm --prefix frontend run test:navigation
- npm --prefix frontend run build

The integration uses the repository's .venv by default; PYTHON can point to another executable with the backend dependencies installed. Test databases are temporary; the development database is not changed.

## Browser validation — 15 Nov 2026

The code of commit 6cc023f was validated with Playwright 1.65.1 and Chromium Headless Shell 159, using the locally served Vite build and FastAPI with a test-only SQLite database. Edge and the interactive control timed out; the run in Chromium completed.

- Five registrations through the interface confirmed by the API: sleep, heart rate, mood, zero CO₂ and negative temperature. Exactly five write requests were observed, all POST /api/measurements; no automatic investigation or follow-up completion. No JavaScript errors.
- Visual inspection of the desktop, narrow phone and receipt captures: readable content, fields and actions shown without overlap. No horizontal overflow at 1440, 768, 390 and 320 px.
- Focus on the first invalid field when submitting empty, Tab from the value to the date/time and focus on the confirmed receipt. This covers spot checks of navigation and does not certify every keyboard combination.
- A simulated HTTP 422 in the browser transport: value preserved and focus on the rejected field. HTTP 404: submission blocked until refreshed and the crew member selected again. Network failure: draft locked, an explicit check before allowing a new submission and no automatic retry.
- axe-core 4.14.0 on the home screen at 390 px, WCAG 2 A/AA and 2.1 A/AA rules: zero violations, 26 checks passed and none incomplete. An automated audit does not replace human testing.

Evidence captures: [desktop](../evidence/akm14/desktop.png), [320 px](../evidence/akm14/mobile-320.png), [confirmation](../evidence/akm14/confirmation.png). The receipt and readings are exclusively from the fictional demo in a test database.

**Pending:** manual testing with a screen reader and a full human review of the keyboard interaction. No medical assessment or clinical validation was carried out. The documented functional/visual approval does not mean the PR was merged.
