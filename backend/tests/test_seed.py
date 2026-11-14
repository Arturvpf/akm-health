from concurrent.futures import ThreadPoolExecutor
from datetime import timezone

from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session, select

from app.db import make_engine, migrate
from app.main import app
from app.models import Astronaut, Followup, Investigation, Measurement
from app.schemas import MeasurementCreate, MeasurementRead
from app.seed import NIGHT_2, RECHECK, seed


@pytest.fixture
def engine(tmp_path):
    engine = make_engine(tmp_path / "demo.db")
    yield engine
    engine.dispose()


def test_initial_seed_matches_scenario_and_repeats_without_duplicate_cabin_rows(engine):
    assert seed(engine) == (4, 29)
    assert seed(engine) == (0, 0)

    with Session(engine) as session:
        profiles = {row.id: row.baseline_sleep_hours for row in session.exec(select(Astronaut))}
        rows = session.exec(select(Measurement).order_by(Measurement.measured_at)).all()

    assert profiles == {"A1": 8.0, "A2": 7.5, "A3": 8.0, "A4": 7.8}
    assert len(rows) == 29
    sleep = {
        astronaut_id: [row.value for row in rows if row.kind == "sleep_hours" and row.astronaut_id == astronaut_id]
        for astronaut_id in profiles
    }
    assert sleep == {"A1": [5.2, 5.4], "A2": [5.6, 5.7], "A3": [5.3, 5.6], "A4": [7.7, 7.9]}
    assert {astronaut_id for astronaut_id, values in sleep.items()
            if all(value <= 0.8 * profiles[astronaut_id] for value in values)} == {"A1", "A2", "A3"}
    assert [row.value for row in rows if row.kind == "co2_ppm" and row.quality == "ok"] == [680, 950, 980]
    assert [row.kind for row in rows if row.quality == "suspect"] == ["co2_ppm"]
    assert {"mood_score", "heart_rate_bpm", "cabin_temp_c"} <= {row.kind for row in rows}
    absent = {(row.astronaut_id, row.kind) for row in rows if row.measured_at == NIGHT_2}
    assert ("A3", "mood_score") not in absent
    assert ("A4", "heart_rate_bpm") not in absent

    for row in rows:
        contract = MeasurementRead.model_validate(row, from_attributes=True)
        assert contract.source == "synthetic"
        assert contract.measured_at.tzinfo == timezone.utc
        assert contract.recorded_at > contract.measured_at
        assert (contract.astronaut_id is None) == (contract.measurement_zone == "habitat")


def test_concurrent_seed_is_atomic(engine):
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(seed, engine)
        second = pool.submit(seed, engine)

    assert sorted((first.result(), second.result())) == [(0, 0), (4, 29)]


def test_seed_preserves_manual_records_at_matching_time(engine):
    migrate(engine)
    manual = MeasurementCreate(
        kind="co2_ppm", value=700, unit="ppm", measured_at="2026-11-12T20:00:00Z", source="manual",
    )
    with Session(engine) as session, session.begin():
        session.add(Measurement.from_payload(manual))

    assert seed(engine) == (4, 29)
    assert seed(engine) == (0, 0)
    with Session(engine) as session:
        rows = session.exec(select(Measurement).where(
            Measurement.kind == manual.kind, Measurement.measured_at == manual.measured_at,
        )).all()
    assert {row.source: row.value for row in rows} == {"manual": 700, "synthetic": 680}


def test_optional_recheck_is_newer_than_request_and_can_be_linked(engine):
    assert seed(engine) == (4, 29)
    with Session(engine) as session, session.begin():
        investigation = Investigation(
            scope="crew", status="attention", created_at=NIGHT_2, rules_version="demo-v1",
            input_fingerprint="a" * 64, result_json='{"findings":[]}',
        )
        session.add(investigation)
        session.flush()
        followup = Followup(
            investigation_id=investigation.id, kind="co2_ppm", reason="Verify cabin CO₂",
            created_at=NIGHT_2,
        )
        session.add(followup)
        session.flush()
        followup_id = followup.id

    assert seed(engine, with_recheck=True) == (0, 1)
    assert seed(engine, with_recheck=True) == (0, 0)
    with Session(engine) as session, session.begin():
        measurement = session.exec(select(Measurement).where(
            Measurement.measured_at == RECHECK.measured_at,
        )).one()
        followup = session.get(Followup, followup_id)
        assert measurement.recorded_at > followup.created_at
        assert measurement.kind == followup.kind
        assert measurement.astronaut_id == followup.astronaut_id
        assert measurement.quality == "ok"
        assert followup.status == "pending"
        followup.measurement_id = measurement.id
        followup.completed_at = measurement.recorded_at
        followup.status = "completed"
    with Session(engine) as session:
        assert session.get(Followup, followup_id).status == "completed"
        assert len(session.exec(select(Measurement)).all()) == 30


def test_seed_stays_separate_from_unavailable_nasa_history(engine, tmp_path, monkeypatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "demo.db"))
    with TestClient(app) as client:
        before_seed = client.get("/api/nasa/references")
        assert before_seed.status_code == 200
        assert seed(engine) == (4, 29)
        response = client.get("/api/nasa/references")
        assert response.status_code == 200
        assert response.json() == before_seed.json()
    body = response.json()
    assert body["historical_data_status"] == "not_imported"
    assert body["historical_series"] == []
    assert len(body["scientific_references"]) == 3
    assert all(reference["source"] == "NASA HRP" for reference in body["scientific_references"])
