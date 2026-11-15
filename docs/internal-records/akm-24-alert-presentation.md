# AKM-24 — Alert status and messages

Task (internal Notion page; Portuguese, not part of the submission) · [AKM-08 matrix](../akm-08-alert-safety.md) · Architecture (internal Notion page; Portuguese, not part of the submission)

`backend/app/alerts.py` presents a status already computed by the engine. It receives no raw sensor values, invents no thresholds, does not run the engine and does not write data. The pure function `present_individual_alert` translates AKM-21 results directly; `present_alert` receives a typed `AlertContext` for individual or collective scopes.

## Catalog

| Status | Label | Color | Icon | Attention level |
| --- | --- | --- | --- | --- |
| `normal` | No pattern under the demo rule | green | circle-check | routine |
| `attention` | Experimental pattern to verify | yellow | triangle-alert | verify |
| `insufficient_data` | Insufficient data | gray | info | missing_data |
| `critical` | Follow the mission protocol | red | siren | reserved_protocol |

The AKM-08 matrix and DR-07 require red/critical to appear **only in the P0 legend**, reserved for an authorized protocol. `alert_legend()` exposes it with `legend_only=true`, while `AlertContext` rejects `critical`. That way green/yellow/red are reproducible in the legend without triggering a medical alert from a synthetic rule. Insufficient data is gray, never normal/green by absence.

Text, icon and color always travel together. Colors are semantic tokens, and icons are identifiers for the visual layer. Contrast, theming and accessible rendering belong to the design system/frontend; this module delivers the structured description without depending on color alone.

## Context, traceability and refresh

`AlertContext` holds status, scope, target, rules version, time, window start, findings, limitations, evidence IDs and evaluated profiles. It validates scope/target, UTC times with a time zone, window order, non-empty text and unique ordered IDs. The individual scope only admits coverage of its own target. The output preserves the full context, adds the style, the explanation, the number of evaluated profiles and a refresh message when applicable. The structures are immutable.

`has_unanalyzed_measurements=true` adds "New measurements available — refresh investigation". It does not recompute the state or change its color. Loading, HTTP error, network failure and new data are not investigation classifications; `loading`, `error` and unknown states are rejected. The interface must keep the last confirmed result and its time during those situations.

The individual adapter preserves exactly the detector's findings, limitations and evidence IDs. It reports one sufficient profile when the result is not `insufficient_data`, and zero in case of insufficiency. For the collective scope, the caller composes `AlertContext` from the detector result: `scope=crew`, null target and the IDs of the profiles actually compared. Hypotheses stay in the investigation result and must be presented separately from findings and with their uncertainty; the presenter does not promote them to facts.

This is an internal presentation contract; it does not change the ten canonical endpoints nor replace the HTTP schema of `DashboardAlert`/`InvestigationResult`. Investigation IDs, HTTP composition and persistence continue in the corresponding tasks. The generic messages neither choose the next measurement nor create checks (AKM-23/25).

## Reproduce

```sh
python scripts/demo_alerts.py
python -m pytest -q backend/tests/test_alerts.py
python scripts/check.py
```

The example runs the individual detector on the seed and shows three yellow presentations, one green, a gray demonstration of missing data and the legend with reserved red. The tests verify colors/texts/icons, the real rule's limits, insufficient data, status preservation after new data, collective scope, uncertainty, invalid inputs, immutability and determinism. No message represents a diagnosis, prescription or safety statement.
