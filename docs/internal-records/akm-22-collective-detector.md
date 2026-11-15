# AKM-22 — Collective patterns and environment

Task (internal Notion page; Portuguese, not part of the submission) · Architecture (internal Notion page; Portuguese, not part of the submission) · [AKM-08 matrix](../akm-08-alert-safety.md)

`detect_collective_patterns` in `backend/app/rules.py` applies DR-02/03/04 as a pure function. It reuses AKM-21 and neither persists data nor adds endpoints. The snapshot holds unique profiles ordered by ID, a unique history ordered by `(measured_at, id)` and an explicit UTC `as_of`. Each profile may have no baseline, so insufficiency stays explicit.

## Sleep and coverage

The configuration includes the individual rule (default: 48 h and ratio 0.8) and the environmental tolerance (default: 12 h, may be zero). All of them are demo parameters, not clinical cut-offs.

A collective comparison exists only with at least two profiles that have a baseline and two usable periods on the **same two UTC days**. The date keeps the period approximation documented in AKM-21. When several comparable groups exist, the pair with the most recent final date is chosen. On a tie, the most recent initial date prevails. The output preserves the individual results of every profile, including those left outside that group.

- Fewer than two comparable profiles: `insufficient_data`.
- At least two profiles of the comparable group in individual `attention`: collective `attention`.
- Sufficient group without that pattern: collective `normal`, even if one profile has an individual change.

`sufficient_astronaut_ids` lists the individually sufficient profiles; `comparable_astronaut_ids` identifies the group actually compared; `affected_astronaut_ids` identifies the changed profiles of that group. Each individual result keeps its evidence. The output includes window, periods, version, findings and limitations. No rule returns `critical`.

## Environmental evidence

Only internal CO₂ and temperature (`astronaut_id=null`) with `ok` quality, observed inside the window and recorded up to `as_of`, are usable. Repeated readings at the same timestamp count once, choosing the highest usable ID. External NASA data or historical data do not enter the mission's measurement schema.

For each metric, look for one distinct reading for each period, within the tolerance of **all** the group's sleep times in that period. Select the ordered pair with the second-most-recent reading and, before it, the most recent first reading. This also works when the tolerance windows overlap. The reference is the most recent usable reading strictly before the first aligned reading, still inside the window.

A consistent change requires a reference and two aligned readings, both above or both below the reference. The inequality is strict; unchanged values or values in opposite directions do not support the change. There is no invented safety threshold: it is only a descriptive comparison within the synthetic scenario. The output exposes IDs, values, units, origin and times, plus the reason when support is missing.

Only a collective sleep pattern together with a consistent CO₂ change generates the environmental-coincidence hypothesis, always `unconfirmed`. For `attention`, unverified alternative explanations are also presented: routine, individual factors and collection conditions. With no reference, with suspect/missing data or outside the window, the sleep finding remains and the environmental hypothesis is absent. Temperature is descriptive context and neither changes the status nor produces a diagnosis.

## Reproduction and validation

```sh
python scripts/demo_collective_detection.py
python -m pytest -q backend/tests/test_collective_rules.py
python scripts/check.py
```

The example uses the in-memory seed: A1/A2/A3 changed, collective `attention`, CO₂ reference 680 ppm and aligned readings 950/980 ppm, with a coincidence hypothesis and an alternative, both unconfirmed. The individual scenario keeps A1 in attention and the group without a pattern; the insufficient one keeps A1 with data and reports the absence of collective coverage.

The tests cover those scenarios, missing/suspect/old/unchanged environment, zero or missing reference, future records, sensor repetition, zero/wide tolerance, incompatible periods, choosing the most recent group, input validation and determinism without mutating the snapshot. Persistence and the next measurement continue in AKM-20 and AKM-23.
