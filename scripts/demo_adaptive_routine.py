"""AKM-25: reproduce the configured agenda in an isolated temporary mission."""

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory


def main() -> None:
    backend = Path(__file__).resolve().parents[1] / "backend"
    sys.path.insert(0, str(backend))
    from fastapi.testclient import TestClient
    from sqlmodel import Session
    from app import investigations
    from app.main import app
    from app.models import Measurement
    from app.schemas import MeasurementCreate
    from app.seed import seed

    previous_env = {key: os.environ.get(key) for key in ("AKM_DB_PATH", "AKM_INVESTIGATION_CONFIG")}
    previous_clock = investigations.utc_now
    clock = [datetime(2026, 11, 14, 8, tzinfo=timezone.utc)]
    with TemporaryDirectory(prefix="akm25-") as directory:
        try:
            os.environ["AKM_DB_PATH"] = str(Path(directory) / "demo.db")
            os.environ["AKM_INVESTIGATION_CONFIG"] = str(backend / "app" / "routine_demo_config.json")
            investigations.utc_now = lambda: clock[0]
            with TestClient(app) as client:
                seed(app.state.engine)
                def investigate():
                    response = client.post("/api/investigations/run", json={"scope": "crew"})
                    response.raise_for_status()
                    return response.json()
                def pending():
                    response = client.get("/api/followups", params={"status": "pending"})
                    response.raise_for_status()
                    return response.json()
                first = investigate()
                initial = pending()
                assert len(initial) == 3 and initial[0]["kind"] == "co2_ppm"
                assert investigate() == {**first, "reused": True}
                assert pending() == initial
                mood = next(row for row in initial if row["kind"] == "mood_score")
                clock[0] += timedelta(minutes=5)
                with Session(app.state.engine) as session:
                    sample = Measurement.from_payload(MeasurementCreate(
                        kind="mood_score", astronaut_id="A3", value=3, unit="score_1_to_5",
                        measured_at=clock[0], source="synthetic",
                    ), recorded_at=clock[0])
                    session.add(sample)
                    session.commit()
                    id = sample.id
                completion = client.patch(f'/api/followups/{mood["id"]}', json={
                    "status": "completed", "measurement_id": id,
                })
                completion.raise_for_status()
                assert len(pending()) == 2
                updated = investigate()
                assert updated["id"] != first["id"] and len(pending()) == 2
                clock[0] = datetime(2026, 11, 15, tzinfo=timezone.utc)
                next_window = investigate()
                later = pending()
                new_mood = next(row for row in later if row["kind"] == "mood_score" and row["astronaut_id"] == "A3")
                assert new_mood["id"] != mood["id"]
                assert len({(row["kind"], row["astronaut_id"]) for row in later}) == len(later) == 14
                assert next_window["input_fingerprint"] != updated["input_fingerprint"]
                print(json.dumps({
                    "demo_only": True, "isolated_database": True, "initial_agenda": initial,
                    "completed": completion.json(), "next_window_pending_count": len(later),
                    "new_mood_followup_id": new_mood["id"],
                    "explicit_investigation_ids": [first["id"], updated["id"], next_window["id"]],
                }, indent=2, ensure_ascii=True))
        finally:
            investigations.utc_now = previous_clock
            for key, value in previous_env.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value


if __name__ == "__main__":
    main()
