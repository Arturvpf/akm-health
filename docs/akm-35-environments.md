# AKM-35 — Mission environments and scientific context

Page: `#/environments`. Four **hypothetical** environments are selected through an accessible native control. The selection, persisted locally in the browser, also updates the texts and explanations in the Body map and the Comparator.

| Environment | Reference gravity | Context |
|---|---|---|
| Mars surface | 3.73 m/s² ≈ 0.38 g | Partial gravity, distance, closed habitat |
| Lunar surface | 1.62 m/s² ≈ 0.165 g | Partial gravity, controlled environment |
| Earth analog | 9.82 m/s² = 1 g | Simulated isolation; does not reproduce space exposure |
| ISS / orbit | Microgravity, no number computed in the MVP | Closed environment, orbital adaptation, isolation |

Numeric source for Mars and Earth: [NASA NSSDCA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) (mean surface gravity 3.73 m/s² against 9.82 m/s² for Earth, ratio 0.380; last updated 19 May 2025). Numeric source for the Moon: [NASA NSSDCA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) (1.62 m/s²; last updated 11 January 2024). Taxonomy of the five NASA hazards: https://www.nasa.gov/hrp/hazards/ . The ISS microgravity classification **does not imply that local physical gravity is literally zero**.

## Architectural limit

This is a **local counterfactual view**; the mission persisted in the backend remains `ODYSSEY-26`, `destination=mars_surface`, with its synthetic indicators and observations. The selection does not reclassify readings, does not adjust medical thresholds, does not change `GET /api/dashboard` and does not mix telemetry from different environments. External NASA data stay in `GET /api/nasa/references` with separate provenance.

## Verification

- Select Moon → lunar gravity and explanation appear.
- Select ISS → microgravity explanation with no fictitious g value.
- Go back to Mars → the Martian context reappears and the backend and database remain unchanged.
- The selection is preserved after a reload, if the browser allows storage.
