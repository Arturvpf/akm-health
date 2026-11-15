# EP-02 · Frontend delivery and English UI verification

[EP-02 on Notion](https://app.notion.com/p/4189432b222281588da7c8695ed4798b) · [UX brief](https://app.notion.com/p/4189432b222281f195b5d4f9926ce93a)

| Task | Delivery and evidence |
| --- | --- |
| AKM-10 · Wireframe | [PR #19](https://github.com/Arturvpf/akm-health/pull/19) and [prototype walkthrough](akm-10-12-wireframes-and-shell.md). |
| AKM-11 · Design system | [PR #23](https://github.com/Arturvpf/akm-health/pull/23) and [accessible components and states](akm-11-accessible-design-system.md). |
| AKM-12 · Navigation shell | [PR #19](https://github.com/Arturvpf/akm-health/pull/19) and the navigation and wireframe regression tests. |
| AKM-13 · Dashboard | [PR #25](https://github.com/Arturvpf/akm-health/pull/25) and [API-connected dashboard evidence](akm-13-crew-dashboard.md). |
| AKM-14 · Register | [PR #26](https://github.com/Arturvpf/akm-health/pull/26) and [registration and error-recovery evidence](akm-14-measurement-forms.md). |
| AKM-15 · History | [PR #24](https://github.com/Arturvpf/akm-health/pull/24) and [history, trends and chart alternatives](akm-15-history-trends.md). |
| AKM-16 · Investigation | [PR #27](https://github.com/Arturvpf/akm-health/pull/27) and [investigation and follow-up walkthrough](akm-16-investigation-routine-ui.md). |
| AKM-39 · NASA integration | [PR #28](https://github.com/Arturvpf/akm-health/pull/28) and [references, historical data and provenance](akm-39-nasa-references.md). |

The React app uses English across its four routes, including navigation, visible and accessible labels, forms, validation, chart text, and built-in investigation narratives. English formatting uses UTC for observation and recording times. The frontend renders translations for existing and new server-generated narratives while keeping the original data and audit trail. The AKM-10 prototype remains available in Portuguese and is labeled accordingly.

## Integrated verification

The English UI was run in Chromium with FastAPI and a temporary SQLite database. The relative dates used to seed the test are described in the [AKM-16 walkthrough](akm-16-investigation-routine-ui.md).

1. Open Dashboard and confirm that the crew and NASA historical references are displayed.
2. Run a crew investigation. Confirm the English findings, unconfirmed hypothesis and suggested cabin CO₂ check. Run it again and confirm that the original investigation ID is reused.
3. In Register, submit an empty CO₂ value and verify that focus moves to the invalid field. Enter 850 ppm and a recent observation time with UTC offset. Submit with Enter and check the receipt. The check remains pending.
4. Open History, filter to Habitat and cabin CO₂, and verify the 850 ppm entry with the Manual entry label.
5. Return to Investigation, select the pending check, link the new reading and reanalyze. Verify a new investigation ID.

This run produced investigation #1, a replay of #1, measurement #30, completed check #1, and investigation #2. On all four pages at 320 and 1280 px, axe reported zero WCAG 2/2.1 A or AA violations in the states checked, and the page had no horizontal overflow. The previously reported manual Narrator acceptance covered the Portuguese registration screen. The translated text still needs manual screen-reader verification. The wider acceptance scenarios are tracked in [AKM-30](https://app.notion.com/p/4189432b222281b799e9ca40f6f3ec9c).

Regression commands, with the backend environment active and npm dependencies installed:

```sh
python scripts/check.py
node --test frontend/scripts/test-dashboard.cjs frontend/scripts/test-registration.cjs frontend/scripts/test-history.cjs frontend/scripts/test-investigation-api.cjs frontend/scripts/test-wireframe.cjs
npm --prefix frontend run test:navigation
npm --prefix frontend run build
```

## Registration copy review

The English instructions were checked against [AKM-06](akm-06-measurement-protocol.md) and [AKM-09](akm-09-guidance-library.md).

| Metric | Reviewed instruction |
| --- | --- |
| Sleep | Actual sleep in the last completed period, in hours, with wake-up time and UTC offset. An unknown duration is left unrecorded. |
| Heart rate | One monitor reading in bpm with its observation time. The form suggests comparable conditions, preferably at rest, and does not verify the device or activity. |
| Emotional well-being | Subjective 1–5 check-in, presented as a demonstration scale without clinical validation. |
| Cabin CO₂ | Simulated cabin air, ppm, observation time and source. Unstable readings are marked suspect. |
| Cabin temperature | Air inside the simulated habitat, °C, and observation time. |

This comparison records technical conformance to the project protocol. The team's Research/Safety sign-off for publication is tracked in [AKM-09 on Notion](https://app.notion.com/p/4189432b2222813a8c44c7aba6e1f89e).
