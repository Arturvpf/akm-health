# AKM-10 and AKM-12 · ODYSSEY-26 prototype and navigation

AKM-10 · Wireframes (internal Notion page; Portuguese, not part of the submission) · AKM-12 · Shell (internal Notion page; Portuguese, not part of the submission) · UX brief (internal Notion page; Portuguese, not part of the submission) · [Investigation flow](akm-04-investigation-flow.md)

## AKM-10 · Navigable prototype

The original AKM-10 wireframe HTML (a standalone prototype, no longer shipped in this repository) was opened directly in the browser or through the shell link. Dashboard, Register, History and Investigation share fictional data kept in memory. The scenario selector lets you exercise synthetic data, loading, missing data and connection failure. The history shows where each observation came from, keeps suspect readings in the table and shows sleep duration per UTC day with an individual baseline and explicit gaps.

1. In Register, try entering 25 h of sleep and check the message and that the value is kept. Record a valid value and look at the History table.
2. In Investigation, run the crew scenario. Check the finding, the sources, the unconfirmed hypothesis and the next check. Completion stays disabled until a new compatible reading is recorded.
3. Record the CO₂ recheck, complete the verification and re-analyze. Check that the linked measurement appears among the evidence. Repeat in Aurora's individual scope using a sleep reading.
4. Try the no-data scenario and loading in the top selector. Simulate a connection failure after an investigation and check that the last result stays visible.
5. Switch from crew to individual and back. Check that the crew verification is still recorded in its own scope. With a compatible reading saved, try to complete during the simulated failure and check that completion is only possible after reconnection.
6. In the no-data scenario, record two sleep readings for the same profile on the same day and verify that the crew scope still has insufficient data.
7. Navigate by keyboard and check the focus after changing a filter and on entering the scrollable chart and table. Check the four screens from 320 px.
8. Generate a crew verification, switch to Lyra in the individual scope and go back to the Dashboard. The crew pending item must stay visible and its button must open the crew follow-up. Also generate individual verifications for Aurora and Orion: the counter must show three pending items without duplicating the selected one. Completing one of them must keep the others.

The Dashboard gathers the pending checks stored per scope together with the current selection, which can hold changes not yet stored by the scope switch. Each item identifies the scope or crew member and opens the matching follow-up. The scenario reset clears this simulated agenda. The automated regression runs the HTML's original script through its events in a minimal DOM; it checks the logic and the generated HTML, and does not replace visual inspection in the browser.

## AKM-12 · React shell

```sh
npm --prefix frontend ci
npm --prefix frontend run test:navigation
npm --prefix frontend run test:wireframe
npm --prefix frontend run build
npm --prefix frontend run dev
```

Open `http://127.0.0.1:5173/`. The Dashboard queries the mission state from the local API. History queries readings with filters, quality and trends. Investigation uses the same API for the experimental analysis and for tracking checks. The wireframe opens from a single copy in `frontend/public/`. [AKM-15 History](akm-15-history-trends.md) · [AKM-16 Investigation](akm-16-investigation-routine-ui.md)

Links support direct navigation, back and forward. The active item uses `aria-current` and changing page moves focus to the main content. Unknown hashes show the Dashboard.
