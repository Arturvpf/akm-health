# AKM-19 — History, habitat and dashboard read APIs

[Task](https://app.notion.com/p/4189432b22228160ac37c92165c70e91) · [Canonical architecture](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4)

These endpoints read the existing four SQLite tables. They do not run the investigation motor, create follow-ups, or import NASA data. All mission observations remain `manual` or `synthetic`; NASA historical references use the separate canonical endpoint.

## Endpoints

| GET route | Behavior |
| --- | --- |
| `/api/astronauts` | JSON list of persisted profiles, ordered by ID, including role and synthetic sleep baseline. |
| `/api/measurements` | JSON list of persisted observations, ordered by `measured_at` ascending and then ID. Includes units, source, quality, observation time and recording time. |
| `/api/dashboard` | Existing mission snapshot from `mission_environment.json`, latest usable crew/habitat readings, pending follow-ups and investigation freshness. |
| `/api/followups` | JSON list of persisted checks, ordered by creation time then ID; optional `astronaut_id` and `status=pending\|completed` filters. |

History supports combined optional `astronaut_id`, `kind`, `from` and `to` filters. Period boundaries are inclusive and apply to **observation time**, not recording time. `from` and `to` must be ISO 8601 datetimes with a timezone; offsets are normalized to UTC and `from <= to` is required. Response timestamps use UTC `Z`.

Pagination preserves the canonical list response: `limit` defaults to 100 (1–1000), `offset` defaults to 0 (0–9223372036854775807, SQLite's signed 64-bit integer range). Larger offsets return 422 before querying SQLite. Increment offset by limit until a page is shorter than limit. Ordering by observation time and ID breaks ties consistently on a fixed dataset; offset pagination is not a snapshot across concurrent inserts.

An omitted astronaut filter includes crew and habitat observations. Habitat-only metrics can be selected with `kind=co2_ppm` or `kind=cabin_temp_c`; their `astronaut_id` is null. An existing astronaut with no matching observations returns `[]`. An unknown astronaut filter returns 404, and malformed filters, invalid metric/status names, or invalid periods return FastAPI's 422 `detail` response. Empty lists are never padded with artificial measurements.

## Snapshot and investigation boundary

- History includes `quality=suspect` samples so clients can display gaps and quality explicitly. Dashboard metrics use only `quality=ok` samples, selecting each metric by observation time then ID. This quality denotes technical usability, not clinical safety.
- CO₂ and temperature may have different observation times. `environment.measured_at` is the most recent usable environmental observation, not a claim that both sensors were sampled together. Missing values stay null and a real zero remains zero.
- `last_investigation_at` refers to the latest persisted **crew** investigation. A newer individual investigation does not clear outstanding data for the crew dashboard.
- `has_unanalyzed_measurements` is true when an `ok` measurement was recorded after that crew investigation, or when usable observations exist but no crew investigation exists. A delayed observation counts as new by its recording time. An empty or suspect-only database returns false. This preserves the existing AKM-18 freshness convention.
- GET requests do not write or execute the motor. With no result projection from the investigation tasks, astronaut status remains `insufficient_data` and `alerts` remains empty; readings alone never create a classification. Persisting/projecting investigation alerts belongs to the investigation work, not this read API.
- The agenda endpoint and dashboard return checks already persisted in `followups`. Creating adaptive checks and completing them remain separate tasks.

## Reproduce locally

Follow the root README to install dependencies. From `backend/`, run `python -m app.seed`, then start the API from the repository root:

```sh
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Example requests (also available in `/docs`):

```sh
curl "http://127.0.0.1:8000/api/astronauts"
curl "http://127.0.0.1:8000/api/measurements?astronaut_id=A1&kind=sleep_hours&from=2026-11-13T00:00:00Z&to=2026-11-14T23:59:59Z"
curl "http://127.0.0.1:8000/api/measurements?kind=co2_ppm&limit=2&offset=0"
curl "http://127.0.0.1:8000/api/dashboard"
curl "http://127.0.0.1:8000/api/followups?status=pending"
```

The seed returns four astronauts, two sleep observations for A1 (5.2 and 5.4 h), and CO₂ observations 680, 950, 980 and 2200 ppm. The last CO₂ observation is suspect, so the dashboard shows 980 ppm. With no investigation, new usable data is indicated and no alert is fabricated. POST a new valid measurement using the existing API, then GET history/dashboard again to observe the updated reading without an automatic analysis.

`backend/tests/test_history_api.py` covers the seed, empty storage, combined/inclusive UTC filters, invalid periods, pagination with tied timestamps, unknown profiles, suspect/missing observations, independent sensor times, agenda filters and read-only behavior. The existing measurement tests cover freshness after a crew investigation and delayed new recordings. Run the repository checks before review:

```sh
python scripts/check.py
```
