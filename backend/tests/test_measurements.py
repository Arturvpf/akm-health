from datetime import datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func
from sqlmodel import Session, select

from app.main import app
from app.models import Astronaut, Investigation, Measurement
from app.schemas import MeasurementRead


SLEEP = {
    "astronaut_id": "A1",
    "kind": "sleep_hours",
    "value": 5.2,
    "unit": "h",
    "measured_at": "2026-11-14T11:00:00-03:00",
    "source": "manual",
}


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "measurements.db"))
    with TestClient(app) as client:
        with Session(app.state.engine) as session, session.begin():
            session.add(Astronaut(id="A1", name="Aurora", baseline_sleep_hours=8))
        yield client


def test_openapi_documents_write_responses(client):
    operation = client.get("/openapi.json").json()["paths"]["/api/measurements"]["post"]
    assert {"201", "404", "422"} <= operation["responses"].keys()
    assert operation["responses"]["201"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/MeasurementRead"
    )


def test_register_crew_sleep_and_update_dashboard(client):
    before = client.get("/api/dashboard").json()
    assert before["mission"]["destination"] == "mars_surface"
    assert before["astronauts"][0]["status"] == "insufficient_data"
    assert before["astronauts"][0]["latest_metrics"] == {}
    assert before["environment"]["co2_ppm"] is None
    assert before["has_unanalyzed_measurements"] is False

    response = client.post("/api/measurements", json=SLEEP)
    assert response.status_code == 201
    body = response.json()
    assert body["measurement_zone"] == "astronaut"
    assert body["measured_at"] == "2026-11-14T14:00:00Z"
    assert body["recorded_at"].endswith("Z")
    assert body["quality"] == "ok"
    with Session(app.state.engine) as session:
        row = session.get(Measurement, body["id"])
        assert MeasurementRead.model_validate(row, from_attributes=True).model_dump(mode="json") == body
        assert session.exec(select(Investigation.id)).all() == []
    after = client.get("/api/dashboard").json()
    assert after["has_unanalyzed_measurements"] is True
    assert after["last_investigation_at"] is None
    assert after["alerts"] == []
    assert after["astronauts"][0]["latest_metrics"]["sleep_hours"]["value"] == 5.2


def test_register_suspect_cabin_reading_and_keep_latest_usable_value(client):
    cabin = {
        "kind": "co2_ppm", "value": 980, "unit": "ppm",
        "measured_at": "2026-11-14T09:00:00Z", "source": "synthetic",
    }
    suspect = client.post("/api/measurements", json=cabin | {
        "quality": "suspect", "value": 2200, "measured_at": "2026-11-14T10:00:00Z",
    })
    assert suspect.status_code == 201
    assert suspect.json()["astronaut_id"] is None
    assert suspect.json()["measurement_zone"] == "habitat"
    assert suspect.json()["quality"] == "suspect"
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["has_unanalyzed_measurements"] is False
    assert dashboard["environment"]["co2_ppm"] is None
    assert client.post("/api/measurements", json=cabin).status_code == 201
    assert client.get("/api/dashboard").json()["environment"]["co2_ppm"] == 980
    with Session(app.state.engine) as session:
        assert session.get(Measurement, suspect.json()["id"]).quality == "suspect"


def test_new_data_compares_recording_time_to_latest_crew_analysis(client):
    first = client.post("/api/measurements", json=SLEEP)
    assert first.status_code == 201
    recorded_at = datetime.fromisoformat(first.json()["recorded_at"])
    with Session(app.state.engine) as session, session.begin():
        session.add_all([
            Investigation(
                scope="crew", status="attention", created_at=recorded_at, rules_version="demo-v1",
                input_fingerprint="1" * 64, result_json="{}",
            ),
            Investigation(
                scope="individual", astronaut_id="A1", status="attention", rules_version="demo-v1",
                created_at=recorded_at + timedelta(days=1), input_fingerprint="2" * 64, result_json="{}",
            ),
        ])
    assert client.get("/api/dashboard").json()["has_unanalyzed_measurements"] is False
    second = client.post("/api/measurements", json=SLEEP | {"measured_at": "2026-11-13T14:00:00Z"})
    assert second.status_code == 201
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["last_investigation_at"] == first.json()["recorded_at"]
    assert dashboard["has_unanalyzed_measurements"] is True


@pytest.mark.parametrize("changes, status", [
    ({"astronaut_id": "A99"}, 404),
    ({"astronaut_id": None}, 422),
    ({"unit": "ppm"}, 422),
    ({"value": 25}, 422),
    ({"value": True}, 422),
    ({"value": "5.2"}, 422),
    ({"measured_at": "2026-11-14T11:00:00"}, 422),
    ({"measured_at": 1794664800}, 422),
    ({"measured_at": "1794664800"}, 422),
    ({"measured_at": "0001-01-01T00:00:00+01:00"}, 422),
    ({"measured_at": "9999-12-31T23:59:59-01:00"}, 422),
    ({"kind": "mood_score", "unit": "score_1_to_5", "value": 3.5}, 422),
    ({"kind": "co2_ppm", "unit": "ppm"}, 422),
    ({"source": "NASA"}, 422),
    ({"quality": "bad"}, 422),
    ({"measurement_zone": "astronaut"}, 422),
    ({"recorded_at": "2026-11-14T11:00:00Z"}, 422),
])
def test_invalid_write_does_not_persist(client, changes, status):
    response = client.post("/api/measurements", json=SLEEP | changes)
    assert response.status_code == status
    assert "detail" in response.json()
    with Session(app.state.engine) as session:
        assert session.exec(select(func.count(Measurement.id))).one() == 0


def test_overflow_is_rejected_without_writing(client):
    response = client.post(
        "/api/measurements",
        content='{"kind":"co2_ppm","value":1e400,"unit":"ppm",'
                '"measured_at":"2026-11-14T14:00:00Z","source":"manual"}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "finite_number"
    with Session(app.state.engine) as session:
        assert session.exec(select(func.count(Measurement.id))).one() == 0
