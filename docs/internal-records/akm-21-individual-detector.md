# AKM-21 — Individual change detector

Task (internal Notion page; Portuguese, not part of the submission) · Canonical architecture (internal Notion page; Portuguese, not part of the submission) · [AKM-08 safety matrix](../akm-08-alert-safety.md)

`backend/app/rules.py` implements DR-01 and the individual sufficiency of DR-04. The function `detect_individual_changes(snapshot, rules_version, config)` takes typed data, returns an explainable `IndividualDetection` and does not touch the database, the clock, the network or files. It does not write alerts or create checks.

## Internal contract

- `IndividualSnapshot`: the astronaut's ID, the synthetic sleep baseline (may be absent), `as_of` with an explicit time zone, and a tuple of `MeasurementRead` ordered by `(measured_at, id)`. IDs must be unique. Dates are normalized to UTC by the existing schemas.
- `IndividualRuleConfig`: a positive window, 48 hours by default, and a sleep ratio between 0 and 1, 0.8 by default. These are demo parameters, not clinical thresholds. Changes to the parameters must come with the rules-version identification in the future investigation composition.
- `rules_version`: required and non-empty. `as_of` is supplied by the caller; the run does not use the current time.
- `IndividualDetection`: target, version, rule, state, window, baseline, computed limit, evidence with IDs/times/values/units, excluded suspect IDs, findings and limitations. Outputs are immutable and marked `demo_only=true`.

This is an internal detector result, not a new HTTP response. Composing it with the canonical `InvestigationResult` schema, the fingerprint and persistence continues in the following tasks. AKM-22 analyzes the crew and the environment; AKM-23 chooses the next measurement; AKM-20 persists; AKM-24 handles alert presentation. No endpoint or table was added in this task.

## Evidence selection and decisions

1. Select only the sleep of the requested astronaut. Readings from other profiles, CO₂, temperature, mood and heart rate do not change the individual classification. The measurement schema does not accept a NASA origin.
2. Use the inclusive window `[as_of - window, as_of]` by observed time. Also exclude records whose `recorded_at` is later than `as_of`, because they would not yet have been available at that moment. Old or future data do not fill gaps.
3. Exclude `quality=suspect` from the evidence and list its IDs when they belong to the target and the window. If two usable periods still remain, evaluate normally from the remaining data.
4. The current contract has no sleep-period ID. **Demo decision:** use the UTC date as an approximation of the period. For each date, select the most recent usable reading by `(measured_at, id)`; then use the two most recent dates. Two entries on the same date, even with different times, do not represent two nights. A suspect repetition does not replace a useful reading.
5. A missing or non-positive baseline, or fewer than two usable periods, produces `insufficient_data` with an explicit reason. Non-finite baselines, invalid units, disordered history/repeated IDs, references with no time zone and invalid configurations are input errors (`ValidationError`/`ValueError`), not normal states.
6. With a positive baseline and two periods, **both** must be less than or equal to `baseline × sleep_ratio` for `attention`. The comparison uses decimals from the numbers' representations to preserve inclusive equality. An observed sleep of 0 h is data, not absence.
7. With enough data and the condition not met, produce `normal`, meaning only the absence of that pattern under the demo rule. The function never produces `critical`, a diagnosis, a prescription or a causal hypothesis.

The UTC-date approximation can group collections from different real periods or split a real period that crosses midnight. It is not suitable for real shift-work or planetary-schedule sleep; a future evolution needs an explicit period identifier. The result exposes the dates used so this limitation stays traceable. The 48 h window was chosen to cover the seed's two nights, is configurable and is not a medical assessment interval.

## Reproduce

With the README dependencies installed, at the repository root:

```sh
python scripts/demo_individual_detection.py
python -m pytest -q backend/tests/test_individual_rules.py
python scripts/check.py
```

The demonstration uses only in-memory data from the official seed and IDs local to the example. It returns `attention` for A1, A2 and A3, and `normal` for A4, with two pieces of evidence per profile. It is not a crew investigation and does not save records. The tests also apply the AKM-28 individual and insufficient fixtures.

The tests cover the 80% equality, values above the limit, decimal precision, zero sleep, missing/suspect data, duplicates, updating a period, the inclusive window, future/old data, target/metric separation, explicit configuration, input errors, output immutability and deterministic repetition without changing the snapshot.
