from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from pydantic import ValidationError
import pytest

from app.rules import CollectiveRuleConfig, CrewMember, CrewSnapshot, IndividualRuleConfig, detect_collective_patterns
from app.schemas import MeasurementRead
from app.seed import NIGHT_1, PROFILES, observations


AS_OF = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
SCENARIOS = json.loads(
    Path(__file__).with_name("fixtures").joinpath("odyssey-26-scenarios.json").read_text(encoding="utf-8")
)


def scenario_snapshot(name="collective", environment=None):
    case = SCENARIOS[name]
    variant = environment or case["environment"]
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
            if variant == "missing":
                continue
            if variant == "suspect":
                data["quality"] = "suspect"
            if variant == "outside":
                data["measured_at"] -= timedelta(days=30)
            if variant == "unchanged":
                data["value"] = 680
        rows.append(MeasurementRead(
            **data, id=index, measurement_zone=sample.zone(),
            recorded_at=data["measured_at"] + timedelta(minutes=5),
        ))
    return CrewSnapshot(
        astronauts=tuple(CrewMember(id=p.id, baseline_sleep_hours=p.baseline_sleep_hours) for p in PROFILES),
        measurements=tuple(sorted(rows, key=lambda row: (row.measured_at, row.id))), as_of=AS_OF,
    )


def with_rows(snapshot, rows):
    return CrewSnapshot(
        astronauts=snapshot.astronauts, as_of=snapshot.as_of,
        measurements=tuple(sorted(rows, key=lambda row: (row.measured_at, row.id))),
    )


def test_collective_fixture_identifies_three_profiles_and_uncertain_co2_hypothesis():
    result = detect_collective_patterns(scenario_snapshot(), "demo-v1")
    assert result.status == "attention"
    assert result.affected_astronaut_ids == ("A1", "A2", "A3")
    assert result.comparable_astronaut_ids == ("A1", "A2", "A3", "A4")
    co2, temperature = result.environment
    assert co2.baseline.value == 680
    assert [row.value for row in co2.aligned_readings] == [950, 980]
    assert co2.consistent_shift
    assert temperature.kind == "cabin_temp_c"
    assert len(result.hypotheses) == 2
    assert all(hypothesis.certainty == "unconfirmed" for hypothesis in result.hypotheses)
    assert "alternativas" in result.hypotheses[1].label
    assert all(row.source == "synthetic" for row in co2.aligned_readings)
    assert result.demo_only and result.rules_version == "demo-v1"


@pytest.mark.parametrize("variant", ["missing", "suspect", "outside", "unchanged"])
def test_weak_environment_never_erases_collective_sleep_finding(variant):
    result = detect_collective_patterns(scenario_snapshot(environment=variant), "demo-v1")
    assert result.status == "attention"
    assert not result.environment[0].consistent_shift
    assert len(result.hypotheses) == 1
    assert "alternativas" in result.hypotheses[0].label


def test_individual_fixture_keeps_individual_attention_without_collective_pattern():
    result = detect_collective_patterns(scenario_snapshot("individual"), "demo-v1")
    assert result.status == "normal"
    assert result.affected_astronaut_ids == ("A1",)
    assert result.individual_results[0].status == "attention"
    assert result.hypotheses == ()


def test_insufficient_fixture_reports_partial_coverage_without_fabricating_a_cohort():
    result = detect_collective_patterns(scenario_snapshot("insufficient"), "demo-v1")
    assert result.status == "insufficient_data"
    assert result.sufficient_astronaut_ids == ("A1",)
    assert result.comparable_astronaut_ids == ()
    assert result.individual_results[0].status == "attention"
    assert result.hypotheses == ()


def test_empty_crew_and_missing_baselines_are_insufficient():
    assert detect_collective_patterns(CrewSnapshot(as_of=AS_OF), "demo-v1").status == "insufficient_data"
    base = scenario_snapshot()
    missing = CrewSnapshot(
        as_of=AS_OF, measurements=base.measurements,
        astronauts=tuple(CrewMember(id=p.id) for p in PROFILES),
    )
    assert detect_collective_patterns(missing, "demo-v1").status == "insufficient_data"


def test_two_profiles_are_enough_and_temperature_cannot_trigger_a_sleep_alert():
    base = scenario_snapshot()
    pair = CrewSnapshot(as_of=AS_OF, measurements=base.measurements, astronauts=base.astronauts[:2])
    assert detect_collective_patterns(pair, "demo-v1").status == "attention"
    normal = scenario_snapshot("individual")
    changed_temperature = [
        row.model_copy(update={"value": 100.0}) if row.kind == "cabin_temp_c" else row
        for row in normal.measurements
    ]
    result = detect_collective_patterns(with_rows(normal, changed_temperature), "demo-v1")
    assert result.status == "normal" and not result.hypotheses


def test_no_reference_or_only_one_aligned_co2_reading_means_no_environmental_support():
    base = scenario_snapshot()
    co2 = [row for row in base.measurements if row.kind == "co2_ppm" and row.quality == "ok"]
    for excluded in (co2[0].id, co2[-1].id):
        rows = [row for row in base.measurements if row.id != excluded]
        result = detect_collective_patterns(with_rows(base, rows), "demo-v1")
        assert result.status == "attention"
        assert not result.environment[0].consistent_shift
        assert len(result.hypotheses) == 1


def test_zero_co2_reference_is_preserved_and_not_confused_with_missing():
    base = scenario_snapshot()
    rows = [
        row.model_copy(update={"value": 0.0})
        if row.kind == "co2_ppm" and row.value == 680 else row
        for row in base.measurements
    ]
    co2 = detect_collective_patterns(with_rows(base, rows), "demo-v1").environment[0]
    assert co2.baseline.value == 0 and co2.consistent_shift


def test_future_recording_and_sensor_repeats_cannot_create_a_reference():
    base = scenario_snapshot()
    co2 = [row for row in base.measurements if row.kind == "co2_ppm" and row.quality == "ok"]
    rows = [row for row in base.measurements if row.id != co2[0].id]
    rows.append(co2[0].model_copy(update={"recorded_at": AS_OF + timedelta(hours=1)}))
    rows.append(co2[1].model_copy(update={"id": 1000}))
    result = detect_collective_patterns(with_rows(base, rows), "demo-v1")
    assert not result.environment[0].consistent_shift
    assert result.environment[0].baseline is None


def test_tolerance_is_configurable_and_wide_overlap_still_uses_distinct_ordered_samples():
    base = scenario_snapshot()
    exact = detect_collective_patterns(base, "demo-v1", CollectiveRuleConfig(environment_tolerance=timedelta(0)))
    assert not exact.environment[0].consistent_shift
    wide = detect_collective_patterns(base, "demo-v1", CollectiveRuleConfig(environment_tolerance=timedelta(days=3)))
    ids = [row.measurement_id for row in wide.environment[0].aligned_readings]
    assert len(ids) == len(set(ids)) == 2
    assert [row.value for row in wide.environment[0].aligned_readings] == [950, 980]
    assert wide.environment[0].consistent_shift


def test_uncomparable_periods_do_not_make_a_collective_pattern():
    base = scenario_snapshot()
    rows = [
        row.model_copy(update={"measured_at": row.measured_at - timedelta(days=1),
                               "recorded_at": row.recorded_at - timedelta(days=1)})
        if row.kind == "sleep_hours" and row.astronaut_id == "A2" else row
        for row in base.measurements
    ]
    pair = CrewSnapshot(as_of=AS_OF, astronauts=base.astronauts[:2], measurements=with_rows(base, rows).measurements)
    config = CollectiveRuleConfig(individual=IndividualRuleConfig(window=timedelta(hours=72)))
    result = detect_collective_patterns(pair, "demo-v1", config)
    assert result.sufficient_astronaut_ids == ("A1", "A2")
    assert result.status == "insufficient_data"


def test_latest_comparable_cohort_does_not_reuse_an_older_collective_pattern():
    base = scenario_snapshot()
    rows = []
    for row in base.measurements:
        if row.kind == "sleep_hours" and row.astronaut_id in ("A1", "A2"):
            row = row.model_copy(update={"measured_at": row.measured_at - timedelta(days=1),
                                         "recorded_at": row.recorded_at - timedelta(days=1)})
        elif row.kind == "sleep_hours" and row.astronaut_id == "A3":
            row = row.model_copy(update={"value": 8.0})
        rows.append(row)
    result = detect_collective_patterns(
        with_rows(base, rows), "demo-v1",
        CollectiveRuleConfig(individual=IndividualRuleConfig(window=timedelta(hours=72))),
    )
    assert result.status == "normal"
    assert result.comparable_astronaut_ids == ("A3", "A4")
    assert result.affected_astronaut_ids == ()
    assert [row.status for row in result.individual_results[:2]] == ["attention", "attention"]


def test_different_direction_or_unchanged_environment_is_not_a_consistent_shift():
    base = scenario_snapshot()
    rows = [
        row.model_copy(update={"value": 500.0}) if row.kind == "co2_ppm" and row.value == 980 else row
        for row in base.measurements
    ]
    result = detect_collective_patterns(with_rows(base, rows), "demo-v1")
    assert result.status == "attention" and not result.environment[0].consistent_shift


def test_output_is_deterministic_and_snapshot_unchanged():
    base = scenario_snapshot()
    original = base.model_dump_json()
    first = detect_collective_patterns(base, "demo-v1")
    assert first.model_dump_json() == detect_collective_patterns(base, "demo-v1").model_dump_json()
    assert base.model_dump_json() == original
    with pytest.raises(ValidationError):
        first.hypotheses[0].certainty = "confirmed"


@pytest.mark.parametrize("members", [
    (CrewMember(id="A1"), CrewMember(id="A1")),
    (CrewMember(id="A2"), CrewMember(id="A1")),
])
def test_duplicate_or_unordered_members_are_rejected(members):
    with pytest.raises(ValidationError):
        CrewSnapshot(as_of=AS_OF, astronauts=members)


def test_invalid_order_timestamps_configuration_and_version_are_rejected():
    base = scenario_snapshot()
    with pytest.raises(ValidationError):
        CrewSnapshot(as_of=AS_OF, measurements=tuple(reversed(base.measurements)))
    with pytest.raises(ValidationError):
        CrewSnapshot(as_of=AS_OF, measurements=(base.measurements[0], base.measurements[0]))
    with pytest.raises(ValidationError):
        CrewSnapshot(as_of=AS_OF.replace(tzinfo=None))
    with pytest.raises(ValidationError):
        CollectiveRuleConfig(environment_tolerance=timedelta(hours=-1))
    with pytest.raises(ValueError):
        detect_collective_patterns(base, " ")
