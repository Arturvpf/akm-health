"""AKM-13: dashboard values and provenance must come from the same usable row."""

from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session, select

from app.main import app
from app.models import Investigation
from app.seed import seed


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "dashboard.db"))
    with TestClient(app) as client:
        seed(app.state.engine)
        yield client


def test_snapshot_keeps_actual_source_of_each_personal_observation(client):
    response = client.post("/api/measurements", json={
        "astronaut_id": "A1", "kind": "sleep_hours", "value": 0, "unit": "h",
        "measured_at": "2026-11-14T10:00:00Z", "source": "manual",
    })
    assert response.status_code == 201
    snapshot = client.get("/api/dashboard").json()
    person = snapshot["astronauts"][0]
    assert person["latest_metrics"]["sleep_hours"] == {
        "value": 0, "unit": "h", "measured_at": "2026-11-14T10:00:00Z", "source": "manual",
    }
    assert person["latest_metrics"]["heart_rate_bpm"]["source"] == "synthetic"
    assert person["status"] == "insufficient_data"
    assert snapshot["last_investigation_at"] is None and snapshot["alerts"] == []
    with Session(app.state.engine) as session:
        assert session.exec(select(Investigation)).all() == []


def test_suspect_sample_never_changes_value_source_or_timestamp_of_summary(client):
    before = client.get("/api/dashboard").json()
    response = client.post("/api/measurements", json={
        "kind": "co2_ppm", "value": 3000, "unit": "ppm", "source": "manual", "quality": "suspect",
        "measured_at": "2026-11-14T11:00:00Z",
    })
    assert response.status_code == 201
    after = client.get("/api/dashboard").json()
    assert after["environment"] == before["environment"]
    assert after["environment"]["latest_metrics"]["co2_ppm"]["source"] == "synthetic"


def test_equal_observation_timestamps_use_id_for_both_value_and_source(client):
    for value, source in ((800, "synthetic"), (810, "manual")):
        assert client.post("/api/measurements", json={
            "kind": "co2_ppm", "value": value, "unit": "ppm", "source": source,
            "measured_at": "2026-11-14T10:00:00Z",
        }).status_code == 201
    environment = client.get("/api/dashboard").json()["environment"]
    assert environment["co2_ppm"] == environment["latest_metrics"]["co2_ppm"]["value"] == 810
    assert environment["latest_metrics"]["co2_ppm"]["source"] == "manual"
    assert environment["latest_metrics"]["cabin_temp_c"]["measured_at"] == "2026-11-14T05:00:00Z"
