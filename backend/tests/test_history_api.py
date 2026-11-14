"""AKM-19: exercise persisted history, habitat snapshots and read-only agenda."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func
from sqlmodel import Session, select

from app.main import app
from app.models import Astronaut, Followup, Investigation, Measurement
from app.seed import observations, seed


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "history.db"))
    with TestClient(app) as client:
        yield client


@pytest.fixture
def seeded(client):
    seed(app.state.engine)
    return client


def test_empty_storage_is_explicit_and_reads_do_not_create_rows(client):
    for route in ("astronauts", "measurements", "followups"):
        response = client.get(f"/api/{route}")
        assert response.status_code == 200
        assert response.json() == []
    snapshot = client.get("/api/dashboard").json()
    assert snapshot["astronauts"] == []
    assert snapshot["alerts"] == snapshot["pending_followups"] == []
    assert snapshot["last_investigation_at"] is None
    assert snapshot["has_unanalyzed_measurements"] is False
    assert snapshot["environment"] == {
        "co2_ppm": None, "cabin_temp_c": None, "measured_at": None,
        "measurement_zone": "habitat",
    }
    assert snapshot["mission"]["destination"] == "mars_surface"
    with Session(app.state.engine) as session:
        for model in (Astronaut, Measurement, Investigation, Followup):
            assert session.exec(select(func.count()).select_from(model)).one() == 0


def test_profiles_and_complete_synthetic_history(seeded):
    profiles = seeded.get("/api/astronauts").json()
    assert [row["id"] for row in profiles] == ["A1", "A2", "A3", "A4"]
    assert profiles[0]["baseline_sleep_hours"] == 8
    response = seeded.get("/api/measurements")
    assert response.status_code == 200
    history = response.json()
    assert len(history) == len(observations())
    assert {row["source"] for row in history} == {"synthetic"}
    assert [row["id"] for row in history] == [row["id"] for row in sorted(
        history, key=lambda row: (row["measured_at"], row["id"]),
    )]
    assert all(row["measured_at"].endswith("Z") and row["recorded_at"].endswith("Z") for row in history)
    # Preserve gaps rather than making up zero-valued observations.
    mood = seeded.get("/api/measurements", params={"astronaut_id": "A3", "kind": "mood_score"}).json()
    assert len(mood) == 1 and mood[0]["value"] == 3


def test_combined_filters_are_inclusive_and_use_observation_time(seeded):
    response = seeded.get("/api/measurements", params={
        "astronaut_id": "A1", "kind": "sleep_hours",
        "from": "2026-11-14T04:00:00-03:00", "to": "2026-11-14T07:00:00Z",
    })
    assert response.status_code == 200, response.text
    assert [row["value"] for row in response.json()] == [5.4]
    assert response.json()[0]["measured_at"] == "2026-11-14T07:00:00Z"
    assert seeded.get("/api/measurements", params={"from": "2027-01-01T00:00:00Z"}).json() == []
    assert len(seeded.get("/api/measurements", params={"to": "2026-11-12T20:00:00Z"}).json()) == 2


def test_habitat_history_keeps_suspect_samples_but_snapshot_uses_usable_values(seeded):
    history = seeded.get("/api/measurements", params={"kind": "co2_ppm"}).json()
    assert [row["value"] for row in history] == [680, 950, 980, 2200]
    assert all(row["astronaut_id"] is None and row["measurement_zone"] == "habitat" for row in history)
    assert history[-1]["quality"] == "suspect"
    # Different sensor timestamps must not be represented as simultaneous.
    response = seeded.post("/api/measurements", json={
        "kind": "cabin_temp_c", "value": 0, "unit": "C", "source": "manual",
        "measured_at": "2026-11-14T08:00:00Z",
    })
    assert response.status_code == 201
    snapshot = seeded.get("/api/dashboard").json()
    assert snapshot["environment"] == {
        "co2_ppm": 980, "cabin_temp_c": 0, "measured_at": "2026-11-14T08:00:00Z",
        "measurement_zone": "habitat",
    }
    assert snapshot["has_unanalyzed_measurements"] is True
    assert snapshot["last_investigation_at"] is None
    assert snapshot["alerts"] == []
    with Session(app.state.engine) as session:
        assert session.exec(select(Investigation.id)).all() == []


def test_stable_pagination_does_not_drop_equal_timestamp_samples(seeded):
    complete = seeded.get("/api/measurements").json()
    paged = []
    for offset in range(0, len(complete) + 3, 3):
        response = seeded.get("/api/measurements", params={"limit": 3, "offset": offset})
        assert response.status_code == 200
        paged.extend(response.json())
    assert paged == complete


def test_offset_respects_sqlite_integer_boundary(seeded):
    maximum = 2**63 - 1
    response = seeded.get("/api/measurements", params={"offset": str(maximum)})
    assert response.status_code == 200
    assert response.json() == []

    for offset in (maximum + 1, 10**100):
        response = seeded.get("/api/measurements", params={"offset": str(offset)})
        assert response.status_code == 422
        error = response.json()["detail"][0]
        assert error["loc"] == ["query", "offset"]
        assert error["type"] == "less_than_equal"


@pytest.mark.parametrize("params", [
    {"kind": "unknown"}, {"astronaut_id": ""}, {"from": "2026-11-14"},
    {"to": "2026-11-14T07:00:00"}, {"from": "1794639600"},
    {"from": "2026-11-15T00:00:00Z", "to": "2026-11-14T00:00:00Z"},
    {"from": "0001-01-01T00:00:00+01:00"},
    {"to": "9999-12-31T23:59:59-01:00"},
    {"limit": 0}, {"limit": 1001}, {"offset": -1}, {"limit": "invalid"},
])
def test_invalid_history_query_returns_422(seeded, params):
    response = seeded.get("/api/measurements", params=params)
    assert response.status_code == 422
    assert response.json()["detail"]


@pytest.mark.parametrize("route", ["measurements", "followups"])
def test_unknown_astronaut_is_404(seeded, route):
    response = seeded.get(f"/api/{route}", params={"astronaut_id": "A99"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Astronaut not found"}


def test_agenda_filters_and_pending_dashboard_are_read_only(seeded):
    stamp = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
    with Session(app.state.engine) as session, session.begin():
        investigation = Investigation(
            scope="crew", status="attention", created_at=stamp, rules_version="demo-v1",
            input_fingerprint="a" * 64, result_json="{}",
        )
        session.add(investigation)
        session.flush()
        measurement_id = session.exec(select(Measurement.id).where(
            Measurement.astronaut_id == "A1", Measurement.kind == "sleep_hours",
        )).first()
        session.add_all([
            Followup(investigation_id=investigation.id, kind="co2_ppm", reason="Check habitat",
                     created_at=stamp, due_at=stamp + timedelta(hours=1)),
            Followup(investigation_id=investigation.id, astronaut_id="A1", kind="sleep_hours",
                     reason="Repeat sleep log", created_at=stamp),
            Followup(investigation_id=investigation.id, astronaut_id="A1", kind="sleep_hours",
                     reason="Earlier completed check", created_at=stamp - timedelta(days=2),
                     status="completed", completed_at=stamp, measurement_id=measurement_id),
        ])
    complete = seeded.get("/api/followups").json()
    assert len(complete) == 3
    assert complete[0]["status"] == "completed"
    assert complete[0]["completed_at"].endswith("Z")
    filtered = seeded.get("/api/followups", params={"astronaut_id": "A1", "status": "pending"}).json()
    assert len(filtered) == 1 and filtered[0]["reason"] == "Repeat sleep log"
    assert len(seeded.get("/api/followups", params={"status": "completed"}).json()) == 1
    assert seeded.get("/api/followups", params={"status": "invalid"}).status_code == 422
    snapshot = seeded.get("/api/dashboard").json()
    assert len(snapshot["pending_followups"]) == 2
    assert snapshot["last_investigation_at"] == "2026-11-14T08:00:00Z"
    assert snapshot["has_unanalyzed_measurements"] is False
    assert seeded.get("/api/followups").json() == complete
    with Session(app.state.engine) as session:
        assert len(session.exec(select(Investigation)).all()) == 1


def test_openapi_documents_filters_and_canonical_list_responses(client):
    paths = client.get("/openapi.json").json()["paths"]
    history = paths["/api/measurements"]["get"]
    assert {p["name"] for p in history["parameters"]} == {
        "astronaut_id", "kind", "from", "to", "limit", "offset",
    }
    assert {"200", "404", "422"} <= history["responses"].keys()
    for route in ("astronauts", "measurements", "followups"):
        schema = paths[f"/api/{route}"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        assert schema["type"] == "array"
