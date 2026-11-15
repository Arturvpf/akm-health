"""'Why this finding': the basis is read from the stored audit, never recomputed."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.main import app
from app.models import Investigation
from app.seed import seed


@pytest.fixture
def seeded(tmp_path, monkeypatch, investigation_clock):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "basis.db"))
    monkeypatch.delenv("AKM_INVESTIGATION_CONFIG", raising=False)
    with TestClient(app) as client:
        seed(app.state.engine)
        yield client


def run(client, **body):
    response = client.post("/api/investigations/run", json=body or {"scope": "crew"})
    assert response.status_code == 200, response.text
    return response.json()


def test_crew_basis_lists_rules_thresholds_and_readings(seeded):
    result = run(seeded)
    response = seeded.get(f"/api/investigations/{result['id']}/basis")
    assert response.status_code == 200
    basis = response.json()
    assert basis["investigation_id"] == result["id"] and basis["scope"] == "crew"
    assert [rule["rule_id"] for rule in basis["rules"]] == ["DR-01", "DR-02", "DR-03", "DR-04"]
    parameters = {item["label"]: item["value"] for item in basis["parameters"]}
    assert parameters["Sleep threshold"] == "80% of the simulated baseline"
    assert parameters["Observation window"] == "48 h before the run"
    assert parameters["Cabin reading tolerance"] == "12 h around each sleep reading"
    assert [member["astronaut_id"] for member in basis["members"]] == ["A1", "A2", "A3", "A4"]
    flagged = [m for m in basis["members"] if m["status"] == "attention"]
    assert len(flagged) == 3
    for member in flagged:
        assert member["threshold_sleep_hours"] == pytest.approx(member["baseline_sleep_hours"] * 0.8)
        assert len(member["readings"]) == 2
        assert all(item["role"] == "at or below threshold" for item in member["readings"])
    assert {item["kind"] for item in basis["environment"]} == {"co2_ppm", "cabin_temp_c"}
    assert basis["limitations"] and basis["data_sources"] and basis["demo_only"] is True


def test_individual_basis_covers_one_member_without_crew_rules(seeded):
    result = run(seeded, scope="individual", astronaut_id="A1")
    basis = seeded.get(f"/api/investigations/{result['id']}/basis").json()
    assert [rule["rule_id"] for rule in basis["rules"]] == ["DR-01", "DR-04"]
    assert [member["astronaut_id"] for member in basis["members"]] == ["A1"]
    assert basis["environment"] == []


def test_basis_is_unavailable_for_unknown_or_unauditable_investigations(seeded):
    assert seeded.get("/api/investigations/9999/basis").status_code == 404
    result = run(seeded)
    with Session(app.state.engine) as session:
        row = session.get(Investigation, result["id"])
        import json
        document = json.loads(row.result_json)
        document["audit"].pop("detection")
        row.result_json = json.dumps(document, sort_keys=True)
        session.add(row)
        session.commit()
    assert seeded.get(f"/api/investigations/{result['id']}/basis").status_code == 404
