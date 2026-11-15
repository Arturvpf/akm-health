"""Run the ODYSSEY-26 fixture variants through the real investigation API."""

from datetime import datetime, timedelta
import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session

from app.main import app
from app.models import Astronaut, Investigation
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
def client(tmp_path, monkeypatch, investigation_clock):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "scenario.db"))
    monkeypatch.delenv("AKM_INVESTIGATION_CONFIG", raising=False)
    with TestClient(app) as client:
        with Session(app.state.engine) as session, session.begin():
            session.add_all(Astronaut.model_validate(profile.model_dump()) for profile in PROFILES)
        yield client


def run_scenario(client, case):
    for payload in scenario_observations(case):
        response = client.post("/api/measurements", json=payload)
        assert response.status_code == 201, response.text
        assert response.json()["source"] == "synthetic"

    response = client.post("/api/investigations/run", json={
        "scope": case["scope"], "astronaut_id": case["astronaut_id"],
    })
    assert response.status_code == 200, response.text
    result = response.json()
    with Session(app.state.engine) as session:
        row = session.get(Investigation, result["id"])
        audit = json.loads(row.result_json)["audit"]
    return result, audit


@pytest.mark.parametrize("scenario", list(SCENARIOS))
def test_scenario_investigation_and_dashboard(client, scenario):
    case = SCENARIOS[scenario]
    expected = case["expected"]
    result, audit = run_scenario(client, case)
    detection = audit["detection"]

    assert (result["scope"], result["astronaut_id"]) == (case["scope"], case["astronaut_id"])
    assert result["status"] == expected["status"]
    assert result["demo_only"] is True
    assert result["reused"] is False
    assert result["findings"]
    assert any("Limitação:" in finding for finding in result["findings"])
    assert set(item["quality"] for item in result["evidence"]) == {"ok"}
    check = result["next_check"]
    assert {key: check[key] for key in expected["next_check"]} == expected["next_check"]
    assert check["reason"] and check["effort"] == "low"

    individual_results = detection["individual_results"] if case["scope"] == "crew" else [detection]
    statuses = {item["astronaut_id"]: item["status"] for item in individual_results}
    assert [subject for subject, status in statuses.items() if status == "attention"] == expected["affected_astronauts"]
    assert (result["scope"] == "crew" and result["status"] == "attention") == expected["collective_pattern"]

    if expected["environmental_hypothesis"]:
        coincident, alternative = result["hypotheses"]
        assert "CO₂ interno" in coincident["label"]
        assert coincident["certainty"] == alternative["certainty"] == expected["environmental_hypothesis"]
        assert "não demonstram causalidade" in coincident["explanation"]
        assert "alternativas" in alternative["label"]
        assert "não distinguem" in alternative["explanation"]
        comparison = next(item for item in detection["environment"] if item["kind"] == "co2_ppm")
        assert comparison["baseline"]["value"] == 680
        assert [item["value"] for item in comparison["aligned_readings"]] == [950, 980]
    else:
        assert result["hypotheses"] == []

    response = client.get("/api/dashboard")
    assert response.status_code == 200, response.text
    dashboard = response.json()
    assert dashboard["has_unanalyzed_measurements"] is (case["scope"] == "individual")
    levels = {item["id"]: item["status"] for item in dashboard["astronauts"]}
    assert {subject: levels[subject] for subject in statuses} == statuses
    if scenario == "collective":
        assert levels["A4"] == "normal"
    if scenario == "insufficient":
        assert [levels[subject] for subject in ("A2", "A3", "A4")] == ["insufficient_data"] * 3
    alert, = dashboard["alerts"]
    assert (alert["id"], alert["level"]) == (result["id"], result["status"])
    followup, = dashboard["pending_followups"]
    assert (followup["id"], followup["investigation_id"], followup["status"]) == (
        result["followup_id"], result["id"], "pending",
    )
    assert (followup["kind"], followup["astronaut_id"]) == (check["kind"], check["astronaut_id"])


@pytest.mark.parametrize("environment", ["suspect", "outside", "missing"])
def test_uncertain_environment_preserves_collective_sleep_and_limits_hypotheses(client, environment):
    case = SCENARIOS["collective"] | {"environment": environment}
    result, audit = run_scenario(client, case)
    detection = audit["detection"]

    raw_co2 = [row for row in audit["snapshot"]["measurements"] if row["kind"] == "co2_ppm"]
    if environment == "missing":
        assert raw_co2 == []
    elif environment == "suspect":
        assert len(raw_co2) == 4
        assert {row["quality"] for row in raw_co2} == {"suspect"}
    else:
        assert len(raw_co2) == 4
        assert any(row["quality"] == "ok" for row in raw_co2)
        assert all(datetime.fromisoformat(row["measured_at"]) < NIGHT_1 - timedelta(days=1) for row in raw_co2)

    assert result["status"] == "attention"
    assert detection["affected_astronaut_ids"] == case["expected"]["affected_astronauts"]
    assert "sleep_hours" in {item["kind"] for item in result["evidence"]}
    assert "co2_ppm" not in {item["kind"] for item in result["evidence"]}
    comparison = next(item for item in detection["environment"] if item["kind"] == "co2_ppm")
    assert comparison["baseline"] is None
    assert comparison["aligned_readings"] == []
    alternative, = result["hypotheses"]
    assert alternative["certainty"] == "unconfirmed" and "alternativas" in alternative["label"]
    assert any("Qualidade suspeita" in finding for finding in result["findings"])
    assert result["next_check"]["kind"] == "co2_ppm"
    assert result["next_check"]["astronaut_id"] is None
    assert "qualidade" in result["next_check"]["reason"]