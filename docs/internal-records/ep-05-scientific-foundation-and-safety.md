# EP-05 · Scientific foundation and safety

ODYSSEY-26 demonstrates a preventive investigation with four fictional profiles. The mission evidence is made of simulated or manual measurements. The NASA resources ground the choice of indicators and offer historical context. Clinical assessment and operational decisions belong to the team responsible for the mission protocol. Epic EP-05 (internal Notion page; Portuguese, not part of the submission) · Architecture (internal Notion page; Portuguese, not part of the submission)

## Task evidence

| Task | Deliverable | Evidence |
| --- | --- | --- |
| AKM-06 (internal Notion page; Portuguese, not part of the submission) | Five indicators, zone, unit, recording method, demonstration frequency and input limits. | [Measurement protocol](../akm-06-measurement-protocol.md) · [Contract tests](../../backend/tests/test_akm06_protocol_contract.py) · [PR #1](https://github.com/Arturvpf/akm-health/pull/1) |
| AKM-07 (internal Notion page; Portuguese, not part of the submission) | Matrix of the five hazards, possible evidence, hypotheses, uncertainty and informative checks. | [Sources and hypotheses](../scientific-sources.md) · [PR #2](https://github.com/Arturvpf/akm-health/pull/2) |
| AKM-08 (internal Notion page; Portuguese, not part of the submission) | Criteria, edge cases, labels, icons and human referral. | [Safety matrix](../akm-08-alert-safety.md) · [Classification tests](../../backend/tests/test_alerts.py) · [PR #8](https://github.com/Arturvpf/akm-health/pull/8) |
| AKM-09 (internal Notion page; Portuguese, not part of the submission) | Messages identified by context, action, restriction and source. | [Guidance library](../akm-09-guidance-library.md) · [PR #8](https://github.com/Arturvpf/akm-health/pull/8) |
| AKM-38 (internal Notion page; Portuguese, not part of the submission) | Selected public RR-1 telemetry with columns, unit, period, context and verification against the original publication. | [RR-1 provenance](#rr-1-provenance) · [NASA EDA](https://visualization.osdr.nasa.gov/eda/) |

### Limits of the demonstration rules

- Only `sleep_hours` activates the pattern detectors. The default rule uses two distinct, usable UTC dates within 48 h, each duration less than or equal to 80% of the synthetic baseline. The collective one requires at least two affected profiles in the same two UTC periods. The numbers are demo parameters. Heart rate, mood and temperature give context.
- CO₂ can support an `unconfirmed` hypothesis when there is a collective sleep pattern, an earlier reference and two valid readings that vary in the same direction and align with the periods within the configured tolerance. Routine, individual factors and collection remain possible explanations. `suspect` data stay in the history and are excluded from the classification evidence.
- Green represents the absence of a pattern with sufficient data for the scope. Yellow represents an experimental pattern to verify. Gray represents insufficient coverage. Red (`critical`) is reserved for the P0 legend, with `legend_only=true` and a reference to the protocol. The adapter presents text, icon, color and reason, and preserves the classification when it flags new measurements.

[Individual detector](akm-21-individual-detector.md) · [Collective detector](akm-22-collective-detector.md) · [Alert presentation](akm-24-alert-presentation.md)

## RR-1 provenance

**NASA Open Science Data Repository (OSDR), Environmental Data Application (EDA), Rodent Research-1 (RR-1 / SpaceX CRS-4).** The published environmental series separates the ISS cabin from the ground control. The observation window runs from **20/09/2014 03:59 UTC to 01/11/2014 03:54 UTC** and includes samples before the payload launch and after its return. The model of each sensor is not identified in the exports or in the telemetry response consulted. [Mission metadata](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/) · [Published telemetry](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/)

| CSV field | NASA API field | Intended use |
| --- | --- | --- |
| `Controller_Time_GMT` | `time` | Observed time in GMT/UTC. Preserve native precision. |
| `Temp_degC_ISS` | `temperature_iss` | ISS cabin temperature in °C. |
| `RH_percent_ISS` | `humidity_iss` | ISS cabin relative humidity in %. |
| `CO2_ppm_ISS` | `co2_iss` | ISS cabin CO₂ in ppm. |
| `Temp_degC_Ground`, `RH_percent_Ground`, `CO2_ppm_Ground` | `temperature_ground`, `humidity_ground`, `co2_ground` | Ground controls in the same units, identified as their own series. |

### Export check

Open the EDA portal and select **Data Tables → RR-1**. Use **CSV** on the telemetry, radiation and summary tables. Compare the telemetry with the official API by time at the CSV's precision and by the six values of each row. For radiation, compare the daily values to two decimal places and recompute the accumulated total from the API's daily total before rounding. For the Summary, recompute maximum, minimum, mean, sample standard deviation and median. [EDA portal](https://visualization.osdr.nasa.gov/eda/) · [Official tutorial](https://github.com/nasa/OSDR_Tutorials/blob/main/source/pages/guides/environmental_data_application.md) · [Daily radiation series](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/radiation_data/)

On 14/11/2026 (Fortaleza), the telemetry downloaded from the API matched the **12,087 times and 72,522 values** of the exports received. Radiation matched on 39 days at the CSV's precision. The 50 summary statistics matched to two decimal places. At the first observation, `2014-09-20T03:59:00Z`, the ISS fields report **24.10 °C**, **39%** relative humidity and **2,641 ppm** of CO₂. The selection for the P0 integration uses only the cabin environmental variables. The original unit label of the accumulated radiation and the interpretation of the sum are recorded in AKM-38. [Telemetry API](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/) · AKM-38 audit (internal Notion page; Portuguese, not part of the submission)

| Export received | SHA-256 of the checked copy |
| --- | --- |
| `RR-1_EDA_Telemetry_table.csv` | `6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805` |
| `RR-1_EDA_Radiation_table.csv` | `766555cabeb9c5bf101d542acfeb13cef2e9d1e20869908311d6045224095c2b` |
| `RR-1_EDA_Summary_table.csv` | `a1da2c751ef8b246832e131553d7fff4a229b36fe8c684960786aa784b4dc4c0` |

The hashes identify the files received. Cite NASA OSDR EDA, RR-1, the series URL, the access date and the tool version when identified. The OSDR redistribution terms refer to NASA's policy, which describes general CC0 conditions for data from NASA-led missions. The verification found no specific license statement in the exports and responses examined. Access to the files remains through the official channels. [OSDR terms](https://science.nasa.gov/reference/osdr-help-terms-and-conditions/#data-redistribution) · [NASA scientific data licenses](https://science.data.nasa.gov/about/license) · [Citation guidance](https://science.nasa.gov/reference/osdr-faq/)

## Technical review of the integrations

| Integration | Verified evidence | Acceptance to exercise in the integration |
| --- | --- | --- |
| Alerts (AKM-21/22/24) | Detectors and presentation on `main`. The collective scenario produces three affected profiles, an `unconfirmed` environmental hypothesis and a yellow alert. The tests cover insufficiency, suspect readings, overlapping days, green with data and reserved red. | Validate on the dashboard and in the investigation the scope, coverage, times and the combination of text, icon and color. [AKM-24 presentation](akm-24-alert-presentation.md) · [PR #12](https://github.com/Arturvpf/akm-health/pull/12) · [PR #13](https://github.com/Arturvpf/akm-health/pull/13) |
| Guidance (AKM-14/16/26) | Library technically reviewed against states and scenarios. Each message has an ID, condition, restrictions and reference. The selection of texts for `guidance` awaits the educational review planned in AKM-09 and the investigation integration. | Check the guidance returned for each context, its origin and the manual referral when applicable. [AKM-09 library](../akm-09-guidance-library.md) · AKM-26 (internal Notion page; Portuguese, not part of the submission) |
| NASA (AKM-39) | `GET /api/nasa/references` delivers three HRP references and, after AKM-39, 864 values of the RR-1 excerpt with state `imported`. Absence/invalidity of the history keeps the `not_imported` fallback. | Reproduce the local load and check provenance and the separate historical panel per [AKM-39](../akm-39-nasa-references.md) and [data sources](../data-sources.md), preserving unit, series, mission and native time. The ODYSSEY-26 records remain identified as `manual` or `synthetic`. [Fallback test](../../backend/tests/test_seed.py) · AKM-39 (internal Notion page; Portuguese, not part of the submission) |

### Local reproduction

With the dependencies installed as in the [README](../../README.md), run at the repository root:

```sh
python scripts/check.py
python scripts/demo_individual_detection.py
python scripts/demo_collective_detection.py
python scripts/demo_alerts.py
```

The examples use the ODYSSEY-26 seed. In the collective scenario, A1, A2 and A3 are in `attention` and A4 is `normal`. The detector presents 680 ppm as the reference, 950/980 ppm as aligned readings and two unconfirmed hypotheses. The presentation also exercises missing data and the reserved-state legend. [Synthetic data and scenarios](synthetic-data.md)
