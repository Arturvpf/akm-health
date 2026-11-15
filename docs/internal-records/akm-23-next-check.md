# AKM-23 — Informative next check

Task (internal Notion page; Portuguese, not part of the submission) · Architecture (internal Notion page; Portuguese, not part of the submission) · [AKM-07 research](../scientific-sources.md) · [AKM-08 safety](../akm-08-alert-safety.md)

`prioritize_next_check` in `backend/app/next_check.py` is a pure function. It receives an individual or collective snapshot, a rules version, an explicit resource catalog, the detector configuration and, optionally, a validated protocol supplied by the caller. It reuses AKM-21/22 and returns **one** feasible check or an explanation of why none was selected. It does not access the database, files, network or clock, does not create follow-ups and does not change alerts.

## Contract

- `CheckTarget`: metric and astronaut; sleep/heart rate/mood require a non-empty ID and CO₂/temperature require a null target (habitat).
- `CheckResource`: target, availability and effort (`low`, `medium`, `high`). Absence from the catalog means unavailability; an instrument is never assumed to be available. IDs outside the scope may exist in a shared catalog but are not chosen by this scope's rule. Repeated targets in the catalog are a configuration error.
- `NextCheckSelection`: scope, time, detector version, `policy_version=demo-priority-v1`, selection state, detector state, candidates with factors/score, alternative used, protocol reference, reason and limitations.
- When there is a selection, `next_check` contains **only** the four canonical fields: `kind`, `astronaut_id`, `reason`, `effort`. With no feasible resource, it returns `next_check=null`, without creating a fictitious target or an incompatible measurement.

This contract is internal. Composition with `InvestigationResult` and persistence belong to AKM-20; there is no new table or endpoint. The future fingerprint must consider every input that changes the result: snapshot, configuration, versions, resources and protocol.

## Demonstration scoring policy

The score is `3 × informative_value + quality_need − effort_penalty`. Information and quality need range from 0 to 100. Penalties: low effort 0, medium 20 and high 40. Availability has a score of 100 or 0 and acts as a **mandatory eligibility condition**, not as a probability. Unavailable candidates remain visible in the diagnostics but are never selected. When the resource was not even supplied, effort is null: no cost is estimated, its diagnostic score receives no penalty and it remains ineligible.

These numbers are explainable software priorities, not validated clinical utility or risk percentages. The table fixes this version's default policy:

| Situation | Information | Quality need | Reason |
| --- | ---: | ---: | --- |
| Collective pattern with a consistent CO₂ change | 100 | 50 | Confirm with another internal reading; the hypothesis stays unconfirmed. |
| Collective pattern with no reference or without two aligned environmental readings | 95 | 100 | Fill in/validate the required environmental collection. |
| Collective pattern with sufficient CO₂ and no consistent change | 35 | 10 | Lower additional information; sleep follow-up may win. |
| Sleep with one useful observation and insufficient coverage | 100 | 100 | One additional distinct period can reduce the gap. |
| Sleep with no useful observation, with a known baseline | 80 | 100 | Start a new collection; a single reading still does not complete two periods. |
| Changed profile | 80 | 20, or 40 with suspect readings excluded | Repeat the record and check the collection time/routine. |
| Incomplete profile when a sufficient collective pattern already exists | 50 | 70 | Coverage alternative; does not outrank the group's environmental confirmation. |
| Group with no comparable periods, with at least two individually sufficient profiles | 90 if the last period is old; 70 otherwise | 80 | Collect a distinct period to align coverage when the options for filling individual gaps are unavailable. |
| Internal temperature with a collective pattern | 25 | 20 | Additional context, without replacing CO₂ confirmation. |

Missing/non-positive baselines are not fixed with an invented measurement: a profile without a baseline generates no automatic sleep proposal. An empty roster or the absence of a suitable target generates `needs_context`. With no pattern and no relevant gap, `no_check_needed`; the scheduled routine is the responsibility of the following tasks. A normal collective result can still originate a check on a changed or incomplete individual profile, without promoting the group to an alert.

Apply the protocol's priority first, when there is one. In collective insufficiency, the collections that fill individual gaps come before the alignment collections. Inside each group, sort by descending score, lowest effort penalty and stable key `(kind, astronaut_id)`. Choose the first available. If earlier options are unavailable, mark `used_alternative=true`, keep the rejected candidates and explain the alternative in the `reason` itself. Heart rate and mood can only be selected here by explicit protocol instruction.

## Protocols and limits

`ValidatedProtocol` requires a non-empty reference and an explicit `validated=true`. This is a declaration by the integrator: **the module does not prove scientific validation or operational authorization**. No real approved protocol was added in this delivery.

- `action=human_review`: returns `protocol_referral`, without running the detector or waiting for a check, even when the resource configuration is not applicable to the referral. It sends no message to anyone.
- `action=measurement`: the ordered `permitted_checks` list takes precedence over the demonstration score. Only one of those checks may be chosen; unavailability of the first allows only an alternative authorized in the list itself. If none is available, return `unavailable`, without replacing it with an option outside the protocol.
- A protocol target outside the scope, a protocol without explicit validation or an incoherent shape generates an input error. No rule activates a `critical` medical state, diagnosis, prescription or equipment adjustment.

## Reproduce

```sh
python scripts/demo_next_check.py
python -m pytest -q backend/tests/test_next_check.py
python scripts/check.py
```

With the demonstration resources explicitly available, the collective scenario chooses habitat CO₂; the individual one chooses A1's sleep; the insufficient one chooses A2's sleep. Without CO₂, the collective one chooses an available sleep alternative; if only temperature is feasible, the message states that it is additional context. With no resources, there is no fictitious check.

The tests use the official fixtures and cover missing/suspect/out-of-window quality, partial coverage, availability and effort, stable tie-breaking, alternative and total absence of resources, normality, missing baselines/rosters, preservation of individual findings, protocol precedence and referral, invalid targets, the canonical contract, determinism and absence of mutation. The detectors' limitations (including the period approximated by UTC date) accompany the result.
