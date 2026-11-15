from contextlib import closing
from datetime import datetime, timedelta, timezone
import sqlite3

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.db import make_engine, migrate
from app.main import app
from app.models import Astronaut, Followup, Investigation, Measurement
from app.schemas import MeasurementCreate


NOW = datetime(2026, 11, 14, 14, tzinfo=timezone.utc)


@pytest.fixture
def engine(tmp_path):
    engine = make_engine(tmp_path / "mission.db")
    migrate(engine)
    yield engine
    engine.dispose()


def investigation():
    return Investigation(
        scope="crew",
        status="attention",
        created_at=NOW,
        rules_version="demo-v1",
        input_fingerprint="a" * 64,
        result_json='{"findings":[]}',
    )


def habitat_measurement():
    payload = MeasurementCreate(
        kind="co2_ppm", value=950, unit="ppm",
        measured_at="2026-11-14T11:00:00-03:00", source="synthetic",
    )
    return Measurement.from_payload(payload, recorded_at=NOW + timedelta(minutes=5))


def test_startup_migrates_empty_database(tmp_path, monkeypatch):
    path = tmp_path / "nested" / "mission.db"
    monkeypatch.setenv("AKM_DB_PATH", str(path))
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok", "storage": "sqlite_reachable"}
        with app.state.engine.connect() as connection:
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
            assert connection.exec_driver_sql("PRAGMA user_version").scalar_one() == 1
        schema = inspect(app.state.engine)
        assert set(schema.get_table_names()) == {"astronauts", "measurements", "investigations", "followups"}
        assert schema.get_indexes("measurements")[0]["column_names"] == ["astronaut_id", "kind", "measured_at"]
        with Session(app.state.engine) as session:
            assert session.exec(select(Astronaut)).all() == []


def test_migration_preserves_existing_smoke_database(tmp_path):
    path = tmp_path / "foundation.db"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE smoke (value TEXT)")
        connection.execute("INSERT INTO smoke VALUES ('preserve')")
    engine = make_engine(path)
    migrate(engine)
    migrate(engine)
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT value FROM smoke").scalar_one() == "preserve"
        assert connection.exec_driver_sql("PRAGMA user_version").scalar_one() == 1


def test_migration_rejects_unknown_schema_without_writes(tmp_path):
    path = tmp_path / "unknown.db"
    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA user_version = 99")
    engine = make_engine(path)
    with pytest.raises(RuntimeError, match="schema version: 99"):
        migrate(engine)
    assert inspect(engine).get_table_names() == []


def test_startup_rejects_unrelated_database_with_matching_version(tmp_path, monkeypatch):
    path = tmp_path / "another_app.db"
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("CREATE TABLE other_app (id INTEGER PRIMARY KEY)")
        connection.execute("PRAGMA user_version = 1")
    before = path.read_bytes()
    monkeypatch.setenv("AKM_DB_PATH", str(path))

    with pytest.raises(RuntimeError, match=r"schema v1.*astronauts.*AKM_DB_PATH"):
        with TestClient(app):
            pytest.fail("The API accepted an incompatible database")

    assert path.read_bytes() == before


def test_migration_rejects_versioned_database_with_missing_column(engine):
    with engine.begin() as connection:
        connection.exec_driver_sql("ALTER TABLE astronauts DROP COLUMN role")

    with pytest.raises(RuntimeError, match=r"schema v1.*astronauts\.role.*AKM_DB_PATH"):
        migrate(engine)


def test_later_migration_preserves_mission_rows(engine):
    with Session(engine) as session:
        session.add(Astronaut(id="A1", name="Aurora", baseline_sleep_hours=8))
        session.commit()
    migrate(engine)
    with Session(engine) as session:
        assert session.get(Astronaut, "A1").name == "Aurora"


def test_persist_all_entities_and_round_trip_utc(engine):
    with Session(engine) as session, session.begin():
        astronaut = Astronaut(id="A1", name="Aurora", baseline_sleep_hours=8)
        session.add(astronaut)
        session.flush()
        sleep = Measurement.from_payload(MeasurementCreate(
            astronaut_id="A1", kind="sleep_hours", value=5.2, unit="h",
            measured_at=NOW, source="manual",
        ), recorded_at=NOW)
        measure = habitat_measurement()
        analysis = investigation()
        session.add_all([sleep, measure, analysis])
        session.flush()
        check = Followup(
            investigation_id=analysis.id, kind="co2_ppm", reason="Repeat the cabin reading",
            created_at=NOW, status="completed", completed_at=NOW + timedelta(minutes=6),
            measurement_id=measure.id,
        )
        session.add(check)
        session.flush()
        investigation_id, measurement_id, followup_id = analysis.id, measure.id, check.id
    with Session(engine) as session:
        assert session.get(Astronaut, "A1").baseline_sleep_hours == 8
        stored = session.get(Measurement, measurement_id)
        assert stored.astronaut_id is None
        assert stored.measurement_zone == "habitat"
        assert stored.measured_at == NOW and stored.measured_at.utcoffset() == timedelta(0)
        assert stored.recorded_at > NOW
        assert session.get(Investigation, investigation_id).result_json == '{"findings":[]}'
        assert session.get(Followup, followup_id).measurement_id == measurement_id
        linked = session.exec(select(Measurement).where(Measurement.astronaut_id == "A1")).one()
        assert linked.measurement_zone == "astronaut"
    with engine.connect() as connection:
        timestamp = connection.exec_driver_sql(
            "SELECT measured_at FROM measurements WHERE id = ?", (measurement_id,),
        ).scalar_one()
        assert timestamp == "2026-11-14T14:00:00.000000Z"


def test_duplicate_fingerprint_rolls_back_transaction(engine):
    with Session(engine) as session, session.begin():
        session.add(investigation())

    with pytest.raises(IntegrityError, match="UNIQUE constraint failed"):
        with Session(engine) as session, session.begin():
            session.add(habitat_measurement())
            session.flush()
            session.add(investigation())

    with Session(engine) as session:
        assert session.exec(select(Measurement)).all() == []
        assert len(session.exec(select(Investigation)).all()) == 1


def test_missing_astronaut_is_rejected_by_foreign_key(engine):
    payload = MeasurementCreate(
        astronaut_id="A99", kind="sleep_hours", value=5.2, unit="h", measured_at=NOW, source="manual",
    )
    with pytest.raises(IntegrityError, match="FOREIGN KEY constraint failed"):
        with Session(engine) as session, session.begin():
            session.add(Measurement.from_payload(payload, recorded_at=NOW))
