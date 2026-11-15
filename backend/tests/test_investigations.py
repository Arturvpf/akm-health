"""AKM-20: real SQLite transactions, immutable results and follow-up completion."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func
from sqlmodel import Session, select

from app import investigations, models
from app.main import app
from app.models import Astronaut, Followup, Investigation, Measurement
from app.seed import seed


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "investigations.db"))
    clock = [datetime(2026, 11, 14, 8, tzinfo=timezone.utc)]
    monkeypatch.setattr(investigations, "utc_now", lambda: clock[0])

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock[0].astimezone(tz) if tz else clock[0].replace(tzinfo=None)

    monkeypatch.setattr(models, "datetime", Clock)
    with TestClient(app) as client:
        client.clock = clock
        yield client


@pytest.fixture
def seeded(client):
    seed(app.state.engine)
    return client


def run(client, subject=None):
    body = {"scope": "individual", "astronaut_id": subject} if subject else {"scope": "crew"}
    response = client.post("/api/investigations/run", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def counts():
    with Session(app.state.engine) as session:
        return tuple(session.exec(select(func.count()).select_from(model)).one()
                     for model in (Investigation, Followup))


def measure(client, *, kind="co2_ppm", subject=None, quality="ok", at=None):
    units = {"co2_ppm": "ppm", "cabin_temp_c": "C", "sleep_hours": "h"}
    response = client.post("/api/measurements", json={
        "kind": kind, "astronaut_id": subject, "value": 6 if kind == "sleep_hours" else 850,
        "unit": units[kind], "measured_at": (at or client.clock[0]).isoformat(),
        "source": "synthetic", "quality": quality,
    })
    assert response.status_code == 201, response.text
    return response.json()


def finish(client, followup, measurement):
    return client.patch(f"/api/followups/{followup}", json={
        "status": "completed", "measurement_id": measurement,
    })


def test_roundtrip_preserves_canonical_result_and_audit(seeded):
    result = run(seeded)
    assert result["status"] == "attention"
    assert result["next_check"]["kind"] == "co2_ppm"
    assert result["followup_id"] is not None
    assert result["guidance"] == [] and result["demo_only"] is True
    assert result["hypotheses"] and all(item["certainty"] == "unconfirmed" for item in result["hypotheses"])
    assert {item["kind"] for item in result["evidence"]} == {"sleep_hours", "co2_ppm", "cabin_temp_c"}
    assert seeded.get(f'/api/investigations/{result["id"]}').json() == result
    with Session(app.state.engine) as session:
        row = session.get(Investigation, result["id"])
        document = json.loads(row.result_json)
        assert document["schema_version"] == 1
        assert document["response"] == result
        audit = document["audit"]
        assert audit["settings"]["rules_version"] == result["rules_version"]
        assert len(audit["snapshot"]["astronauts"]) == 4
        assert audit["selection"]["candidates"]
        assert audit["detection"]["affected_astronaut_ids"] == ["A1", "A2", "A3"]
        assert {sample["quality"] for sample in audit["snapshot"]["measurements"]} == {"ok", "suspect"}
    assert len(result["input_fingerprint"]) == 64
    assert counts() == (1, 1)


def test_identical_inputs_reuse_even_when_clock_advances(seeded):
    original = run(seeded)
    seeded.clock[0] += timedelta(days=3)
    replay = run(seeded)
    assert replay == {**original, "reused": True}
    assert seeded.get(f'/api/investigations/{original["id"]}').json() == original
    assert counts() == (1, 1)


def test_new_input_changes_fingerprint_but_reuses_pending_target(seeded):
    first = run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    measure(seeded)
    second = run(seeded)
    assert second["input_fingerprint"] != first["input_fingerprint"]
    assert second["followup_id"] == first["followup_id"]
    assert second["reused"] is False
    assert counts() == (2, 1)


def test_fingerprint_tracks_baseline_version_settings_and_canonical_catalog_order(seeded):
    first = run(seeded)
    settings = app.state.investigation_settings
    app.state.investigation_settings = settings.model_copy(update={"resources": settings.resources[::-1]})
    assert run(seeded)["id"] == first["id"]
    app.state.investigation_settings = settings.model_copy(update={"rules_version": "demo-v2"})
    versioned = run(seeded)
    assert versioned["input_fingerprint"] != first["input_fingerprint"]
    with Session(app.state.engine) as session:
        astronaut = session.get(Astronaut, "A4")
        astronaut.baseline_sleep_hours = 8.5
        session.add(astronaut)
        session.commit()
    baseline = run(seeded)
    assert baseline["input_fingerprint"] != versioned["input_fingerprint"]
    resources = tuple(resource.model_copy(update={"available": False}) for resource in settings.resources)
    app.state.investigation_settings = settings.model_copy(update={"resources": resources})
    unavailable = run(seeded)
    assert unavailable["next_check"] is None and unavailable["followup_id"] is None
    assert unavailable["status"] == "attention"
    assert any("disponível" in item for item in unavailable["findings"])
    assert unavailable["input_fingerprint"] != first["input_fingerprint"]


def test_individual_scope_does_not_depend_on_other_profiles(seeded):
    original = run(seeded, "A1")
    seeded.clock[0] += timedelta(minutes=1)
    measure(seeded, kind="sleep_hours", subject="A2")
    assert run(seeded, "A1")["id"] == original["id"]
    assert run(seeded, "A4")["status"] == "normal"


@pytest.mark.parametrize("body", [
    {}, {"scope": "other"}, {"scope": "individual"},
    {"scope": "individual", "astronaut_id": " "},
    {"scope": "crew", "astronaut_id": "A1"}, {"scope": "crew", "extra": True},
])
def test_run_request_rejects_invalid_scope(client, body):
    assert client.post("/api/investigations/run", json=body).status_code == 422
    assert counts() == (0, 0)


def test_missing_resources_and_invalid_identifiers(client):
    assert client.post("/api/investigations/run", json={
        "scope": "individual", "astronaut_id": "missing",
    }).status_code == 404
    assert client.get("/api/investigations/123").status_code == 404
    assert finish(client, 123, 1).status_code == 404
    for id in (0, -1, 2**63, "invalid"):
        assert client.get(f"/api/investigations/{id}").status_code == 422
        assert finish(client, id, 1).status_code == 422
    for body in ({"status": "completed"}, {"status": "pending", "measurement_id": 1},
                 {"status": "completed", "measurement_id": True},
                 {"status": "completed", "measurement_id": 2**63}):
        assert client.patch("/api/followups/1", json=body).status_code == 422


def test_empty_crew_has_no_invented_check_and_empty_profile_gets_data_gap(client):
    empty = run(client)
    assert empty["status"] == "insufficient_data"
    assert empty["next_check"] is empty["followup_id"] is None
    assert empty["evidence"] == []
    with Session(app.state.engine) as session:
        session.add(Astronaut(id="A1", name="Demo", baseline_sleep_hours=8))
        session.commit()
    gap = run(client, "A1")
    assert gap["status"] == "insufficient_data"
    assert gap["next_check"]["kind"] == "sleep_hours"


def test_atomic_rollback_does_not_leak_partial_rows_or_input(seeded, monkeypatch, caplog):
    def fail(*args):
        raise RuntimeError("private-synthetic-input-do-not-log")

    monkeypatch.setattr(investigations, "_encode_document", fail)
    response = seeded.post("/api/investigations/run", json={"scope": "crew"})
    assert response.status_code == 500
    assert counts() == (0, 0)
    assert "private-synthetic-input" not in caplog.text + response.text


def test_unique_collision_recovers_existing_result(seeded, monkeypatch):
    original = run(seeded)
    lookup = investigations._find_by_fingerprint
    calls = []

    def race(session, fingerprint):
        calls.append(fingerprint)
        return None if len(calls) == 1 else lookup(session, fingerprint)

    monkeypatch.setattr(investigations, "_find_by_fingerprint", race)
    assert run(seeded) == {**original, "reused": True}
    assert len(calls) == 2 and counts() == (1, 1)


def test_completion_is_persisted_idempotent_and_original_analysis_is_immutable(seeded):
    result = run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    measurement = measure(seeded)
    first = finish(seeded, result["followup_id"], measurement["id"])
    assert first.status_code == 200, first.text
    assert first.json()["completed_at"] is not None
    assert first.json()["status"] == "completed"
    seeded.clock[0] += timedelta(minutes=1)
    assert finish(seeded, result["followup_id"], measurement["id"]).json() == first.json()
    other = measure(seeded)
    assert finish(seeded, result["followup_id"], other["id"]).status_code == 409
    assert seeded.get("/api/followups", params={"status": "pending"}).json() == []
    assert seeded.get(f'/api/investigations/{result["id"]}').json() == result
    updated = run(seeded)
    assert updated["id"] != result["id"]
    assert updated["followup_id"] != result["followup_id"]
    assert counts() == (2, 2)


@pytest.mark.parametrize("case", ["old", "equal", "suspect", "kind", "subject", "future", "missing"])
def test_completion_rejects_unusable_or_incompatible_measurement(seeded, case):
    result = run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    if case == "missing":
        id = 99999
    else:
        measurement = measure(seeded,
            kind="sleep_hours" if case == "subject" else ("cabin_temp_c" if case == "kind" else "co2_ppm"),
            subject="A1" if case == "subject" else None,
            quality="suspect" if case == "suspect" else "ok",
            at=seeded.clock[0] + timedelta(minutes=1) if case == "future" else None,
        )
        id = measurement["id"]
        if case in ("old", "equal"):
            with Session(app.state.engine) as session:
                row = session.get(Measurement, id)
                row.recorded_at = seeded.clock[0] - timedelta(minutes=1, seconds=1 if case == "old" else 0)
                session.add(row)
                session.commit()
    assert finish(seeded, result["followup_id"], id).status_code == (404 if case == "missing" else 422)
    pending = seeded.get("/api/followups", params={"status": "pending"}).json()
    assert len(pending) == 1 and pending[0]["measurement_id"] is pending[0]["completed_at"] is None


def test_individual_completion_requires_same_astronaut(client):
    seed(app.state.engine)
    # One usable sleep period creates an individual data-coverage check.
    with Session(app.state.engine) as session:
        for row in session.exec(select(Measurement).where(
            Measurement.astronaut_id == "A1", Measurement.kind == "sleep_hours",
        )):
            session.delete(row)
        session.commit()
    result = run(client, "A1")
    client.clock[0] += timedelta(minutes=1)
    wrong = measure(client, kind="sleep_hours", subject="A2")
    assert finish(client, result["followup_id"], wrong["id"]).status_code == 422
    right = measure(client, kind="sleep_hours", subject="A1")
    assert finish(client, result["followup_id"], right["id"]).status_code == 200


def test_dashboard_projects_persisted_individual_states_and_never_runs_rules(seeded, monkeypatch):
    result = run(seeded)
    def forbidden(*args):
        raise AssertionError("Dashboard must not execute investigation rules")
    monkeypatch.setattr(investigations, "detect_collective_patterns", forbidden)
    dashboard = seeded.get("/api/dashboard").json()
    assert [row["status"] for row in dashboard["astronauts"]] == ["attention"] * 3 + ["normal"]
    assert dashboard["alerts"][0]["id"] == result["id"]
    assert dashboard["alerts"][0]["level"] == "attention"
    assert dashboard["has_unanalyzed_measurements"] is False
    # Equal timestamp and backdated observation still count: its ID was not in the audit.
    measure(seeded, at=seeded.clock[0] - timedelta(days=1))
    assert seeded.get("/api/dashboard").json()["has_unanalyzed_measurements"] is True
    assert counts() == (1, 1)


def test_latest_individual_analysis_overrides_only_its_profile(seeded):
    run(seeded)
    seeded.clock[0] += timedelta(days=3)
    run(seeded, "A1")
    dashboard = seeded.get("/api/dashboard").json()
    assert [row["status"] for row in dashboard["astronauts"]] == ["insufficient_data", "attention", "attention", "normal"]


@pytest.mark.parametrize("days_later", [0, 1])
def test_new_crew_assessment_removes_superseded_individual_alert(seeded, days_later):
    individual = run(seeded, "A1")
    assert individual["status"] == "attention"
    seeded.clock[0] += timedelta(days=days_later)
    for subject in ("A1", "A2", "A3", "A4"):
        response = seeded.post("/api/measurements", json={
            "astronaut_id": subject, "kind": "sleep_hours", "value": 8, "unit": "h",
            "measured_at": (seeded.clock[0] - timedelta(hours=1)).isoformat(), "source": "synthetic",
        })
        assert response.status_code == 201
    crew = run(seeded)
    assert crew["status"] == "normal"
    dashboard = seeded.get("/api/dashboard").json()
    assert all(row["status"] == "normal" for row in dashboard["astronauts"])
    assert dashboard["alerts"] == []
    assert seeded.get(f'/api/investigations/{individual["id"]}').json() == individual


def test_newer_individual_alert_is_preserved_when_crew_assessment_is_older(seeded):
    run(seeded)
    # Timestamps tie: the higher investigation ID still wins for the subject.
    individual = run(seeded, "A1")
    dashboard = seeded.get("/api/dashboard").json()
    assert individual["id"] in {alert["id"] for alert in dashboard["alerts"]}
    assert dashboard["astronauts"][0]["status"] == individual["status"]


def test_individual_assessment_clears_only_measurements_in_its_scope(client):
    with Session(app.state.engine) as session:
        session.add_all([
            Astronaut(id="A1", name="One", baseline_sleep_hours=8),
            Astronaut(id="A2", name="Two", baseline_sleep_hours=8),
        ])
        session.commit()
    measure(client, kind="sleep_hours", subject="A1")
    measure(client)
    first = run(client, "A1")
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["last_investigation_at"] == first["created_at"]
    assert dashboard["has_unanalyzed_measurements"] is False
    client.clock[0] += timedelta(minutes=1)
    measure(client, kind="sleep_hours", subject="A2")
    run(client, "A1")  # Replaying A1 cannot consume an unassessed A2 sample.
    assert client.get("/api/dashboard").json()["has_unanalyzed_measurements"] is True
    second = run(client, "A2")
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["has_unanalyzed_measurements"] is False
    assert dashboard["last_investigation_at"] == second["created_at"]
    client.clock[0] += timedelta(minutes=1)
    measure(client, kind="sleep_hours", subject="A1")
    assert client.get("/api/dashboard").json()["has_unanalyzed_measurements"] is True
    run(client, "A1")
    assert client.get("/api/dashboard").json()["has_unanalyzed_measurements"] is False


def test_newer_individual_audit_covers_new_data_after_crew_assessment(seeded):
    run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    measure(seeded, kind="sleep_hours", subject="A1")
    measure(seeded)
    individual = run(seeded, "A1")
    dashboard = seeded.get("/api/dashboard").json()
    assert dashboard["has_unanalyzed_measurements"] is False
    assert dashboard["last_investigation_at"] == individual["created_at"]
    # Equal registration time must not hide an ID absent from the newest scope snapshot.
    measure(seeded, kind="sleep_hours", subject="A2")
    assert seeded.get("/api/dashboard").json()["has_unanalyzed_measurements"] is True


def test_concurrent_identical_runs_create_exactly_one_analysis_and_followup(seeded):
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(lambda _: run(seeded), range(4)))
    assert len({result["id"] for result in results}) == 1
    assert sum(not result["reused"] for result in results) == 1
    assert counts() == (1, 1)


def test_concurrent_completion_with_different_measurements_has_one_conflict(seeded):
    result = run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    ids = [measure(seeded)["id"], measure(seeded)["id"]]
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda id: finish(seeded, result["followup_id"], id), ids))
    assert sorted(response.status_code for response in responses) == [200, 409]


def test_concurrent_same_measurement_completion_is_idempotent(seeded):
    result = run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    id = measure(seeded)["id"]
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: finish(seeded, result["followup_id"], id), range(2)))
    assert all(response.status_code == 200 for response in responses)
    assert responses[0].json() == responses[1].json()


def test_different_fingerprints_share_one_pending_target(seeded):
    original = app.state.investigation_settings
    alternate = original.model_copy(update={"rules_version": "demo-v2"})
    request = investigations.InvestigationRunRequest(scope="crew")

    def execute(settings):
        with Session(app.state.engine) as session:
            return investigations.run_investigation(session, request, settings)

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(execute, (original, alternate)))
    assert results[0].id != results[1].id
    assert results[0].followup_id == results[1].followup_id
    assert counts() == (2, 1)


def test_registered_later_observation_can_complete_followup(seeded):
    result = run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    # The canonical v2.0 rule uses recorded_at, not an invented measured_at cutoff.
    id = measure(seeded, at=seeded.clock[0] - timedelta(hours=2))["id"]
    assert finish(seeded, result["followup_id"], id).status_code == 200


def test_future_registration_does_not_complete_followup(seeded):
    result = run(seeded)
    seeded.clock[0] += timedelta(minutes=1)
    id = measure(seeded)["id"]
    with Session(app.state.engine) as session:
        row = session.get(Measurement, id)
        row.recorded_at += timedelta(hours=1)
        session.add(row)
        session.commit()
    assert finish(seeded, result["followup_id"], id).status_code == 422


def test_persisted_response_survives_application_restart(seeded):
    original = run(seeded)
    with TestClient(app) as restarted:
        assert restarted.get(f'/api/investigations/{original["id"]}').json() == original
        assert run(restarted) == {**original, "reused": True}


def test_configuration_threshold_changes_fingerprint(seeded):
    original = run(seeded)
    settings = app.state.investigation_settings
    individual = settings.config.individual.model_copy(update={"sleep_ratio": 0.7})
    app.state.investigation_settings = settings.model_copy(update={
        "config": settings.config.model_copy(update={"individual": individual}),
    })
    assert run(seeded)["input_fingerprint"] != original["input_fingerprint"]


@pytest.mark.parametrize("raw", ["[]", "{", '{"schema_version":1,"response":{},"audit":[]}'])
def test_corrupt_stored_result_returns_controlled_error(seeded, raw):
    result = run(seeded)
    with Session(app.state.engine) as session:
        row = session.get(Investigation, result["id"])
        row.result_json = raw
        session.add(row)
        session.commit()
    response = seeded.get(f'/api/investigations/{result["id"]}')
    assert response.status_code == 500
    assert response.json() == {"detail": "Stored investigation is invalid"}


def test_configuration_is_validated_and_missing_catalog_does_not_assume_availability(tmp_path, monkeypatch):
    config = tmp_path / "config.json"
    monkeypatch.setenv("AKM_INVESTIGATION_CONFIG", str(config))
    config.write_text(json.dumps({"rules_version": "demo-v1", "resources": []}))
    assert investigations.load_settings().resources == ()
    config.write_text(json.dumps({"rules_version": "demo-v1"}))
    with pytest.raises(ValueError):
        investigations.load_settings()
