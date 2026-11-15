"""AKM-20 HTTP demonstration using an isolated temporary SQLite database."""

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from fastapi.testclient import TestClient
    from sqlmodel import Session
    from app import investigations
    from app.main import app
    from app.models import Measurement
    from app.seed import RECHECK, seed

    # Freeze only this isolated demonstration so the fixed synthetic dates do not age.
    clock = [datetime(2026, 11, 14, 8, tzinfo=timezone.utc)]
    previous_clock = investigations.utc_now
    previous_path = os.environ.get("AKM_DB_PATH")
    with TemporaryDirectory(prefix="akm20-") as directory:
        try:
            os.environ["AKM_DB_PATH"] = str(Path(directory) / "demo.db")
            investigations.utc_now = lambda: clock[0]
            with TestClient(app) as client:
                seed(app.state.engine)
                first = client.post("/api/investigations/run", json={"scope": "crew"})
                first.raise_for_status()
                result = first.json()
                repeat = client.post("/api/investigations/run", json={"scope": "crew"})
                repeat.raise_for_status()
                assert repeat.json() == {**result, "reused": True}
                recovered = client.get(f'/api/investigations/{result["id"]}')
                recovered.raise_for_status()
                assert recovered.json() == result

                clock[0] = datetime(2026, 11, 14, 15, 10, tzinfo=timezone.utc)
                with Session(app.state.engine) as session:
                    sample = Measurement.from_payload(RECHECK, recorded_at=clock[0] - timedelta(minutes=1))
                    session.add(sample)
                    session.commit()
                    id = sample.id
                completion = client.patch(f'/api/followups/{result["followup_id"]}', json={
                    "status": "completed", "measurement_id": id,
                })
                completion.raise_for_status()
                replay = client.patch(f'/api/followups/{result["followup_id"]}', json={
                    "status": "completed", "measurement_id": id,
                })
                assert replay.json() == completion.json()
                dashboard = client.get("/api/dashboard")
                dashboard.raise_for_status()
                updated = client.post("/api/investigations/run", json={"scope": "crew"})
                updated.raise_for_status()
                assert updated.json()["id"] != result["id"]
                print(json.dumps({
                    "demo_only": True, "isolated_database": True,
                    "initial_result": result, "repeat_reused": repeat.json()["reused"],
                    "completion": completion.json(),
                    "new_data_requires_explicit_run": dashboard.json()["has_unanalyzed_measurements"],
                    "updated_investigation_id": updated.json()["id"],
                }, indent=2, ensure_ascii=True))
        finally:
            investigations.utc_now = previous_clock
            if previous_path is None:
                os.environ.pop("AKM_DB_PATH", None)
            else:
                os.environ["AKM_DB_PATH"] = previous_path


if __name__ == "__main__":
    main()
