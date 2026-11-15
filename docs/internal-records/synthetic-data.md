# ODYSSEY-26 · AKM-27 simulated data

The profiles and all the observations below are **simulated** and meant for demonstration. The set lives in [`backend/app/seed.py`](../../backend/app/seed.py), with versions traceable through Git. The metrics and units follow the [AKM-06 protocol](../akm-06-measurement-protocol.md) and the canonical data dictionary in Notion (internal Notion page; Portuguese, not part of the submission).

## Load and repeat

In the project environment, run from `backend/`.

```sh
python -m app.seed
python -m app.seed
```

On a new database, the first run adds **4 profiles and 29 measurements**. The second adds zero. Use `AKM_DB_PATH` to choose a separate database. The migration is applied before the load. The transaction checks the combination of astronaut, type, collection time and origin, with support for a null astronaut. Existing records, including manual measurements at the same time, are preserved.

The default seed keeps the recheck out of the initial load. After creating a follow-up for cabin CO₂, run `python -m app.seed --with-recheck`. This adds a simulated 850 ppm reading at 15:00 UTC on 14/11/2026. The registration receives the real run time. Repeating the option preserves the measurement and its original registration time. The ID of that measurement can complete the follow-up before the re-analysis. The [AKM-29 HTTP script](akm-29-investigation-engine-validation.md#reproduction) presents the flow on an isolated database.

## Sample dictionary

| Indicator | Unit | Subject | Composition |
| --- | --- | --- | --- |
| `sleep_hours` | `h` | Crew member | 8 readings, two per profile |
| `heart_rate_bpm` | `bpm` | Crew member | 7 readings, with one gap for Lyra |
| `mood_score` | `score_1_to_5` | Crew member | 7 readings, with one gap for Vega |
| `co2_ppm` | `ppm` | Cabin | 3 reliable, 1 suspect and an optional recheck |
| `cabin_temp_c` | `C` | Cabin | 3 readings |

The two nights have records at 07:00 UTC on 13 and 14/11/2026. The initial seed uses a simulated `recorded_at` five minutes after each collection and `source=synthetic`. Cabin readings use `astronaut_id=null`. The gaps correspond to missing measurements. The 2,200 ppm CO₂ at 05:05 UTC on 14/11 has `quality=suspect` as an example of data with uncertain quality.

## Verification cases

- **Collective and normal.** The two nights of Aurora (A1), Orion (A2) and Vega (A3) meet the AKM-04 synthetic criterion. Lyra (A4) stays outside the finding.
- **Environment.** The reliable CO₂ sequence is 680 → 950 → 980 ppm. Temperature varies between 22.1 and 22.2 °C. The temporal coincidence supports a demonstration hypothesis with uncertainty.
- **Gaps and quality.** Vega lacks mood and Lyra lacks heart rate on the second day. The suspect CO₂ reading remains available to test evidence filtering.
- **NASA history unavailable.** `GET /api/nasa/references` presents NASA HRP scientific references, `historical_data_status=not_imported` and an empty series before and after the seed. The import of historical telemetry and its presentation in the interface continue in AKM-39.

Run `python -m pytest -q backend` from the root to verify units, provenance, the sleep sequence, concurrent re-execution and the recheck link in persistence. The end-to-end test with engine and interface belongs to AKM-30.

## AKM-28 investigation scenarios

The [fixtures file](../../backend/tests/fixtures/odyssey-26-scenarios.json) reuses the AKM-27 profiles and times. Each case describes the scope, the changes to the base sample and the result expected from the engine.

| Case | Inputs | Expected result |
| --- | --- | --- |
| Collective | Four profiles with two comparable nights. A1, A2 and A3 at or below 80% of their baselines on both nights. Cabin CO₂ of 680 → 950 → 980 ppm. | `attention` by the synthetic heuristic. Show the temporal coincidence with `unconfirmed` uncertainty and ask for a new CO₂ measurement. Simultaneity guides the check and leaves the cause open. |
| Individual | Aurora stays at 5.2 h and 5.4 h. A2, A3 and A4 stay within the demonstration reference. CO₂ stable at 680 ppm. | `attention` in A1's individual scope. No crew pattern or sustained environmental hypothesis. Next sleep measurement for A1. |
| Insufficient data | A2, A3 and A4 have only one night available and CO₂ readings are missing. | `insufficient_data` in the collective investigation. A1's individual deviation remains observable. Request a second night of sleep, using A2 as the example target in the fixture. |
| Uncertain environment | Repeat the collective pattern with CO₂ suspect, outside the time window or absent. | Preserve the sleep evidence and indicate the lack of support for the environmental coincidence. Collect or check a comparable reading before inferring an association. |

From the root, run `python -m pytest -q backend/tests/test_scenarios.py`. The tests record the data through the API in temporary databases, run the investigation and check the results and limitations. The [AKM-29 report](akm-29-investigation-engine-validation.md) includes the sensor variants, the coverage matrix and the reproduction of the follow-up cycle.
