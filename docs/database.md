# Local SQLite database · AKM-17

The API migrates the database during startup. To apply the same migration without starting the server, run `python -m app.db` from `backend/` in the project environment. The default database is `backend/akm.db`. Set `AKM_DB_PATH` to choose a separate file.

## Schema and migration

| Table | Stored data |
| --- | --- |
| `astronauts` | Mission profile and positive synthetic sleep baseline |
| `measurements` | Crew or cabin observations, metric and unit, UTC measurement and recording times, source and quality |
| `investigations` | Scope, result JSON, rule version and unique input fingerprint |
| `followups` | Requested check and, on completion, its linked persisted observation |

The initial migration creates the four SQLModel tables and the `(astronaut_id, kind, measured_at)` index in one SQLite transaction. It records version 1 in `PRAGMA user_version`. It can run again on version 1 and preserves a database created by the foundation smoke check. An unfamiliar version or an unversioned database with AKM tables stops the migration for review before any schema change. Back up the affected file and inspect its schema.

Every connection enables foreign keys. SQLModel reads mission timestamps as timezone-aware datetimes and writes fixed-width ISO 8601 UTC text so the time index sorts chronologically. SQLite checks the subject for the measurement zone and investigation scope, the investigation fingerprint's uniqueness and the presence of both completion fields for a completed follow-up. API payload validation remains in the Pydantic contracts. The workflow that checks whether a follow-up's linked measurement is compatible and later than the request belongs to the investigation API implementation.

An empty database is ready for use and has zero mission rows. Missing observations are represented by absent rows. Cabin observations have a null astronaut ID. `quality=suspect` marks a reading with uncertain reliability.

From the project root, run `python -m pytest -q backend` to check migration from a fresh or prior smoke database, persistence of the four entities, UTC round-trips, failed foreign keys and transaction rollback on duplicate fingerprints.
