# AKM-25 — agenda and adaptive demonstration routine

The agenda now combines periodic collection windows with the investigative checks delivered by AKM-20/23. It uses the four existing tables and ten canonical endpoints. The response schemas and TypeScript types stay unchanged. No background scheduler runs and GET requests never create or complete checks.

Sources: [AKM-25](https://app.notion.com/p/4189432b22228109bbaedd3ad3dce37a), [canonical architecture](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4), [AKM-06 collection protocol](akm-06-measurement-protocol.md), [AKM-09 copy](akm-09-guidance-library.md), [AKM-23 priorities](akm-23-next-check.md).

## Enable a collection policy explicitly

The AKM-06 cadences are demonstration UX choices. They do not specify an approved operational clock for a real mission. Therefore, the default configuration retains investigation checks only. Periodic scheduling requires a `routine` section in the configuration selected by `AKM_INVESTIGATION_CONFIG` before startup.

The bundled `backend/app/routine_demo_config.json` enables all five metrics for the fictional mission: three personal metrics for each of A1–A4, plus two habitat metrics. It explicitly declares simulated resource availability. Its daily UTC windows starting at `2026-11-14T00:00:00Z` are an **implementation assumption for this example**, not a clinical cadence or NASA flight protocol. In particular, mapping completed sleep periods and comparable heart-rate/environmental windows to daily UTC is only a reproducible demo choice. Replace the anchor and interval with the team's chosen demonstration windows when appropriate.

From the repository root in PowerShell:

```powershell
$env:AKM_INVESTIGATION_CONFIG = (Resolve-Path backend/app/routine_demo_config.json).Path
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Each `routine.checks` entry defines `kind`, `astronaut_id`, a positive ISO duration `every`, timezone-aware `anchor_at`, nonblank `reason` and `reference`. Individual targets require an astronaut; habitat targets require null. Duplicate targets and invalid fields fail configuration validation. The reference records provenance of the demonstration instruction; configuring it does not validate medicine. `policy_version` is `demo-routine-v1`.

## Scheduling and lifecycle

On explicit `POST /api/investigations/run`, the pure planner computes the current half-open window `[start, end)` for each relevant check. Its end becomes `due_at`. No check starts before its anchor. Only an `ok` sample of the same metric and subject, observed inside the window and already registered by the snapshot time, satisfies the collection window. Suspect, future and older-window samples do not fill the gap. Missing data stays missing; nothing is synthesized.

The individual scope covers that astronaut and habitat; other or unknown subjects are deferred without inventing profiles or violating foreign keys. An absent/unavailable resource is explained in the internal plan and creates no impossible task. A configured validated protocol takes precedence: periodic tasks are deferred, and AKM-23 supplies the protocol's measurement or immediate human referral. Human referral is not gated by a new routine measurement. Existing checks remain available for audit.

The investigation transaction creates or reuses the selected investigative check, then materializes missing routine checks. Every persisted check has a reason, creator investigation and deadline where applicable. A pending equivalent `(kind, astronaut_id)` is reused globally, keeping its original reason, deadline and creator. Missed periods do not produce a backlog of duplicate requests. A completed check already linked to the same collection window is not recreated. The next window can create another check after completion when it still lacks usable data.

`audit.routine` in `investigations.result_json` records the configuration-derived plan, window bounds, deferred/satisfied reasons, relevant measurement IDs and created/reused follow-up IDs. Each reference distinguishes a new check, a reused pending check and an already completed window. Thus a pure plan lacking a current-window sample is not confused with reopening a request that was already completed under the canonical registration-time rule. The schema remains four tables. `InvestigationResult.followup_id` continues to refer only to the single selected investigative check; clients read all routine items through the agenda. Original investigation responses remain immutable.

When routine is configured, the logical collection-window starts join the stable SHA-256 fingerprint. Replays inside the same window with identical inputs return `reused:true` without writes. A new collection window is a new scheduling input, permitting a fresh explicit assessment even without new measurements. Check catalog order is normalized. Without routine checks, pre-AKM-25 fingerprints are preserved. SQLite `BEGIN IMMEDIATE` serializes snapshot, deduplication and writes; any error rolls back the analysis and every check together.

Completing a check still requires explicit `PATCH /api/followups/{id}` with `status:"completed"` and a compatible persisted `measurement_id`. The AKM-20 rule remains: same metric/subject/zone, quality ok, `recorded_at > followup.created_at`, no future observation/registration, and server `completed_at`. Identical completion returns 200 unchanged, another measurement returns 409, and incompatible evidence returns 422. The canonical completion criterion is registration time; an older observation registered afterwards can complete the request. Period history prevents recreating that completed routine request within its original window. Saving a measurement or reading the agenda never completes it automatically.

## Read the agenda

`GET /api/followups?status=pending` and `dashboard.pending_followups` use the same deterministic ordering:

1. Pending checks referenced by an explicitly validated protocol.
2. Checks selected by an investigation.
3. Periodic checks, ordered by oldest deadline, creation time and ID.

Priority is derived from persisted investigation references, so a routine check reused by a later protocol is promoted without duplicating it or rewriting its original reason. The referring investigation contains the new selection explanation. This is workflow priority, not a clinical severity score. No synthetic rule creates `critical`. Historical/unfiltered follow-up queries retain chronological order. The `astronaut_id` filter still returns only that astronaut's checks. The upcoming interface in AKM-16 can render the existing canonical reason/deadline fields.

## Reproduce, review and limitations

With development dependencies installed:

```sh
python scripts/demo_adaptive_routine.py
python -m pytest backend/tests/test_routine.py -q
python scripts/check.py
```

The demo uses a temporary database and fixed synthetic clock, restoring environment variables and clock afterwards. The first agenda has three checks: adaptive habitat CO₂, missing heart-rate reading for A4, and missing mood check-in for A3. It verifies replay without duplication, completion linked to a real persisted synthetic measurement, explicit reanalysis, and the next collection window. The next window has 14 unique pending metric/subject targets, carrying over outstanding checks instead of duplicating them.

Coverage includes missing/suspect/future evidence, current-window boundaries and UTC offsets, ordering and promotion by protocol, scope isolation, malformed configuration, shared targets, concurrent requests, completed-window deduplication, rollback, canonical completion and the published AKM-20 fingerprint. The server's normal clock is unchanged; the fixed seed ages naturally outside its old dates. The configurable routine is not a sensor integration or a job runner. Mission protocol validation, approved operational cadences, actual medical priorities and the UI remain the responsibility of their respective tasks/owners. The AKM-26 `explanation` metadata is preserved on new and recovered responses; `guidance` remains empty under that existing safety contract.
