# AKM-39 · NASA references and historical telemetry

[Task](https://app.notion.com/p/4189432b222281cf9691c434b76dc1b7) · [AKM-38 source audit](https://app.notion.com/p/4189432b2222817c8ebdc3a1be168b8a)

Dashboard and Investigation each display the NASA Human Research Program catalog, Mars destination context and a separate chart for Rodent Research-1 (RR-1). Choose carbon dioxide (ppm), air temperature (°C) or relative humidity (%) to change the chart. Expand **View 288 observations** to read the exact values and UTC timestamps. The known source and observation times are available in the UI. The export identifies the channels as ISS environmental telemetry and leaves the instrument model unspecified.

## Data and provenance

NASA Open Science Data Repository (OSDR), Environmental Data Application (EDA), **Rodent Research-1 environmental telemetry**, accessed 15 November 2026. The selected excerpt covers 1 October 2014, 00:00–23:56 UTC, with **288 timestamps and 864 readings**. The date was selected to show a continuous day within the mission interval while keeping the offline reference small. Each record corresponds to an original observation. [Direct NASA API](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/) · [EDA portal and CSV export](https://visualization.osdr.nasa.gov/eda/) · [Export instructions](https://github.com/nasa/OSDR_Tutorials/blob/main/source/pages/guides/environmental_data_application.md)

The input is `RR-1_EDA_Telemetry_table.csv`, SHA-256 `6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805`. `Controller_Time_GMT` becomes an ISO 8601 UTC timestamp. `Temp_degC_ISS`, `RH_percent_ISS` and `CO2_ppm_ISS` retain their original values and units. The 864 readings and all timestamps were checked against the direct NASA API at CSV precision. Ground controls, radiation and MEDA are outside this excerpt. The EDA version and specific sensor models are unspecified in the source consulted.

OSDR distributes its data under the NASA Science Information Policy and requests attribution. The general NASA Science Data Licenses policy applies CC0 to NASA-led mission data without a restrictive notice. The consulted export and API response carry no separate license or restrictive notice. This repository includes the credited one-day data excerpt. [OSDR redistribution and citation terms](https://science.nasa.gov/reference/osdr-help-terms-and-conditions/#data-redistribution) · [NASA Science Data Licenses](https://science.data.nasa.gov/about/license)

Mars surface gravity and outdoor atmosphere appear with links to NASA planetary sources. The cabin history is an ISS archive. ODYSSEY-26 mission observations remain manual or simulated and have their own labels. The archive is contextual and is outside the inputs to the investigation and alerts. [NASA Mars facts](https://science.nasa.gov/mars/facts/) · [NASA planetary fact sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/)

## Reproduction

Use the [README](../README.md) to start FastAPI and Vite. The checked-in files in `backend/data/nasa/` support offline use after dependency installation.

1. Open `/api/nasa/references`. Expect three HRP entries, `historical_data_status: "imported"` and 864 RR-1 entries. The first CO₂ row is 2,975 ppm at 00:00 UTC.
2. Open `/#/dashboard` and `/#/investigacao`. Locate **NASA references**, select a historical indicator and expand the observations table. Compare with `/api/measurements`, which serves mission data only.
3. To regenerate the checked-in excerpt from the independently audited NASA export, run `python scripts/import_rr1_reference.py <path-to-RR-1_EDA_Telemetry_table.csv>`. The script checks the original CSV hash before writing the JSON.
4. Run `python scripts/check.py` and `npm --prefix frontend run test:dashboard`. The backend tests verify exact example readings, independence from the mission seed, and fallback for missing or invalid history.

Missing or invalid `reference.json` leaves the HRP catalog available and returns `not_imported` with an empty series. Invalid historical data is logged by the server. A missing or invalid HRP catalog produces HTTP 503 and a retry state in the interface.

## Browser evidence

Chromium with a local SQLite demo verified both routes, keyboard selection of all three indicators, the observations table, retry after HTTP 503 and the HRP catalog when history is absent. The feature loaded with external requests blocked. The NASA section had no axe WCAG 2/2.1 A or AA violations at 320 and 1280 px. [Dashboard capture](evidence/akm39/dashboard.png) · [Investigation capture](evidence/akm39/investigation.png)
