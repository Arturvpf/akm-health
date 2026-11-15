# Reproduce the fictional mission demo

Use [README setup](../README.md). Do not use real patient data. The normal server does not freeze time or replay a real mission.

## Fixed, repeatable HTTP scenario

Run python scripts/demo_investigation_flow.py with the project virtual environment. It creates temporary SQLite, seeds four profiles and fixes only its own investigation clock to 14 November 2026. It checks first investigation, replay with reused=true, recovery by ID, a compatible recheck, idempotent completion and a new explicit investigation. It restores environment/clock on exit.

Expected output fields: demo_only=true, isolated_database=true, repeat_reused=true, new_data_requires_explicit_run=true, and an updated_investigation_id different from initial_result.id. IDs belong to the temporary database. The script's recheck is inserted with SQLModel; it is not evidence of browser POST registration. It is safe to rerun without resetting a user's database.

python scripts/demo_adaptive_routine.py exercises the optional windowed routine separately, also isolated. Neither command changes the running API's clock/configuration.

## Interactive flow

1. Start API with a dedicated absolute AKM_DB_PATH, seed it from backend/, and start Vite in a second terminal.
2. Open Dashboard. Check the fictional mission disclaimer, origins, UTC timestamps and missing readings. Before any explicit run, do not expect an invented motor classification.
3. Register a mission observation. Select a returned crew profile for sleep/FC/mood; CO₂ and temperature belong to habitat. Supply measured time with explicit offset, manual/synthetic origin and technical quality. Record the receipt ID; recorded_at comes from the server.
4. Open History and confirm the same target/kind/time/unit/origin. Blank, suspect and absent values are different states.
5. Open Investigation, choose crew or individual and **explicitly run**. Check evidence window, coverage, limitations and unconfirmed hypotheses. Run again unchanged and check reuse rather than duplicate results.
6. If a follow-up exists, collect a new compatible observation. It must have quality ok and be recorded after the request; do not reuse an older seed sample to pretend completion. Complete explicitly with its persisted measurement ID. A new reading alone does not complete a check.
7. Explicitly run again and inspect the new/reused result appropriate to its inputs. A persisted result is not a live clinical classification.
8. In Dashboard/Investigation open the separate NASA section: HRP references and RR-1 2014 ISS history. Compare /api/nasa/references with /api/measurements; the archive is not mission telemetry.

The seed dates are fixed (13–14 November 2026). The normal 48-hour detector window ages with the real clock. If samples are too old, expect insufficient_data/limited evidence. For an interactive collective pattern, deliberately register clearly simulated comparable sleep observations for at least two profiles on two distinct UTC dates within the active window, using the documented synthetic baseline rule. If suitable dates are not available, use the fixed-clock script above rather than falsifying times or expecting clinical significance.

## Error and uncertainty checks

- Empty or invalid value is not converted to zero. Invalid technical values/time/unit/target should be rejected, not persisted as a clinical alert.
- 422 should preserve the form and explain correction; 404 requires refreshing/selecting the target again.
- If POST confirmation is lost, check History before retrying. There is no server measurement idempotency key.
- GET refresh failure should keep the last confirmed data with a freshness warning, not invent an assessment.
- A suspect reading remains traceable but is unsuitable completion evidence. Missing or mismatched measurement evidence must leave the follow-up pending.
- The NASA archive fallback must not fabricate readings; see [data-source recovery](data-sources.md).

## Scope of this walkthrough

This is a reproduction guide and expected behavior, not a claim that every scenario was executed in this task. See [actual AKM-31 evidence](akm-31-verification.md). End-to-end acceptance matrix T01–T15, complete keyboard/screen-reader testing, Research/Safety sign-off and submission are separate from writing documentation.
