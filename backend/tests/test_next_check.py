from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from pydantic import ValidationError
import pytest

from app.next_check import CheckResource, CheckTarget, ValidatedProtocol, prioritize_next_check
from app.rules import CollectiveRuleConfig, CrewSnapshot, CrewMember, IndividualSnapshot
from app.schemas import MeasurementRead, NextCheck
from app.seed import NIGHT_1, PROFILES, observations


AS_OF = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
SCENARIOS = json.loads(
    Path(__file__).with_name("fixtures").joinpath("odyssey-26-scenarios.json").read_text(encoding="utf-8")
)


def scenario(name="collective", environment=None):
    case = SCENARIOS[name]
    rows = []
    for index, sample in enumerate(observations(), 1):
        data = sample.model_dump()
        data["measured_at"] = sample.measured_at
        if sample.kind == "sleep_hours" and sample.astronaut_id in case["sleep_overrides"]:
            value = case["sleep_overrides"][sample.astronaut_id][0 if sample.measured_at == NIGHT_1 else 1]
            if value is None:
                continue
            data["value"] = value
        if sample.kind == "co2_ppm":
            variant = environment or case["environment"]
            if variant == "missing":
                continue
            if variant == "suspect":
                data["quality"] = "suspect"
            if variant == "outside":
                data["measured_at"] -= timedelta(days=30)
            if variant == "unchanged":
                data["value"] = 680
        rows.append(MeasurementRead(**data, id=index, measurement_zone=sample.zone(),
                                   recorded_at=data["measured_at"] + timedelta(minutes=5)))
    ordered = tuple(sorted(rows, key=lambda row: (row.measured_at, row.id)))
    if case["scope"] == "individual":
        return IndividualSnapshot(astronaut_id="A1", baseline_sleep_hours=8, as_of=AS_OF, measurements=ordered)
    return CrewSnapshot(as_of=AS_OF, measurements=ordered,
        astronauts=tuple(CrewMember(id=p.id, baseline_sleep_hours=p.baseline_sleep_hours) for p in PROFILES))


def resources(co2=True, sleep=True, temperature=True):
    return (
        CheckResource(kind="co2_ppm", available=co2, effort="low"),
        CheckResource(kind="cabin_temp_c", available=temperature, effort="low"),
        *(CheckResource(kind="sleep_hours", astronaut_id=p.id, available=sleep, effort="low") for p in PROFILES),
    )


@pytest.mark.parametrize("name", list(SCENARIOS))
def test_official_scenarios_choose_expected_single_check(name):
    result = prioritize_next_check(scenario(name), "demo-v1", resources())
    expected = SCENARIOS[name]["expected"]["next_check"]
    assert result.status == "selected"
    assert result.next_check.kind == expected["kind"]
    assert result.next_check.astronaut_id == expected["astronaut_id"]
    assert result.next_check.reason and result.next_check.effort == "low"
    assert len(result.next_check.model_dump()) == 4
    assert NextCheck.model_validate(result.next_check.model_dump())
    assert result.demo_only and result.limitations


def test_scoring_exposes_information_quality_effort_and_availability():
    result = prioritize_next_check(scenario(), "demo-v1", resources())
    best = result.candidates[0]
    assert best.target.kind == "co2_ppm" and best.availability_score == 100
    assert best.informational_value == 100 and best.quality_need == 50
    assert best.effort_penalty == 0
    assert best.score == 3 * best.informational_value + best.quality_need - best.effort_penalty
    assert result.policy_version == "demo-priority-v1"


@pytest.mark.parametrize("variant", ["missing", "suspect", "outside"])
def test_weak_environment_prioritizes_a_new_cabin_observation(variant):
    result = prioritize_next_check(scenario(environment=variant), "demo-v1", resources())
    assert result.next_check.kind == "co2_ppm" and result.next_check.astronaut_id is None
    assert result.candidates[0].quality_need == 100
    assert "quality" in result.next_check.reason


def test_supported_collective_pattern_keeps_co2_priority_when_another_profile_lacks_data():
    data = scenario()
    rows = tuple(row for row in data.measurements if not (
        row.kind == "sleep_hours" and row.astronaut_id == "A4"
    ))
    incomplete = CrewSnapshot(as_of=AS_OF, astronauts=data.astronauts, measurements=rows)
    result = prioritize_next_check(incomplete, "demo-v1", resources())
    assert result.detection_status == "attention" and result.next_check.kind == "co2_ppm"


def test_unchanged_environment_gives_priority_to_following_individual_sleep():
    result = prioritize_next_check(scenario(environment="unchanged"), "demo-v1", resources())
    assert result.next_check.kind == "sleep_hours" and result.next_check.astronaut_id == "A1"


def test_unavailable_co2_uses_a_feasible_sleep_alternative_with_an_explanation():
    result = prioritize_next_check(scenario(), "demo-v1", resources(co2=False))
    assert result.status == "selected" and result.used_alternative
    assert result.next_check.kind == "sleep_hours"
    assert "next viable option" in result.next_check.reason
    assert result.candidates[0].availability_score == 0
    assert result.candidates[0].availability_reason


def test_temperature_is_a_contextual_alternative_not_a_replacement_for_co2():
    result = prioritize_next_check(scenario(), "demo-v1", resources(co2=False, sleep=False))
    assert result.used_alternative and result.next_check.kind == "cabin_temp_c"
    assert "separate CO₂ reading is still needed" in result.next_check.reason


def test_no_resources_or_all_unavailable_returns_no_fictitious_check():
    for catalog in ((), resources(co2=False, sleep=False, temperature=False)):
        result = prioritize_next_check(scenario(), "demo-v1", catalog)
        assert result.status == "unavailable" and result.next_check is None
        assert all(candidate.availability_score == 0 for candidate in result.candidates)
        assert result.reason and result.limitations


def test_irrelevant_available_metric_does_not_get_an_invented_reason():
    only_heart_rate = (CheckResource(kind="heart_rate_bpm", astronaut_id="A1", available=True, effort="low"),)
    result = prioritize_next_check(scenario(), "demo-v1", only_heart_rate)
    assert result.status == "unavailable" and result.next_check is None
    assert all(candidate.target.kind != "heart_rate_bpm" for candidate in result.candidates)


def test_lower_effort_breaks_the_tie_between_equally_informative_sleep_gaps():
    catalog = tuple(resource.model_copy(update={"effort": "high"})
        if resource.astronaut_id == "A2" else resource for resource in resources())
    result = prioritize_next_check(scenario("insufficient"), "demo-v1", catalog)
    assert result.next_check.astronaut_id == "A3"
    a2 = next(candidate for candidate in result.candidates if candidate.target.astronaut_id == "A2")
    a3 = next(candidate for candidate in result.candidates if candidate.target.astronaut_id == "A3")
    assert a2.informational_value == a3.informational_value
    assert a2.score < a3.score and a2.effort_penalty == 40


def test_normal_individual_does_not_create_an_unnecessary_check():
    crew = scenario()
    normal = IndividualSnapshot(astronaut_id="A4", baseline_sleep_hours=7.8, as_of=AS_OF,
                               measurements=crew.measurements)
    result = prioritize_next_check(normal, "demo-v1", resources())
    assert result.status == "no_check_needed" and result.next_check is None and result.candidates == ()


def test_empty_history_with_known_baseline_recommends_new_sleep_data():
    data = IndividualSnapshot(astronaut_id="A1", baseline_sleep_hours=8, as_of=AS_OF)
    result = prioritize_next_check(data, "demo-v1", resources())
    assert result.next_check.kind == "sleep_hours" and result.next_check.astronaut_id == "A1"
    assert "different period" in result.reason


def test_missing_baseline_or_empty_roster_needs_context_instead_of_an_invented_target():
    for data in (IndividualSnapshot(astronaut_id="A1", as_of=AS_OF), CrewSnapshot(as_of=AS_OF)):
        result = prioritize_next_check(data, "demo-v1", resources())
        assert result.status == "needs_context" and result.next_check is None


def test_crew_coverage_prioritizes_an_empty_profile_over_repeating_a_complete_old_profile():
    rows = tuple(MeasurementRead(
        id=index + 1, astronaut_id="A1", kind="sleep_hours", value=5, unit="h",
        measured_at=AS_OF - timedelta(hours=hours), recorded_at=AS_OF - timedelta(hours=hours),
        source="synthetic", measurement_zone="astronaut",
    ) for index, hours in enumerate((36, 12)))
    data = CrewSnapshot(as_of=AS_OF, measurements=rows, astronauts=(
        CrewMember(id="A1", baseline_sleep_hours=8), CrewMember(id="A2", baseline_sleep_hours=8),
    ))
    result = prioritize_next_check(data, "demo-v1", resources())
    assert result.detection_status == "insufficient_data"
    assert result.next_check.kind == "sleep_hours" and result.next_check.astronaut_id == "A2"
    only_complete_profile = (CheckResource(kind="sleep_hours", astronaut_id="A1", available=True, effort="low"),)
    unavailable = prioritize_next_check(data, "demo-v1", only_complete_profile)
    assert unavailable.status == "unavailable" and unavailable.next_check is None


def test_one_more_period_is_more_informative_than_starting_an_empty_profile():
    row = MeasurementRead(id=1, astronaut_id="A2", kind="sleep_hours", value=5, unit="h",
        measured_at=AS_OF - timedelta(hours=1), recorded_at=AS_OF,
        source="synthetic", measurement_zone="astronaut")
    data = CrewSnapshot(as_of=AS_OF, measurements=(row,), astronauts=(
        CrewMember(id="A1", baseline_sleep_hours=8), CrewMember(id="A2", baseline_sleep_hours=8),
    ))
    result = prioritize_next_check(data, "demo-v1", resources())
    assert result.next_check.astronaut_id == "A2"


def test_individually_sufficient_but_unaligned_periods_recommend_new_distinct_sleep():
    rows = []
    for subject, hours in (("A1", (36, 1)), ("A2", (25, 1))):
        for age in hours:
            stamp = AS_OF - timedelta(hours=age)
            rows.append(MeasurementRead(id=len(rows) + 1, astronaut_id=subject, kind="sleep_hours",
                value=5, unit="h", measured_at=stamp, recorded_at=stamp,
                source="synthetic", measurement_zone="astronaut"))
    data = CrewSnapshot(as_of=AS_OF, measurements=tuple(sorted(rows, key=lambda row: (row.measured_at, row.id))),
        astronauts=(CrewMember(id="A1", baseline_sleep_hours=8), CrewMember(id="A2", baseline_sleep_hours=8)))
    result = prioritize_next_check(data, "demo-v1", resources())
    assert result.detection_status == "insufficient_data"
    assert result.next_check.kind == "sleep_hours" and "distinct period" in result.reason


@pytest.mark.parametrize("incomplete_available", [False, None, True])
def test_crew_alignment_remains_an_alternative_to_collecting_a_missing_profile(incomplete_available):
    rows = []
    for subject, ages in (("A1", (36, 25)), ("A2", (25, 1))):
        for age in ages:
            measured_at = AS_OF - timedelta(hours=age)
            rows.append(MeasurementRead(
                id=len(rows) + 1, astronaut_id=subject, kind="sleep_hours", value=5, unit="h",
                measured_at=measured_at, recorded_at=measured_at + timedelta(minutes=5),
                source="synthetic", measurement_zone="astronaut",
            ))
    snapshot = CrewSnapshot(
        as_of=AS_OF, measurements=tuple(rows),
        astronauts=tuple(CrewMember(id=subject, baseline_sleep_hours=8) for subject in ("A1", "A2", "A3")),
    )
    catalog = tuple(CheckResource(kind="sleep_hours", astronaut_id=subject, available=True, effort="low")
                    for subject in ("A1", "A2"))
    if incomplete_available is not None:
        catalog += (CheckResource(kind="sleep_hours", astronaut_id="A3", available=incomplete_available, effort="high"),)

    result = prioritize_next_check(snapshot, "demo-v1", catalog)

    assert result.detection_status == "insufficient_data" and result.status == "selected"
    assert result.next_check.kind == "sleep_hours"
    assert result.next_check.astronaut_id == ("A3" if incomplete_available else "A1")
    assert result.used_alternative is (not incomplete_available)
    assert [candidate.target.astronaut_id for candidate in result.candidates] == ["A3", "A1", "A2"]
    assert result.candidates[1].score > result.candidates[0].score
    if not incomplete_available:
        assert "next viable option" in result.next_check.reason and "align" in result.next_check.reason


def test_collective_normal_does_not_hide_a_persisting_individual_pattern():
    individual = scenario("individual")
    crew = CrewSnapshot(as_of=AS_OF, measurements=individual.measurements,
        astronauts=tuple(CrewMember(id=p.id, baseline_sleep_hours=p.baseline_sleep_hours) for p in PROFILES))
    result = prioritize_next_check(crew, "demo-v1", resources())
    assert result.detection_status == "normal"
    assert result.next_check.kind == "sleep_hours" and result.next_check.astronaut_id == "A1"


def test_validated_protocol_order_has_priority_over_demo_score_and_effort():
    protocol = ValidatedProtocol(reference="mission-demo/protocol-reviewed", validated=True,
        action="measurement", permitted_checks=(
            CheckTarget(kind="heart_rate_bpm", astronaut_id="A1"), CheckTarget(kind="co2_ppm"),
        ))
    catalog = resources() + (CheckResource(kind="heart_rate_bpm", astronaut_id="A1", available=True, effort="high"),)
    result = prioritize_next_check(scenario(), "demo-v1", catalog, protocol=protocol)
    assert result.next_check.kind == "heart_rate_bpm" and result.next_check.effort == "high"
    assert result.protocol_reference == protocol.reference
    assert protocol.reference in result.next_check.reason
    assert result.candidates[0].protocol_rank == 0 and not result.used_alternative


def test_protocol_fallback_is_limited_to_its_permitted_targets():
    protocol = ValidatedProtocol(reference="reviewed-demo", validated=True, action="measurement",
        permitted_checks=(CheckTarget(kind="co2_ppm"), CheckTarget(kind="sleep_hours", astronaut_id="A2")))
    result = prioritize_next_check(scenario(), "demo-v1", resources(co2=False), protocol=protocol)
    assert result.used_alternative and result.next_check.astronaut_id == "A2"
    unavailable = prioritize_next_check(scenario(), "demo-v1", resources(co2=False, sleep=False), protocol=protocol)
    assert unavailable.status == "unavailable" and unavailable.next_check is None
    assert all(candidate.target.kind != "cabin_temp_c" for candidate in unavailable.candidates)


def test_human_protocol_referral_does_not_wait_for_detection_or_a_measurement():
    protocol = ValidatedProtocol(reference="reviewed-mission/referral", validated=True, action="human_review")
    result = prioritize_next_check(CrewSnapshot(as_of=AS_OF), "demo-v1", (), protocol=protocol)
    assert result.status == "protocol_referral" and result.detection_status is None
    assert result.next_check is None and result.candidates == ()
    assert "without waiting" in result.reason and result.protocol_reference == protocol.reference
    # Resource configuration is irrelevant to a referral that requires no collection.
    assert prioritize_next_check(CrewSnapshot(as_of=AS_OF), "demo-v1", resources() * 2,
                                 protocol=protocol).status == "protocol_referral"


@pytest.mark.parametrize("validation", [False, 1, "true", None])
def test_protocol_requires_explicit_validation(validation):
    with pytest.raises(ValidationError):
        ValidatedProtocol(reference="example", validated=validation, action="human_review")


def test_protocol_cannot_target_a_foreign_subject():
    protocol = ValidatedProtocol(reference="example-reviewed", validated=True, action="measurement",
        permitted_checks=(CheckTarget(kind="sleep_hours", astronaut_id="A99"),))
    with pytest.raises(ValueError, match="scope"):
        prioritize_next_check(scenario(), "demo-v1", resources(), protocol=protocol)


@pytest.mark.parametrize("target", [
    {"kind": "co2_ppm", "astronaut_id": "A1"}, {"kind": "sleep_hours"},
    {"kind": "sleep_hours", "astronaut_id": " "}, {"kind": "unknown"},
])
def test_invalid_check_zones_and_metrics_are_rejected(target):
    with pytest.raises(ValidationError):
        CheckTarget(**target)


def test_invalid_protocol_shapes_duplicate_resources_and_versions_are_rejected():
    for body in (
        dict(reference=" ", validated=True, action="human_review"),
        dict(reference="ref", validated=True, action="measurement"),
        dict(reference="ref", validated=True, action="human_review", permitted_checks=(CheckTarget(kind="co2_ppm"),)),
        dict(reference="ref", validated=True, action="measurement", permitted_checks=(CheckTarget(kind="co2_ppm"),) * 2),
    ):
        with pytest.raises(ValidationError):
            ValidatedProtocol(**body)
    with pytest.raises(ValueError, match="unique"):
        prioritize_next_check(scenario(), "demo-v1", resources() * 2)
    with pytest.raises(ValueError, match="rules_version"):
        prioritize_next_check(scenario(), " ", resources())


def test_selection_is_stable_under_resource_order_and_does_not_mutate_snapshot():
    data, catalog = scenario(), resources()
    before = data.model_dump_json()
    result = prioritize_next_check(data, "demo-v1", catalog)
    assert result == prioritize_next_check(data, "demo-v1", tuple(reversed(catalog)))
    assert result.model_dump_json() == prioritize_next_check(data, "demo-v1", catalog).model_dump_json()
    assert data.model_dump_json() == before
    with pytest.raises(ValidationError):
        result.next_check.effort = "high"


def test_custom_detector_configuration_is_used_in_selection():
    result = prioritize_next_check(scenario(), "demo-custom", resources(),
        CollectiveRuleConfig(environment_tolerance=timedelta(0)))
    assert result.next_check.kind == "co2_ppm" and result.candidates[0].quality_need == 100
    assert result.rules_version == "demo-custom"
