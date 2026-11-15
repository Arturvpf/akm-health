# AKM-26 · Explanation and safety in the investigation

The responses of `POST /api/investigations/run` and `GET /api/investigations/{id}` include `explanation`. The Investigation screen (AKM-16) can render this object together with the finding, the evidence, the hypotheses and the next check it already receives. The texts come from the result and from the server's check decision. The AKM-09 educational library goes through Research/Safety review before publication in `guidance`, which still returns `[]`. [AKM-08 criteria](../akm-08-alert-safety.md) · [AKM-09 library](../akm-09-guidance-library.md) · Architecture (internal Notion page; Portuguese, not part of the submission)

## Fields for the Investigation screen

| Field | Presentation |
| --- | --- |
| `coverage` | Observation period in UTC and the IDs of the profiles the rule evaluated. In the collective scope, these are the profiles of the comparable window the engine chose. An empty list means the engine had insufficient coverage to classify the requested scope. The value `null` indicates the saved record lacks these audit details. |
| `limitations` | Limits of the simulation and of the available evidence. Show with the demonstration label and the readings that support the finding. |
| `uncertainty` | Text explanation of the gap, open hypothesis or reach of the rule. The certainty of each hypothesis comes from `hypotheses[].certainty` and remains `unconfirmed`. When the engine compares CO₂ with a sleep finding, the explanation carries the result of that comparison. |
| `references` | Each reference contains `source_id`, `title`, `url` and `relevance`. Show the relevance together with the link. The architecture defines the demonstration rule. The NASA sources explain the research context of sleep and of cabin air. [AKM-07 foundation](../scientific-sources.md) |
| `check_context` | `status` and `reason` of the AKM-23 selection. For `selected`, use the type, target and effort of `next_check`, with the justification presented once. For `unavailable`, `needs_context`, `no_check_needed` or `protocol_referral`, explain the situation without creating a collection action. `null` indicates the auditable decision is absent from the record. [AKM-23 contract](akm-23-next-check.md) |
| `human_review` | In `conditional`, show when to consult the team and what information to bring. In `per_protocol`, show the instruction to contact the responsible person without waiting for a collection. This mode requires the AKM-23 `protocol_referral` decision, which uses the configured protocol reference declared as validated. Treat `protocol_reference` as text. Contact and sending are manual. |

For compatibility with earlier servers, the TypeScript type accepts a missing `explanation`. The API assembles the explanation from the audited facts of each investigation. The format in SQLite, IDs, fingerprints, findings, evidence, state and check links follow the AKM-20 contract. When an old section is missing or inconsistent, the explanation uses the available facts and flags the gap. Retrieving an old record uses only the reading of the result and its audit. Linked checks keep using the [AKM-20](../akm-20-investigation-persistence.md) flow.

## Local demonstration

With the [README](../../README.md) environment prepared, run from the repository root.

```sh
python scripts/demo_investigation_flow.py
python -m pytest -q backend/tests/test_investigations.py
```

The script fixes the window and loads ODYSSEY-26 in a temporary database. In `initial_result`, note `attention`, A1 to A4 in the coverage, the `unconfirmed` environmental hypothesis, the `NASA-CO2` reference, `check_context.status=selected` and the new CO₂ collection. The explanation states that temporal coincidence does not establish causality. The script also repeats the request, retrieves the record, completes the check through a linked reading and runs an investigation with the new input.

The tests cover the individual A4 result, a mission without data, suspect CO₂ readings, unavailable resources, human referral by protocol without a prior collection, old investigations and HTTP errors. A mission with no profiles returns `insufficient_data`, empty coverage and `needs_context`. Suspect readings can prevent the environmental comparison while the sleep finding remains supported. An unavailable check returns `unavailable` with the reason and no new task. The protocol referral preserves the experimental state.

The API uses the error responses already defined. For HTTP 422/404, show the problem with the request and allow correction. For a read or run failure, the screen can keep the last confirmed result with its time and offer a retry. Show the error as a loading state, preserving the previous classification. The references accompany the response without an external lookup during the analysis. [AKM-08 criteria](../akm-08-alert-safety.md) · [AKM-04 flow](akm-04-investigation-flow.md)
