# AKM-06 — NASA-backed demo measurement protocol

Source of truth: the team's internal Notion workspace (Portuguese, not part of the submission)

| Metric | Meaning | Unit | Zone | Input method | Demo collection cadence |
| --- | --- | --- | --- | --- | --- |
| sleep_hours | Estimated *actual* sleep hours last completed period (not time in bed) | h | astronaut | self-report or synthetic seed after waking | once per completed sleep period |
| heart_rate_bpm | Point heart rate, ideally at rest in a comparable condition, not daily average | bpm | astronaut | manual/hypothetical monitor | one comparable reading per window |
| mood_score | Self-rated emotional wellbeing, ordinal 1=very poor through 5=very good | score_1_to_5 | astronaut | self-report UI | one daily demo check-in |
| co2_ppm | CO2 concentration of simulated **internal** cabin air | ppm | habitat | synthetic/manual environmental entry | each demo environmental window or next-check |
| cabin_temp_c | Simulated **internal** cabin-air temperature, not body or Mars exterior | C | habitat | synthetic/manual temperature reading | each demo environmental window |

**The frequencies above are UX choices, not NASA flight protocols.** No real sensor connection, clinical validation or medical diagnosis.

## Guided form requirements

- Sleep: select astronaut; enter hours slept (0..24) and end-of-sleep time with timezone. Unknown value means **no record**, never 0.
- Heart rate: select astronaut; enter BPM and timestamp. Suggest rest/comparable conditions, but the schema **does not verify** physical activity or instrument reliability; no automated cardiac diagnosis.
- Mood: ask “How would you rate your emotional well-being right now?” 1 muito ruim, 2 ruim, 3 neutro, 4 bom, 5 muito bom. This is a demo-only ordinal rating, not validated psychometrics.
- CO2 and temperature: select habitat, with NULL astronaut_id; keep readings from the fictitious cabin separate from actual NASA/ISS data and Mars exterior.
- Mark sources synthetic vs manual, quality ok vs suspect. Suspicious entries remain visible but cannot prove clinical risk. No real-time telemetry claim.

## Contract validation (not medical safety thresholds)

- kind only five P0 metrics; canonical units h/bpm/score_1_to_5/ppm/C; values finite, reject NaN/Inf.
- sleep_hours in [0,24]; heart_rate_bpm in [20,250]; mood_score integer 1..5; co2_ppm in [0,40000]; cabin_temp_c in [-20,60] °C. These are plausibility limits that catch typing mistakes; they are not clinical thresholds.
- New observations cannot be dated more than 10 minutes in the future (clock drift allowance), on the direct, sync and contract-validation routes. Request bodies larger than 64 KiB get 413.
- Individual measures require astronaut_id; environment requires NULL; server derives astronaut/habitat zone, creates recorded_at UTC. measured_at must carry timezone (converted UTC).
- Absence is never zero; quality suspect is insufficient evidence; coincidence of collective sleep changes with habitat CO2 shifts is not causal.
- A NASA historical observation must keep native time and public source provenance and must not be inserted as a fictional crew measurement.
- No automatic clinical critical/red alerts or prescriptions from synthetic heuristics.

## NASA source traceability

- NASA sleep/circadian: https://www.nasa.gov/directorates/esdmd/hhp/risk-of-performance-decrements-and-adverse-health-outcomes-resulting-from-sleep-loss-circadian-desynchronization-and-work-overload/
- NASA wearable studies, sleep and HR: https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/
- NASA behavioral health and sleep: https://www.nasa.gov/hrp/human-factors-and-behavioral-performance/hfbp-risks/
- NASA closed environments: https://www.nasa.gov/hrp/hazards/
- NASA physiology risks: https://www.nasa.gov/hrp/risks/
- NASA EDA/OSDR historical ISS environmental telemetry: https://visualization.osdr.nasa.gov/eda/

These sources establish why the project tracks each indicator. The 20% sleep change is a synthetic parameter of the demonstration. AKM-38 verified the RR-1 exports, and the EP-05 evidence records the source, context, units, file checks and metadata limits.
