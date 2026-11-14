from datetime import timedelta
import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session, select

from app.main import app
from app.models import Astronaut, Investigation, Measurement
from app.schemas import InvestigationRunRequest
from app.seed import NIGHT_1, NIGHT_2, PROFILES, observations


SCENARIOS = json.loads(
    Path(__file__).with_name("fixtures").joinpath("odyssey-26-scenarios.json").read_text(encoding="utf-8")
)
NIGHT_INDEX = {NIGHT_1: 0, NIGHT_2: 1}


def scenario_observations(case):
    for observation in observations():
        payload = observation.model_dump(mode="json")
        if observation.kind == "sleep_hours" and observation.astronaut_id in case["sleep_overrides"]:
            value = case["sleep_overrides"][observation.astronaut_id][NIGHT_INDEX[observation.measured_at]]
            if value is None:
                continue
            payload["value"] = value
        if observation.kind == "co2_ppm":
            environment = case["environment"]
            if environment == "missing":
                continue
            if environment == "unchanged":
                if observation.quality == "suspect":
                    continue
                payload["value"] = 680
            elif environment == "suspect":
                payload["quality"] = "suspect"
            elif environment == "outside":
                payload["measured_at"] = (observation.measured_at - timedelta(days=30)).isoformat()
        yield payload


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "scenario.db"))
    with TestClient(app) as client:
        with Session(app.state.engine) as session, session.begin():
            session.add_all(Astronaut.model_validate(profile.model_dump()) for profile in PROFILES)
        yield client


def register(client, case):
    for payload in scenario_observations(case):
        response = client.post("/api/measurements", json=payload)
        assert response.status_code == 201, response.text
        assert response.json()["source"] == "synthetic"


@pytest.mark.parametrize("scenario", list(SCENARIOS))
def test_scenario_inputs_support_expected_result(client, scenario):
    # Verify the premises of each fixture while the investigation motor is pending.
    case = SCENARIOS[scenario]
    expected = case["expected"]
    request = InvestigationRunRequest(scope=case["scope"], astronaut_id=case["astronaut_id"])
    register(client, case)
    with Session(app.state.engine) as session:
        crew = session.exec(select(Astronaut).order_by(Astronaut.id)).all()
        sleep = session.exec(
            select(Measurement).where(Measurement.kind == "sleep_hours", Measurement.quality == "ok")
            .order_by(Measurement.measured_at)
        ).all()
        co2 = session.exec(
            select(Measurement).where(Measurement.kind == "co2_ppm", Measurement.quality == "ok")
            .order_by(Measurement.measured_at)
        ).all()
        assert session.exec(select(Investigation.id)).all() == []

    comparable = {}
    for astronaut in crew:
        nights = {entry.measured_at: entry.value for entry in sleep if entry.astronaut_id == astronaut.id}
        if nights.keys() == NIGHT_INDEX.keys():
            comparable[astronaut.id] = (astronaut.baseline_sleep_hours, list(nights.values()))
    affected = [
        astronaut_id for astronaut_id, (baseline, nights) in comparable.items()
        if all(value <= 0.8 * baseline for value in nights)
    ]
    assert affected == expected["affected_astronauts"]
    if scenario == "collective":
        assert request.scope == "crew" and len(affected) >= 2
        assert expected["collective_pattern"] is True
        assert [entry.value for entry in co2] == [680, 950, 980]
        assert [entry.measured_at for entry in co2[1:]] == [
            NIGHT_1 - timedelta(hours=2), NIGHT_2 - timedelta(hours=2),
        ]
        assert expected["environmental_hypothesis"] == "unconfirmed"
        assert expected["next_check"] == {"kind": "co2_ppm", "astronaut_id": None}
    elif scenario == "individual":
        assert request.astronaut_id == "A1" and len(comparable) == 4
        assert expected["collective_pattern"] is False
        assert len(co2) == 3 and {entry.value for entry in co2} == {680}
        assert expected["environmental_hypothesis"] is None
        assert expected["next_check"] == {"kind": "sleep_hours", "astronaut_id": "A1"}
    else:
        assert request.scope == "crew" and len(comparable) < 2
        assert expected["status"] == "insufficient_data"
        assert co2 == []
        assert expected["next_check"]["astronaut_id"] not in comparable


@pytest.mark.parametrize("environment", ["suspect", "outside", "missing"])
def test_environment_variants_have_no_usable_co2_in_demo_window(client, environment):
    case = SCENARIOS["collective"] | {"environment": environment}
    register(client, case)
    with Session(app.state.engine) as session:
        sleep = session.exec(select(Measurement.id).where(Measurement.kind == "sleep_hours")).all()
        usable_co2 = session.exec(select(Measurement.id).where(
            Measurement.kind == "co2_ppm",
            Measurement.quality == "ok",
            Measurement.measured_at >= NIGHT_1 - timedelta(hours=12),
            Measurement.measured_at <= NIGHT_2,
        )).all()
    assert len(sleep) == 8
    assert usable_co2 == []
