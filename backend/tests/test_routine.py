"""AKM-25: cadence, priority and persistence through the canonical HTTP workflow."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import investigations, models
from app.main import app
from app.models import Followup, Investigation, Measurement
from app.next_check import CheckResource, ValidatedProtocol
from app.routine import RoutinePolicy, plan_routine
from app.schemas import METRICS
from app.seed import seed
from test_investigations import counts, finish, run


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "routine.db"))
    monkeypatch.delenv("AKM_INVESTIGATION_CONFIG", raising=False)
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


def configure(*targets, anchor="2026-11-14T00:00:00Z"):
    settings = app.state.investigation_settings
    policy = RoutinePolicy.model_validate({"checks": [
        {"kind": kind, "astronaut_id": subject, "anchor_at": anchor, "every": "P1D",
         "reason": f"Demo collection: {kind}.", "reference": "AKM-06 · demo daily window"}
        for kind, subject in targets
    ]})
    catalog = {(item.kind, item.astronaut_id): item for item in settings.resources}
    for check in policy.checks:
        catalog.setdefault((check.kind, check.astronaut_id), CheckResource(
            kind=check.kind, astronaut_id=check.astronaut_id, available=True, effort="low",
        ))
    app.state.investigation_settings = settings.model_copy(update={
        "routine": policy, "resources": tuple(catalog.values()),
    })


def record(client, kind, subject=None, *, at=None, quality="ok"):
    values = {"mood_score": 3, "heart_rate_bpm": 70, "sleep_hours": 6,
              "co2_ppm": 850, "cabin_temp_c": 22}
    response = client.post("/api/measurements", json={
        "kind": kind, "astronaut_id": subject, "unit": METRICS[kind][0], "value": values[kind],
        "measured_at": (at or client.clock[0]).isoformat(), "source": "synthetic", "quality": quality,
    })
    assert response.status_code == 201, response.text
    return response.json()


def agenda(client):
    response = client.get("/api/followups", params={"status": "pending"})
    assert response.status_code == 200, response.text
    assert client.get("/api/dashboard").json()["pending_followups"] == response.json()
    return response.json()


def audit(id):
    with Session(app.state.engine) as session:
        return json.loads(session.get(Investigation, id).result_json)["audit"]["routine"]


def test_seed_creates_only_missing_routine_items_and_keeps_adaptive_check_first(seeded):
    configure(("sleep_hours", "A1"), ("mood_score", "A3"),
              ("heart_rate_bpm", "A4"), ("cabin_temp_c", None))
    result = run(seeded)
    assert result["explanation"] is not None
    assert seeded.get(f'/api/investigations/{result["id"]}').json() == result
    rows = agenda(seeded)
    assert [(row["kind"], row["astronaut_id"]) for row in rows] == [
        ("co2_ppm", None), ("heart_rate_bpm", "A4"), ("mood_score", "A3"),
    ]
    assert rows[0]["id"] == result["followup_id"] and rows[0]["due_at"] is None
    assert all(row["due_at"] == "2026-11-15T00:00:00Z" for row in rows[1:])
    assert all("AKM-06" in row["reason"] for row in rows[1:])
    plan = audit(result["id"])["plan"]["items"]
    assert {item["status"] for item in plan} == {"satisfied", "needed"}
    assert counts() == (1, 3)
    assert run(seeded) == {**result, "reused": True}
    assert counts() == (1, 3)


def test_routine_and_adaptive_check_share_one_pending_target(seeded):
    configure(("co2_ppm", None), anchor="2026-11-14T08:00:00Z")
    result = run(seeded)
    entries = audit(result["id"])["followups"]
    assert entries[0]["followup_id"] == result["followup_id"]
    assert entries[0]["reused"] is True
    assert counts() == (1, 1)


def test_period_boundary_changes_fingerprint_without_backfilling_or_duplicate_pending(seeded):
    configure(("mood_score", "A3"))
    first = run(seeded)
    original = next(row for row in agenda(seeded) if row["kind"] == "mood_score")
    seeded.clock[0] += timedelta(hours=1)
    assert run(seeded)["id"] == first["id"]
    seeded.clock[0] += timedelta(days=5)
    later = run(seeded)
    assert later["input_fingerprint"] != first["input_fingerprint"]
    carried = next(row for row in agenda(seeded) if row["kind"] == "mood_score")
    assert carried == original  # Preserve original deadline, creator and reason.
    assert len(audit(later["id"])["followups"]) == 1
    assert audit(later["id"])["followups"][0]["window_start"] == "2026-11-19T00:00:00Z"


def test_check_order_is_not_part_of_routine_fingerprint(seeded):
    configure(("mood_score", "A3"), ("heart_rate_bpm", "A4"))
    first = run(seeded)
    settings = app.state.investigation_settings
    app.state.investigation_settings = settings.model_copy(update={
        "routine": settings.routine.model_copy(update={"checks": settings.routine.checks[::-1]}),
    })
    assert run(seeded)["id"] == first["id"]


def test_individual_scope_never_creates_other_astronauts_routines(seeded):
    configure(("mood_score", "A3"), ("heart_rate_bpm", "A4"), ("co2_ppm", None),
              anchor="2026-11-14T08:00:00Z")
    result = run(seeded, "A3")
    assert {(row["kind"], row["astronaut_id"]) for row in agenda(seeded)} == {
        ("sleep_hours", "A3"), ("mood_score", "A3"), ("co2_ppm", None),
    }
    assert "outside_scope" in {item["status"] for item in audit(result["id"])["plan"]["items"]}


def test_empty_crew_has_no_invented_astronaut_but_can_schedule_habitat(client):
    configure(("sleep_hours", "A1"), ("co2_ppm", None))
    result = run(client)
    assert result["status"] == "insufficient_data"
    assert [(row["kind"], row["astronaut_id"]) for row in agenda(client)] == [("co2_ppm", None)]
    assert result["followup_id"] is None  # Canonical pointer remains the selected adaptive check.


@pytest.mark.parametrize("case", ["suspect", "future_observation", "old_observation", "usable"])
def test_only_usable_observation_inside_current_window_satisfies_routine(seeded, case):
    configure(("mood_score", "A3"), anchor="2026-11-14T08:00:00Z")
    offsets = {"future_observation": timedelta(minutes=1), "old_observation": -timedelta(minutes=1)}
    record(seeded, "mood_score", "A3", at=seeded.clock[0] + offsets.get(case, timedelta(0)),
           quality="suspect" if case == "suspect" else "ok")
    result = run(seeded)
    status = audit(result["id"])["plan"]["items"][0]["status"]
    assert status == ("satisfied" if case == "usable" else "needed")


def test_future_window_and_unavailable_resource_are_explained_without_phantom_tasks(seeded):
    configure(("mood_score", "A3"), anchor="2026-11-15T00:00:00Z")
    result = run(seeded)
    assert audit(result["id"])["plan"]["items"][0]["status"] == "not_started"
    configure(("mood_score", "A3"))
    settings = app.state.investigation_settings
    app.state.investigation_settings = settings.model_copy(update={"resources": tuple(
        item.model_copy(update={"available": False}) if item.kind == "mood_score" else item
        for item in settings.resources
    )})
    result = run(seeded)
    assert audit(result["id"])["plan"]["items"][0]["status"] == "unavailable"
    assert all(row["kind"] != "mood_score" for row in agenda(seeded))


def test_human_protocol_defers_routine_without_new_measurement_requirement(seeded):
    configure(("mood_score", "A3"))
    settings = app.state.investigation_settings
    protocol = ValidatedProtocol(reference="Protocolo externo de teste", validated=True, action="human_review")
    app.state.investigation_settings = settings.model_copy(update={"protocol": protocol})
    result = run(seeded)
    assert result["next_check"] is None and result["status"] != "critical"
    assert agenda(seeded) == []
    assert audit(result["id"])["plan"]["items"][0]["status"] == "protocol_deferred"
    assert any("human referral" in finding for finding in result["findings"])


def test_protocol_can_promote_existing_dated_routine_and_precedes_adaptive_check(seeded):
    configure(("mood_score", "A1"), anchor="2026-11-14T08:00:00Z")
    run(seeded)
    routine = next(row for row in agenda(seeded) if row["kind"] == "mood_score")
    settings = app.state.investigation_settings
    protocol = ValidatedProtocol(reference="Protocolo externo de teste", validated=True, action="measurement",
                                 permitted_checks=({"kind": "mood_score", "astronaut_id": "A1"},))
    app.state.investigation_settings = settings.model_copy(update={"protocol": protocol})
    result = run(seeded)
    assert result["followup_id"] == routine["id"]
    assert agenda(seeded)[0] == routine
    assert len(agenda(seeded)) == 2
    assert audit(result["id"])["plan"]["items"][0]["status"] == "protocol_deferred"


def test_completion_is_explicit_and_a_completed_window_is_not_duplicated(seeded):
    configure(("mood_score", "A1"), anchor="2026-11-14T08:00:00Z")
    run(seeded)
    routine = next(row for row in agenda(seeded) if row["kind"] == "mood_score")
    seeded.clock[0] += timedelta(minutes=1)
    # v2.0 uses registration time for completion, even for an older observation.
    sample = record(seeded, "mood_score", "A1", at=seeded.clock[0] - timedelta(days=1))
    assert next(row for row in agenda(seeded) if row["id"] == routine["id"])["status"] == "pending"
    completed = finish(seeded, routine["id"], sample["id"])
    assert completed.status_code == 200
    assert finish(seeded, routine["id"], sample["id"]).json() == completed.json()
    result = run(seeded)
    assert audit(result["id"])["followups"][0]["followup_id"] == routine["id"]
    assert audit(result["id"])["followups"][0]["resolution"] == "already_completed"
    assert all(row["kind"] != "mood_score" for row in agenda(seeded))
    seeded.clock[0] += timedelta(days=1)
    run(seeded)
    next_period = next(row for row in agenda(seeded) if row["kind"] == "mood_score")
    assert next_period["id"] != routine["id"]
    assert next_period["due_at"] == "2026-11-16T08:00:00Z"


def test_reading_agenda_or_saving_a_sample_does_not_schedule_or_complete(seeded):
    configure(("mood_score", "A3"))
    assert agenda(seeded) == [] and counts() == (0, 0)
    record(seeded, "mood_score", "A3")
    assert agenda(seeded) == [] and counts() == (0, 0)
    result = run(seeded)
    assert audit(result["id"])["plan"]["items"][0]["status"] == "satisfied"


def test_routine_transaction_rolls_back_all_rows_on_failure(seeded, monkeypatch):
    configure(("mood_score", "A3"), ("heart_rate_bpm", "A4"))
    def fail(*args):
        raise RuntimeError("audit storage failure")
    monkeypatch.setattr(investigations, "_encode_document", fail)
    assert seeded.post("/api/investigations/run", json={"scope": "crew"}).status_code == 500
    assert counts() == (0, 0)


def test_concurrent_same_window_creates_one_routine_agenda(seeded):
    configure(("mood_score", "A3"), ("heart_rate_bpm", "A4"))
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(lambda _: run(seeded), range(4)))
    assert len({item["id"] for item in results}) == 1
    assert counts() == (1, 3)


def test_disabled_routine_preserves_pre_akm25_fingerprint(seeded):
    # Published by scripts/demo_investigation_flow.py before the AKM-25 extension.
    assert run(seeded)["input_fingerprint"] == "cf9ae6afd8e5df9e6fdf76a59e857cec68be16d08714c0ae7f0fd7da856d49a2"


def test_bundled_demo_configuration_covers_all_metrics_with_explicit_resources(seeded, monkeypatch):
    monkeypatch.setenv("AKM_INVESTIGATION_CONFIG", str(Path(investigations.__file__).with_name("routine_demo_config.json")))
    settings = investigations.load_settings()
    assert len(settings.routine.checks) == 14
    assert {check.kind for check in settings.routine.checks} == set(METRICS)
    app.state.investigation_settings = settings
    run(seeded)
    assert len(agenda(seeded)) == 3


def test_measurement_registered_after_snapshot_does_not_satisfy_routine(seeded):
    configure(("mood_score", "A3"))
    sample = record(seeded, "mood_score", "A3")
    with Session(app.state.engine) as session:
        row = session.get(Measurement, sample["id"])
        row.recorded_at += timedelta(hours=1)
        session.add(row)
        session.commit()
    result = run(seeded)
    assert audit(result["id"])["plan"]["items"][0]["status"] == "needed"


def test_routine_deadline_orders_checks_before_creation_order(seeded):
    configure(("mood_score", "A3"), ("heart_rate_bpm", "A4"))
    settings = app.state.investigation_settings
    checks = tuple(check.model_copy(update={"every": timedelta(hours=12)})
                   if check.kind == "mood_score" else check for check in settings.routine.checks)
    app.state.investigation_settings = settings.model_copy(update={
        "routine": settings.routine.model_copy(update={"checks": checks}),
    })
    run(seeded)
    rows = agenda(seeded)
    assert [row["kind"] for row in rows] == ["co2_ppm", "mood_score", "heart_rate_bpm"]
    assert rows[1]["id"] > rows[2]["id"]


def test_concurrent_individual_and_crew_agendas_share_habitat_check(seeded):
    configure(("mood_score", "A3"), ("co2_ppm", None), anchor="2026-11-14T08:00:00Z")
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda subject: run(seeded, subject), (None, "A3")))
    rows = agenda(seeded)
    targets = [(row["kind"], row["astronaut_id"]) for row in rows]
    assert len(targets) == len(set(targets)) == 3
    assert targets.count(("co2_ppm", None)) == 1
    assert len({result["id"] for result in results}) == 2


@pytest.mark.parametrize("change", [{"every": "PT0S"}, {"every": "-P1D"},
    {"reference": " "}, {"reason": " "}, {"anchor_at": "2026-11-14T00:00:00"},
    {"astronaut_id": None}])
def test_invalid_routine_configuration_is_rejected(change):
    check = {"kind": "mood_score", "astronaut_id": "A1", "every": "P1D",
             "anchor_at": "2026-11-14T00:00:00Z", "reason": "Demo", "reference": "AKM-06"}
    with pytest.raises(ValueError):
        RoutinePolicy.model_validate({"checks": [{**check, **change}]})


def test_duplicate_routine_target_is_rejected(seeded):
    configure(("mood_score", "A3"))
    check = app.state.investigation_settings.routine.checks[0]
    with pytest.raises(ValueError):
        RoutinePolicy(checks=(check, check))


def test_window_end_is_next_period_and_utc_offset_is_normalized(seeded):
    configure(("mood_score", "A3"), anchor="2026-11-13T21:00:00-03:00")
    seeded.clock[0] = seeded.clock[0].replace(hour=0) + timedelta(days=1)
    settings = app.state.investigation_settings
    with Session(app.state.engine) as session:
        request = investigations.InvestigationRunRequest(scope="crew")
        snapshot = investigations._snapshot(session, request, seeded.clock[0])
        item = plan_routine(snapshot, settings.routine, settings.resources).items[0]
    assert item.window_start == seeded.clock[0]
    assert item.due_at == seeded.clock[0] + timedelta(days=1)


def test_routine_completion_retains_measurement_and_investigation_foreign_keys(seeded):
    configure(("mood_score", "A3"))
    first = run(seeded)
    routine = next(row for row in agenda(seeded) if row["kind"] == "mood_score")
    seeded.clock[0] += timedelta(minutes=1)
    sample = record(seeded, "mood_score", "A3")
    assert finish(seeded, routine["id"], sample["id"]).status_code == 200
    with Session(app.state.engine) as session:
        row = session.get(Followup, routine["id"])
        assert row.investigation_id == first["id"] and row.measurement_id == sample["id"]
        assert row.completed_at == seeded.clock[0]
