"""Implausible values, future timestamps and oversized bodies are rejected before anything is stored."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import MAX_BODY_BYTES, app
from app.seed import seed


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "safety.db"))
    with TestClient(app) as test_client:
        seed(app.state.engine)
        yield test_client


def payload(kind="heart_rate_bpm", value=70, unit="bpm", subject="A1", at=None):
    stamp = (at or datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
    return {"kind": kind, "astronaut_id": subject, "value": value, "unit": unit,
            "measured_at": stamp, "source": "manual", "quality": "ok"}


@pytest.mark.parametrize("kind,value,unit,subject", [
    ("heart_rate_bpm", 0, "bpm", "A1"), ("heart_rate_bpm", 19, "bpm", "A1"), ("heart_rate_bpm", 251, "bpm", "A1"),
    ("heart_rate_bpm", 1e9, "bpm", "A1"), ("co2_ppm", -1, "ppm", None), ("co2_ppm", 40001, "ppm", None),
    ("cabin_temp_c", -21, "C", None), ("cabin_temp_c", 61, "C", None), ("cabin_temp_c", 1e6, "C", None),
])
def test_implausible_values_are_rejected(client, kind, value, unit, subject):
    before = len(client.get("/api/measurements", params={"limit": 1000}).json())
    assert client.post("/api/measurements", json=payload(kind, value, unit, subject)).status_code == 422
    assert len(client.get("/api/measurements", params={"limit": 1000}).json()) == before


@pytest.mark.parametrize("kind,value,unit,subject", [
    ("heart_rate_bpm", 20, "bpm", "A1"), ("heart_rate_bpm", 250, "bpm", "A1"), ("co2_ppm", 40000, "ppm", None),
    ("cabin_temp_c", -20, "C", None), ("cabin_temp_c", 60, "C", None),
])
def test_boundary_values_are_accepted(client, kind, value, unit, subject):
    assert client.post("/api/measurements", json=payload(kind, value, unit, subject)).status_code == 201


def test_future_timestamps_are_rejected_but_small_clock_drift_is_allowed(client):
    now = datetime.now(timezone.utc)
    far = client.post("/api/measurements", json=payload(at=now + timedelta(hours=1)))
    assert far.status_code == 422 and "future" in far.json()["detail"]
    assert client.post("/api/measurements", json=payload(at=now + timedelta(minutes=5))).status_code == 201
    body = {"operation_id": str(uuid4()), "measurement": payload(at=now + timedelta(days=2))}
    assert client.post("/api/sync/measurements", json=body).status_code == 422


def test_oversized_bodies_get_413_before_parsing(client):
    big = payload()
    big["padding"] = "x" * (MAX_BODY_BYTES + 10)
    response = client.post("/api/measurements", json=big)
    assert response.status_code == 413 and response.json() == {"detail": "Request body too large"}
    chunked = client.post("/api/measurements", content=(b"{" + b" " * (MAX_BODY_BYTES + 10) + b"}" for _ in [0]),
                          headers={"content-type": "application/json"})
    assert chunked.status_code == 413
    assert client.post("/api/measurements", json=payload()).status_code == 201
