# Local SQLite database · AKM-17

The API migrates the database during startup. To apply the same migration without starting the server, run `python -m app.db` from `backend/` in the project environment. The default database is `backend/akm.db`. Set `AKM_DB_PATH` to choose a separate file.

## Schema and migration

| Table | Stored data |
| --- | --- |
| `astronauts` | Mission profile and positive synthetic sleep baseline |
| `measurements` | Crew or cabin observations, metric and unit, UTC measurement and recording times, source and quality |
| `investigations` | Scope, result JSON, rule version and unique input fingerprint |
| `followups` | Requested check and, on completion, its linked persisted observation |

The original v1 migration created four SQLModel tables and the `(astronaut_id, kind, measured_at)` index in one SQLite transaction. AKM-33 adds `sync_operations` and migrates v1→v2 in place (five tables total). New databases start at version 2. It preserves a database created by the foundation smoke check. On a version 1 database, startup verifies the four old tables before creating `sync_operations` and marking version 2. On v2, it verifies all five tables. An unfamiliar version, a missing table or column in version 1, or an unversioned database with AKM tables stops startup without modifying the database. Check `AKM_DB_PATH`, then back up and inspect the affected file.

Every connection enables foreign keys. SQLModel reads mission timestamps as timezone-aware datetimes and writes fixed-width ISO 8601 UTC text so the time index sorts chronologically. SQLite checks the subject for the measurement zone and investigation scope, the investigation fingerprint's uniqueness and the presence of both completion fields for a completed follow-up. API payload validation remains in the Pydantic contracts. The workflow that checks whether a follow-up's linked measurement is compatible and later than the request belongs to the investigation API implementation.

An empty database is ready for use and has zero mission rows. Missing observations are represented by absent rows. Cabin observations have a null astronaut ID. `quality=suspect` marks a reading with uncertain reliability.

From the project root, run `python -m pytest -q backend` to check migration from a fresh or prior smoke database, persistence of the four entities, UTC round-trips, failed foreign keys and transaction rollback on duplicate fingerprints.

See [AKM-33 offline synchronization](akm-33-offline-sync.md) for idempotency receipts, migration and backup instructions.
