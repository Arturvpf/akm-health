from datetime import datetime
import sqlite3
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import app
from app.db import connect
from app.schemas import MeasurementCreate, InvestigationRunRequest, FollowupCompleteRequest


def payload(**updates):
    body = {"astronaut_id":"A1","kind":"sleep_hours","value":5.2,"unit":"h","measured_at":"2026-11-14T14:00:00Z","source":"synthetic"}
    body.update(updates)
    return body


def test_local_health_and_sqlite(tmp_path, monkeypatch):
    path = tmp_path / "akm.db"
    monkeypatch.setenv("AKM_DB_PATH", str(path))
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status":"ok","storage":"sqlite_reachable"}
    assert path.exists()
    with connect() as db:
        assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        db.execute("CREATE TABLE IF NOT EXISTS smoke (id INTEGER PRIMARY KEY, value REAL)")
        db.execute("INSERT INTO smoke (value) VALUES (?)", (5.2,))
        db.commit()
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT value FROM smoke").fetchone()[0] == 5.2


def test_openapi_available():
    response = TestClient(app).get("/openapi.json")
    assert response.status_code == 200
    assert "/api/health" in response.json()["paths"]


def test_measurement_contract_ok():
    value = MeasurementCreate(**payload())
    assert value.zone() == "astronaut"
    assert value.model_dump(mode="json")["measured_at"].endswith("Z")


@pytest.mark.parametrize("changes", [
    {"unit":"ppm"}, {"astronaut_id":None}, {"value":float("nan")},
    {"measured_at":"2026-11-14T14:00:00"}, {"kind":"unknown"},
    {"kind":"mood_score","unit":"score_1_to_5","value":3.5},
    {"kind":"co2_ppm","unit":"ppm","astronaut_id":"A1"},
    {"kind":"co2_ppm","unit":"ppm","astronaut_id":None,"value":-1},
    {"measurement_zone":"astronaut"},
])
def test_measurement_contract_rejects_invalid(changes):
    with pytest.raises(ValidationError):
        MeasurementCreate(**payload(**changes))


def test_habitat_zone():
    value = MeasurementCreate(**payload(astronaut_id=None,kind="co2_ppm",unit="ppm",value=900))
    assert value.zone() == "habitat"


def test_api_validation_422():
    response = TestClient(app).post("/api/_contract/validate-measurement",json=payload(unit="ppm"))
    assert response.status_code == 422


def test_scope_contract():
    assert InvestigationRunRequest(scope="crew").scope == "crew"
    with pytest.raises(ValidationError):
        InvestigationRunRequest(scope="individual")
    with pytest.raises(ValidationError):
        InvestigationRunRequest(scope="crew", astronaut_id="A1")


def test_followup_contract():
    assert FollowupCompleteRequest(status="completed",measurement_id=123).measurement_id == 123
    with pytest.raises(ValidationError):
        FollowupCompleteRequest(status="completed",measurement_id=0)
    with pytest.raises(ValidationError):
        FollowupCompleteRequest(status="completed")
