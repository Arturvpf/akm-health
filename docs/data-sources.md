# Data sources and provenance

This inventory describes the artifacts used by the current application, not every source proposed in earlier plans. See [AKM-39](akm-39-nasa-references.md) and the AKM-38 audit (internal Notion page; Portuguese, not part of the submission).

| Category | Local artifact / origin | Purpose |
| --- | --- | --- |
| Mission synthetic | backend/app/seed.py; backend/tests/fixtures/odyssey-26-scenarios.json | Four fictional profiles, baselines, deterministic observations and missing/suspect cases |
| Mission manual | POST /api/measurements → SQLite | User-entered observations of the fictional mission, never real patient data |
| NASA reference | backend/data/nasa/hrp_catalog.json | Three NASA HRP links: hazards, risks and ongoing research; no quantitative patient data |
| NASA historical | backend/data/nasa/reference.json | Read-only RR-1 ISS environmental archive, outside the mission tables and rule inputs |
| Planetary context | backend/app/mission_environment.json | Fictional destination mars_surface; static NASA gravity reference 0.38 Earth g (Mars mean 3.73 m/s² ÷ Earth 9.82 m/s², NASA NSSDCA Mars Fact Sheet, last updated 19 May 2025), not measured gravity. Lunar value 1.62 m/s² from the NSSDCA Moon Fact Sheet (last updated 11 January 2024) |

## Exact NASA historical resource

NASA Open Science Data Repository (OSDR), Environmental Data Application (EDA), **Rodent Research-1 (RR-1 / SpaceX CRS-4)** environmental telemetry. The included channels are labeled ISS in the source; the sensor models and EDA version are unspecified. This is not individual astronaut health data, current cabin telemetry, external Mars weather, ground-control data or a clinical safety standard.

- [Mission metadata](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/)
- [Exact telemetry API](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/)
- [EDA portal / export](https://visualization.osdr.nasa.gov/eda/)
- [Official export tutorial](https://github.com/nasa/OSDR_Tutorials/blob/main/source/pages/guides/environmental_data_application.md)
- Local excerpt: **2014-10-01 00:00–23:56 UTC**, 288 timestamps, three channels = 864 scalar readings.
- AKM-39 records access and comparison on 15 November 2026; the broader source audit is dated 14 November 2026. These are historical project evidence dates, not an assertion that this task downloaded the entire source again.

| Original CSV column | Local field | API observation parameter/unit |
| --- | --- | --- |
| Controller_Time_GMT | observed_at | observed_at, UTC timestamp |
| Temp_degC_ISS | temperature_c | temperature_c, °C |
| RH_percent_ISS | relative_humidity_pct | relative_humidity_pct, % |
| CO2_ppm_ISS | co2_ppm | co2_ppm, ppm |

The importer selects rows on the date above, converts GMT timestamps to ISO 8601 UTC and parses the three numeric fields. It does not interpolate, resample, synthesize values or import ground channels/radiation. The response expands each row to three observations with source URL, mission, context, instrument limitation and unit. The displayed 288-point table is per indicator.

Audited input: **RR-1_EDA_Telemetry_table.csv**, SHA-256:

~~~text
6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805
~~~

The CSV is not checked into this repository. The importer deliberately refuses a different byte hash, including a newly formatted export. Do not modify the expected hash simply to make an unknown export pass; reconcile it with the NASA source and update the provenance audit first.

## Reproduce or restore

No download/import is needed for normal startup: both JSON artifacts are versioned and loaded from backend/data/nasa relative to the module, independent of process working directory. With the standard local API running, GET /api/nasa/references should return three scientific_references, historical_data_status=imported and 864 historical_series entries. The first CO₂ observation is 2975 ppm at 2014-10-01T00:00:00Z.

To independently regenerate the excerpt:

1. Open the EDA portal, Data Tables → RR-1, then export the telemetry table as CSV. Keep the original downloaded bytes.
2. Compare its hash with the audited value. PowerShell: Get-FileHash -Algorithm SHA256 -LiteralPath <csv-path>. On Linux: sha256sum <csv-path>; macOS: shasum -a 256 <csv-path>.
3. Back up any local customization of reference.json. The following command **overwrites only the local NASA excerpt**, not the mission database:

~~~powershell
# Windows, repository root; substitute the actual export path
.\.venv\Scripts\python.exe scripts/import_rr1_reference.py <csv-path>
~~~

~~~sh
# Bash/Zsh with the environment active
python scripts/import_rr1_reference.py <csv-path>
~~~

4. Run the backend tests and query the NASA endpoint; compare timestamps and values with the source. git diff should show no semantic change for the audited export. Do not expect byte-identical new exports from an upstream service.
5. To restore without reimporting, obtain these artifacts from a trusted checkout of the same repository revision; preserve local backups before replacing files.

Missing/invalid historical JSON returns not_imported and an empty series, with no fabricated NASA values. Missing/invalid HRP catalog causes HTTP 503. Neither fallback inserts or changes mission measurements. No NASA request occurs on the API's critical read path.

## RR-1 radiation and CO₂ context (historical, never detector input)

Two additional local excerpts describe the same NASA OSDR EDA **Rodent Research-1** experiment. They are shown only in the NASA references panel and never feed the detector, alerts or any dose for the fictional crew.

| Artifact | Source export (SHA-256) | Content | Transformation |
| --- | --- | --- | --- |
| `backend/data/nasa/radiation.json` | `RR-1_EDA_Radiation_table.csv` (`766555cabeb9c5bf101d542acfeb13cef2e9d1e20869908311d6045224095c2b`) | 39 daily rows, 21 September to 29 October 2014: `gcr_mgy_per_day`, `saa_mgy_per_day`, `total_mgy_per_day` (all mGy/day) and `accumulated_mgy` (**cumulative dose in mGy, not mGy/day**) | Column rename and ISO dates only; no interpolation or resampling |
| `backend/data/nasa/co2_context.json` | `RR-1_EDA_Telemetry_table.csv` (`6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805`, the audited export above) | Full-series ISS CO₂: mean 3197.27 ppm, median 3192, minimum 1862, maximum 4667, n = 12,087, 20 September to 1 November 2014 | Statistics recomputed from the telemetry export; the importer refuses to write unless they reproduce the audited figures. `RR-1_EDA_Summary_table.csv` (`a1da2c751ef8b246832e131553d7fff4a229b36fe8c684960786aa784b4dc4c0`) was supplied by the team as the origin of these figures; the telemetry recomputation above is the independent check |

Exact API URL: **not confirmed**. The EDA mission endpoint (`/eda/api/missions/RR-1/`) lists only metadata and a link to the OSDR payload page, with no radiation endpoint. The radiation table is therefore cited as the exportation of the RR-1 radiation table from the [EDA portal](https://visualization.osdr.nasa.gov/eda/). Access date of the export: **TODO: record the date the export was downloaded**.

To import (the importer refuses any file whose SHA-256 differs, writes nothing unless every check passes, and fails with an explicit message if the export layout differs from the expected one):

~~~sh
# from the repository root, with the original exports
python scripts/import_rr1_radiation.py <RR-1_EDA_Radiation_table.csv> --telemetry <RR-1_EDA_Telemetry_table.csv>
~~~

Until the files exist, `GET /api/nasa/references` returns `radiation_status: "not_imported"` and `co2_context_status: "not_imported"` with `radiation: null` and `co2_context: null`; the interface says so and shows no values. Do not use these numbers as a clinical or safety threshold.

## Reference and planetary links

The catalog links [NASA HRP hazards](https://www.nasa.gov/hrp/hazards/), [risks](https://www.nasa.gov/hrp/risks/) and [ongoing research](https://www.nasa.gov/hrp/ongoing-hrp-research/). Planetary context links [NASA fact sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and [Mars facts](https://science.nasa.gov/mars/facts/). These sources support context and educational attribution, not the synthetic sleep threshold or causal claims. MEDA and NOAA are not imported datasets in this checkout.

## Attribution and reuse terms

Credit NASA OSDR EDA, RR-1, the exact telemetry URL, observation interval, transformation and access/audit date when reusing this excerpt. [OSDR redistribution terms](https://science.nasa.gov/reference/osdr-help-terms-and-conditions/#data-redistribution) refer to NASA policy and request source attribution.

The [NASA Science Data Licenses policy](https://science.data.nasa.gov/about/license), consulted for AKM-31 on 15 November 2026, describes CC0 for NASA-led mission data unless a restrictive notice applies. The prior AKM-38/39 audit found no separate restrictive notice in the consulted export/API response. This repository relies on that documented interpretation for the credited excerpt; it does not relabel every NASA web page, image, logo or third-party contribution as CC0. Review source-specific notices when changing artifacts. See [third-party notices](third-party-notices.md).
