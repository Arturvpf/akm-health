# AKM-16 · Investigation and routine interface

Card AKM-16 (internal Notion page; Portuguese, not part of the submission) · Architecture (internal Notion page; Portuguese, not part of the submission) · [AKM-04 flow](akm-04-investigation-flow.md)

The **Investigation** screen offers crew and individual scopes. Running is explicit and shows the experimental result with its ID, UTC time, scope and version. A `reused: true` response keeps the ID, the time and the reference of the original check. The screen recovers the last number opened in this session by GET, accepts recovery by number and offers access to the investigation that originated a check. The saved result describes the original decision. The agenda separately reads the current state and keeps the server's priority order.

Findings, coverage, evidence, unconfirmed hypotheses, uncertainty, NASA HRP references, the check decision and human review appear in their own sections. Absent coverage signals a gap in the record. Empty coverage signals insufficient data for the scope. Referral uses the server's instruction and contact is manual. The references accompany the analysis as research context. [AKM-26 explanation](akm-26-investigation-explanation.md)

To complete a check, select a persisted measurement of the same indicator, target and zone. The list requires valid quality and a registration after the request. When the HTTP `Date` header is available, it uses the second reported by the API to filter future dates, with one second of tolerance for header caching. The server validates the exact time at the link and returns the completion date. An older reading can serve if it was registered after the request, as the contract allows. Re-analysis is a later, explicit action. The interface queries the dashboard on opening, after running and after trying to link, to update the indication of measurements waiting for analysis in the mission. [AKM-20 persistence](../akm-20-investigation-persistence.md) · [AKM-25 agenda](../akm-25-adaptive-routine.md)

With no observations, the engine can return insufficient data and the screen explains the gap. During loading and on failures, the last confirmed result keeps its classification and time. The interface lets you correct the number or the crew member, repeat the run or the recovery, and refresh the agenda and measurements. An uncertain response to the link triggers a read of the agenda before another attempt. If the completion exists, the screen shows the measurement the server confirmed.

## Reproduce in the browser

Prepare the dependencies as in the [README](../../README.md). In PowerShell, at the root, choose a new SQLite database for the demo. The example below shifts the synthetic fixture's dates close to the current clock and enables the agenda's demo policy.

```powershell
$env:AKM_DB_PATH = Join-Path ([System.IO.Path]::GetTempPath()) ("akm16-" + [guid]::NewGuid() + ".db")
$env:AKM_INVESTIGATION_CONFIG = (Resolve-Path backend/app/routine_demo_config.json).Path
$env:PYTHONPATH = (Resolve-Path backend).Path
@'
from datetime import datetime, timedelta, timezone
from app import seed
from app.db import make_engine

original = seed.observations
shift = datetime.now(timezone.utc) - timedelta(hours=1) - seed.NIGHT_2
seed.observations = lambda: [
    item.model_copy(update={"measured_at": item.measured_at + shift})
    for item in original()
]
engine = make_engine()
seed.seed(engine)
engine.dispose()
'@ | python -
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

In another terminal, run `npm --prefix frontend run dev` and open `http://127.0.0.1:5173/#/investigation`.

1. Run the crew investigation. Check the experimental sleep finding, A1 to A4 in the coverage, the open environmental hypothesis and the habitat CO₂ check with its justification. Run again and check the reuse message, the same ID and no duplicates.
2. Open the CO₂ check in the agenda. Completion is only available with an eligible measurement. Record a new habitat CO₂ reading and return to the agenda. In a version of the shell that still shows the Register preview, use the command below to write the reading.
3. Refresh the measurements, select the returned number and link it. Check the check leaving the pending list, the measurement ID and the completion time. Other checks stay in the agenda. Re-analyze the same scope and check a new ID. The result depends on the new window and the engine's inputs.
4. Choose the individual scope and Lyra (A4). Run and check the scope. Recover the crew result by number or from the agenda and check the original time.
5. For the empty scenario, open the API with another database, without loading the fixture. To check retries, cut the connection before re-analyzing and reconnect to repeat. The confirmed result must stay visible during the failure.

```powershell
$body = @{
  kind = 'co2_ppm'
  value = 850
  unit = 'ppm'
  measured_at = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fff'Z'")
  source = 'synthetic'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/measurements' -Method Post -ContentType 'application/json' -Body $body
```

The [AKM-11 script](akm-11-accessible-design-system.md) describes the accessibility states and components of the demo.

The `node --test frontend/scripts/test-investigation-api.cjs` test covers a slow browser clock, the seconds precision of the HTTP time and a missing header.
