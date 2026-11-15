# AKM-08 · Alert criteria and human review

Applies to the ODYSSEY-26 demonstration. Technical validation belongs to the input contract. An investigation status describes an experimental pattern within the evaluated scope. Clinical assessment and operational decisions belong to the team responsible for the mission protocol. [Architecture v2.0/v2.1](architecture-backend.md) · [AKM-06 protocol](akm-06-measurement-protocol.md) · [AKM-07 rationale](scientific-sources.md)

## Decision matrix

Assess data sufficiency first, then the sleep rule. A valid CO₂ reading can help choose a check when the environment changes within a comparable window. On its own, its value, temperature, heart rate and mood remain context observations in the P0 engine.

| Status | Demo condition | Label, color and icon | Action and limit | Source |
| --- | --- | --- | --- | --- |
| `insufficient_data` | Individual scope without a positive baseline, or without two recent, distinct, usable sleep readings. Crew scope with fewer than two profiles meeting those conditions in a comparable window. | **Insufficient data**, gray, information icon | State what is missing. If collection is feasible, request an observation that fills the gap. | DR-01/04 · [Architecture](architecture-backend.md) |
| `normal` | Sufficient data in the scope and no pattern that satisfies that scope's rule. An individual change can coexist with no crew pattern. | **No pattern under the demo rule**, green, confirmation icon | Show the window and the profiles actually evaluated. The result is limited to the rule and the data used. | DR-01/02/07 · [Architecture](architecture-backend.md) · [NASA HRR, sleep and performance](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100) |
| `attention` | In the individual scope, both valid readings are at or below 80% of the simulated baseline. In the crew scope, at least two profiles meet the rule in the same window. | **Experimental pattern to check**, yellow, attention icon | Show the finding, the readings and a next check. If a comparable CO₂ change exists, show the coincidence hypothesis as `unconfirmed`. Without a reliable environmental comparison, keep the sleep finding and state the gap explicitly. | DR-01 to DR-05 · [Architecture](architecture-backend.md) · [NASA HRR, sleep](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100) · [NASA OCHMO, CO₂](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/) |
| `critical` | Status reserved in the contract for a future approved operational protocol. No demo rule or measurement produces this status automatically. | **Follow mission protocol**, red, alert icon, shown only in the P0 legend | In a situation reported as urgent or covered by the mission protocol, direct the person to contact the designated responsible person without waiting for collection or reanalysis. The app keeps its experimental status. | DR-07 · [Architecture](architecture-backend.md) · [NASA HRR, medical conditions in mission](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=95) |

The inclusive 80% limit and the two-profile rule are software parameters defined by the architecture. The NASA sources support the relevance of the indicators and the mission context. An experimental status never authorizes diagnosis, prescription, prognosis, equipment changes or a statement of safety. Historical RR-1 telemetry and external Mars data serve as contextual reference and stay outside the mission calculation.

## Data, errors and presentation

- Two readings must represent distinct sleep periods within the window configured by the engine. Duplicating a reading or repeating the same period does not increase coverage. A sleep reading of 0 h, if actually observed and usable, counts as a value. Absence remains absence.
- `quality=suspect` keeps the reading in the history and excludes it from the evidence that supports the classification. If enough data remain, classify from the remaining data. If only one usable night remains for a profile, declare insufficiency in the individual scope. An isolated CO₂ problem reduces the environmental evidence while keeping the sleep finding when it is supported.
- An HTTP error is an interface state. On a 422, keep the form and point to the invalid field. When the service is unavailable, keep the last confirmed result visible, labeled with its time. New measurements stay flagged until an explicit reanalysis. A network error, new data or an invalid reading never changes the classification of the last analysis on its own.
- Show text and an icon in addition to color, along with the scope, reason, time and reading window. Report how many profiles have sufficient data. Separate the observed finding, the hypothesis and the suggested check.

## Human referral

1. For `attention`, offer one feasible check and explain what it could clarify. For `insufficient_data`, point to the first relevant gap or indicate that the collection source is unavailable.
2. If the pattern persists after a follow-up, repeated collections fail, or the person asks for help, offer review by the mission's responsible person. The summary gathers the scope, data and timestamps, quality, gaps and checks already done. Sending it is manual.
3. When the mission protocol calls for immediate referral, follow the defined human channel. The application does not decide whether a real occurrence is serious, and the demo follow-up is not a prerequisite for seeking help.

AKM-04 flow · [NASA HRR research on medical conditions in mission](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=95)

## Check against the synthetic scenario

Compare the two nights in the [AKM-28 fixture](../backend/tests/fixtures/odyssey-26-scenarios.json) against 0.8 × baseline. The crew readings place A1, A2 and A3 in `attention` in the individual scope and support the crew finding. A4 has sufficient data and does not trigger the individual rule. In the individual scenario, A1 triggers the rule and three profiles stay outside it. In the insufficient scenario, only A1 has two comparable nights, and the crew scope stays at `insufficient_data`.

| Edge case | Expected result |
| --- | --- |
| Baseline 8 h, nights of 6.4 h and 6.4 h | Individual `attention`. Equality is included. |
| Baseline 8 h, nights of 6.4 h and 6.41 h | Individual `normal` for the sleep rule, with sufficient data. |
| Two entries for the same period, or one of the two with suspect quality | Individual `insufficient_data` if only one usable period remains. |
| One profile with a change and other comparable profiles without one | `normal` for the crew pattern, with the individual finding preserved when queried. |
| A1/A2/A3 with a sleep pattern and CO₂ absent, suspect or outside the window | Crew `attention` from sleep, with no environmental hypothesis supported by those readings. |
| CO₂ change without a sleep pattern, with sufficient sleep | `normal` under the sleep rule. Present the environmental data as context. |
| A1/A2/A3 with a change and comparable CO₂ in the same window | Crew `attention` with an `unconfirmed` hypothesis. Prioritize a new CO₂ measurement. |
| Request for human review or protocol referral | Provide the applicable human channel. No automatic promotion to `critical`. |

This check validates the consistency of the demo criteria. The Research/Safety review and the engine tests are separate steps, documented in AKM-21/24/29.
