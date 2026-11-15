"""AKM-03: validate response schemas and reject inconsistent provenance."""
from hashlib import sha256
import pytest
from pydantic import ValidationError
from app.schemas import (
    MeasurementCreate, MeasurementRead, InvestigationResult, FollowupRead,
    DashboardResponse, NASAReferenceResponse, AstronautRead,
)

STAMP = "2026-11-14T14:00:00Z"


def test_read_measurement_zone_and_timestamp():
    body = dict(id=3, astronaut_id=None, kind="co2_ppm", value=930, unit="ppm",
                measured_at=STAMP, recorded_at=STAMP, measurement_zone="habitat", source="synthetic")
    result = MeasurementRead(**body)
    assert result.zone() == "habitat"
    assert result.model_dump(mode="json")["measured_at"].endswith("Z")
    with pytest.raises(ValidationError):
        MeasurementRead(**(body | {"measurement_zone": "astronaut"}))


def test_reject_extra_response_fields():
    with pytest.raises(ValidationError):
        AstronautRead(id="A1", name="Aurora", role="Crew", baseline_sleep_hours=8, unknown=1)


def test_investigation_schema_and_fingerprint():
    digest = sha256(b"akm-test").hexdigest()
    body = dict(
        id=2, scope="crew", astronaut_id=None, status="attention", created_at=STAMP,
        rules_version="demo-v1", input_fingerprint=digest, reused=False,
        findings=["synthetic change"], evidence=[{"kind":"sleep_hours",
            "astronaut_ids":["A1","A2"],"quality":"ok"}],
        hypotheses=[{"label":"environmental coincidence",
            "certainty":"unconfirmed","explanation":"not causal"}],
        next_check={"kind":"co2_ppm","astronaut_id":None,
                    "reason":"confirm sensor","effort":"low"},
        followup_id=4,guidance=[],demo_only=True,
    )
    assert InvestigationResult(**body).followup_id == 4
    with pytest.raises(ValidationError):
        InvestigationResult(**(body | {"input_fingerprint":"placeholder"}))


def test_followup_state_requires_measurement_evidence():
    base = dict(id=8,investigation_id=4,astronaut_id=None,kind="co2_ppm",
                reason="check sensor",due_at=None,created_at=STAMP,
                completed_at=None,measurement_id=None,status="pending")
    assert FollowupRead(**base).status == "pending"
    with pytest.raises(ValidationError):
        FollowupRead(**(base | {"status":"completed"}))
    with pytest.raises(ValidationError):
        FollowupRead(**(base | {"measurement_id":2}))
    assert FollowupRead(**(base | {"status":"completed",
        "completed_at":STAMP,"measurement_id":123})).measurement_id == 123


def test_dashboard_handles_no_data():
    body = {"mission":{"name":"ODYSSEY-26","day":184,
         "destination":"mars_surface","gravity_g_reference":0.38,
         "context_source_url":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
         "demo_only":True},
        "astronauts":[],"environment":{"co2_ppm":None,
        "cabin_temp_c":None,"measured_at":None,"measurement_zone":"habitat"},
        "alerts":[],"pending_followups":[],"last_investigation_at":None,
        "has_unanalyzed_measurements":False}
    assert DashboardResponse.model_validate(body).has_unanalyzed_measurements is False
    with pytest.raises(ValidationError):
        DashboardResponse.model_validate(body | {"environment":{
            "co2_ppm":None,"cabin_temp_c":None,
            "measured_at":None,"measurement_zone":"exterior"}})


def test_nasa_history_requires_provenance_and_consistent_status():
    assert NASAReferenceResponse(scientific_references=[],
        historical_series=[], historical_data_status="not_imported").historical_series == []
    historical = [{"source":"NASA","source_url":"https://example.org",
        "mission_id":"X","parameter":"temp","value":1,"unit":"C",
        "context":"historical"}]
    with pytest.raises(ValidationError):
        NASAReferenceResponse(scientific_references=[],
          historical_series=historical,historical_data_status="not_imported")
    with pytest.raises(ValidationError):
        NASAReferenceResponse(scientific_references=[],
          historical_series=[],historical_data_status="imported")


def test_explicit_timezone_conversion_and_reject_naive():
    record=MeasurementCreate(astronaut_id="A1",kind="sleep_hours",value=6.2,
      unit="h",measured_at="2026-11-14T11:00:00-03:00",source="manual")
    assert record.model_dump(mode="json")["measured_at"] == STAMP
    with pytest.raises(ValidationError):
        MeasurementCreate(astronaut_id="A1",kind="sleep_hours",value=6.2,
           unit="h",measured_at="2026-11-14T14:00:00",source="manual")
