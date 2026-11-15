# AKM-15 · History and trends

Task AKM-15 (internal Notion page; Portuguese, not part of the submission) · [AKM-19 read contract](../akm-19-read-apis.md)

History loads the profiles and each person's sleep baseline from `GET /api/astronauts`. The first query shows the sleep of the first available profile. If the list is empty, it starts with the habitat CO₂. In each query, the indicator follows the selected target. Sleep, heart rate and mood use the crew member's ID. CO₂ and temperature use the habitat indicator. The client reads the pages of `GET /api/measurements` in order until it receives a short page.

The optional dates bound the collection in UTC, with the start and end days fully included. The chart shows the applied period and reports the range of the available observations. A UTC day with no collection is shown as a gap, including at the ends when the filter sets those dates. The line is broken at gaps and suspect readings. Each suspect reading stays as an × on the chart and as an identified row in the table. The table offers the values, units, collection and registration times, origin and quality of every observation. The sleep baseline comes from the simulated profile and serves as a descriptive reference. Quality states the technical condition of the reading.

Loading is announced and a new query cancels the previous one. The empty message offers a link to Register. On failure, the **Try again** action repeats the query with the applied filters, keeping the filled-in fields. Any page with an error invalidates the whole query. Dates out of order keep the previous query and send focus to the end of the period.

## How to reproduce

With the dependencies installed by the README, run `python -m app.seed` in `backend/`. From the root, start the API and the frontend in separate terminals.

```sh
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
npm --prefix frontend run dev
```

1. Open [local History](http://127.0.0.1:5173/#/history). The seed shows Aurora with 5.2 h and 5.4 h of sleep and an 8 h baseline.
2. Choose Lyra and **Heart rate**, filter from 13/11/2026 to 14/11/2026 and apply. The table shows 66 bpm on the 13th and the chart shows no sample on the 14th. Choose a period before the seed to see the empty state.
3. Clear the dates, select **Habitat** and **Internal CO₂**, and apply. The 2,200 ppm reading appears as suspect and the table identifies its simulated origin. Switch to **Cabin temperature** to check the unit in °C.
4. Stop the API and reapply the filters to see the failure. Start the API and use **Try again**. In a 320 px window, move through the filters with Tab and use the arrow keys in the scrollable chart and table regions.

```sh
node --test frontend/scripts/test-history.cjs
python -m pytest -q backend/tests/test_history_api.py
npm --prefix frontend run test:navigation
npm --prefix frontend run test:wireframe
npm --prefix frontend run build
```
