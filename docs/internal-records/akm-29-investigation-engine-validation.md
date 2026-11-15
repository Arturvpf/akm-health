# AKM-29 · Investigation engine validation

The suite runs the experimental ODYSSEY-26 rules through the FastAPI API with a temporary SQLite database and a fixed clock at 14/11/2026 08:00 UTC. The tests register the measurements over HTTP, check the investigation result, relate the evidence to the stored audit and verify the dashboard projection. Existing unit tests cover window limits, quality, selection and presentation. Task AKM-29 (internal Notion page; Portuguese, not part of the submission) · Canonical architecture and criteria (internal Notion page; Portuguese, not part of the submission)

## Results on ODYSSEY-26

| Case | Inputs | Observed result |
| --- | --- | --- |
| Collective trend | Two comparable nights, A1–A3 with sleep ≤ 80% of their baselines and cabin CO₂ at 680 → 950 → 980 ppm | `attention` for the crew, A4 `normal`. The response records two `unconfirmed` hypotheses, temporal coincidence with internal CO₂ and not-yet-verified alternative explanations. A CO₂ recheck stays pending. |
| Individual trend | Two nights below the threshold for A1, other profiles within the synthetic reference and stable CO₂ at 680 ppm | `attention` in A1's scope, an empty hypothesis list and a new sleep measurement for A1. Readings from the other crew members still await evaluation on the dashboard. |
| Insufficient coverage | A1 has two nights and A2–A4 have one night each. CO₂ readings missing. | `insufficient_data` for the group. A1 keeps `attention`, A2–A4 stay `insufficient_data` and the check asks for a second night of sleep from A2. |
| Simulated sensor failure | All four CO₂ readings have `quality:suspect`, including the 2,200 ppm sample | The audit keeps the suspect readings. The usable CO₂ evidence is empty, the sleep finding remains `attention` and only the alternative explanations stay as an `unconfirmed` hypothesis. A new CO₂ reading is suggested. |
| Sensor outside the window | CO₂ collection times moved back 30 days | The audit keeps the history. The analysis preserves the sleep finding, records the environmental limitation and asks for a comparable CO₂ reading. |
| Sensor without data | CO₂ readings removed, with the same eight sleep observations as the collective case | `attention` for the group, alternative explanations open and CO₂ collection as the next check. |

The scenarios follow the [AKM-28 fixture](../../backend/tests/fixtures/odyssey-26-scenarios.json). Each sensor variant checks in the audit which CO₂ inputs reached the engine and which served as evidence. [Scenario tests](../../backend/tests/test_scenarios.py) · [Simulated data](synthetic-data.md)

## Verification matrix

| Criterion | Automated verification |
| --- | --- |
| DR-01 · Individual trend | Two distinct UTC dates with usable sleep and a positive baseline. Tests exercise the inclusive 80% threshold, repetition in the same period, exclusion of suspect samples and replacement by the most recent usable reading. [Individual tests](../../backend/tests/test_individual_rules.py) |
| DR-02 · Collective trend | Two or more profiles with a drop in the same window support the pattern. Misaligned periods, replacement of the cohort by the most recent one and the synthetic A1–A3 case are verified. [Collective tests](../../backend/tests/test_collective_rules.py) · [HTTP scenarios](../../backend/tests/test_scenarios.py) |
| T06 · DR-03/04 · Hypotheses, failures and gaps | CO₂ with a reference and comparable variation generates a temporal hypothesis, with an explicit explanation of the causal uncertainty and an alternative hypothesis. Absence, suspicion or incompatible times limit the evidence and preserve independent sleep findings. An empty crew is `insufficient_data`, with empty evidence and no collection target. A known profile without sleep receives a collection proposal. [HTTP scenarios](../../backend/tests/test_scenarios.py) · [Investigation tests](../../backend/tests/test_investigations.py) |
| DR-05 · Check and protocol | The selection explains information, quality, availability and effort. A simulated validated protocol prefers A1's heart rate even with high effort and CO₂ available; the API persists the check and the reference in the reason. Selection tests cover permitted alternatives, absence of resources and human referral without collection. [Selection tests](../../backend/tests/test_next_check.py) · [Investigation tests](../../backend/tests/test_investigations.py) |
| T07 · Repetition | A repeated `POST /api/investigations/run` returns the same investigation and the same follow-up with `reused:true`. Concurrent repetition writes only one analysis and one follow-up. `GET /api/investigations/{id}` retrieves the original result. [Investigation tests](../../backend/tests/test_investigations.py) |
| T08 · New input | Registering a usable measurement sets `has_unanalyzed_measurements:true` and preserves the last analysis. Explicit execution changes the fingerprint and clears the signal. Two investigations with the same target result in a single pending follow-up. [Investigation tests](../../backend/tests/test_investigations.py) |
| T09 · DR-06 · Rejected completion | PATCH with no link, a suspect observation, an incompatible target or an invalid time returns 422. A nonexistent measurement ID returns 404. The check stays `pending` with `completed_at` and `measurement_id` null. [Investigation tests](../../backend/tests/test_investigations.py) |
| T10 · DR-06 · Completion and re-analysis | A valid PATCH persists `completed_at` and `measurement_id`, visible via GET. Repeating with the same ID returns the same completion, even under concurrency. Using another measurement returns 409. The original investigation stays retrievable and the next analysis is requested by POST. [Investigation tests](../../backend/tests/test_investigations.py) |
| DR-07 · Alert levels | `normal` green, `attention` yellow, `insufficient_data` gray. Text and icon accompany each color. Synthetic sleep of 0 h in two periods stays `attention`. `critical` and red are reserved for the protocol legend. The dashboard projects the persisted levels when new data awaits investigation. [Alert tests](../../backend/tests/test_alerts.py) · [Investigation tests](../../backend/tests/test_investigations.py) |

## Reproduction

Install the dependencies listed in the [README](../../README.md), activate the Python environment and run from the root.

```sh
python -m pytest -v backend/tests/test_scenarios.py
python -m pytest -q backend/tests/test_investigations.py backend/tests/test_individual_rules.py backend/tests/test_collective_rules.py backend/tests/test_next_check.py backend/tests/test_alerts.py
python scripts/demo_investigation_flow.py
python scripts/check.py
```

The [HTTP script](../../scripts/demo_investigation_flow.py) creates an isolated database, runs the investigation, repeats the input, records the recheck and re-analyzes. In the validation run, the JSON showed `initial_result.status: attention`, two hypotheses, a `co2_ppm` check, `repeat_reused: true`, `completion.status: completed`, `completion.measurement_id: 30`, `new_data_requires_explicit_run: true` and `updated_investigation_id: 2`.

On 15/11/2026, with Python 3.13.5 and Node 22.23.5, the focused suite passed with **182 tests** summing the first two commands. The default command passed with **295 tests**, Ruff and the frontend type check. In both full runs, before and after the change, Pytest emitted a Starlette 1.10.0 deprecation warning about `TestClient` with httpx 0.28.1.

## Limitations

- The baselines, the 48 h window, the 12 h alignment tolerance and the 80% sleep threshold are demonstration parameters. The collective analysis uses the most recent comparable pair and approximates periods by UTC dates. Clinical validation would require its own data and criteria.
- The sensor variants represent suspect quality, missing samples and temporal misalignment. The investigation handles these effects and preserves data traceability. Attributing the failure to calibration, transmission or equipment would require additional evidence.
- The internal CO₂ comparison supports temporal coincidence. Temperature remains descriptive context and the hypothesis list leaves the cause open. The protocol fixture represents a configuration validated exclusively to test the preference order.
- The fingerprint keeps the historical result when only the clock advances. A new analysis depends on changes in the inputs or in the configuration considered by the calculation. The seed has fixed dates and ages out of the window when used with the real clock.
- A write failure returns a generic 500 and rolls back the transaction. A corrupted historical response produces a controlled 500 on retrieval. The tests exercise both with local SQLite. [Persistence and HTTP responses](../akm-20-investigation-persistence.md)
- End-to-end visual and navigation validation belongs to AKM-30. This suite verifies the API, the dashboard projection and the presentation of the levels in the backend.
