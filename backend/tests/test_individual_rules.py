"""DR-01/04 acceptance cases for the pure AKM-21 detector."""

from datetime import datetime, timedelta, timezone
from decimal import localcontext
import json
from pathlib import Path

from pydantic import ValidationError
import pytest

from app.rules import IndividualRuleConfig, IndividualSnapshot, detect_individual_changes
from app.schemas import MeasurementRead
from app.seed import NIGHT_1, NIGHT_2, PROFILES, observations


AS_OF = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
SCENARIOS = json.loads(
    Path(__file__).with_name("fixtures").joinpath("odyssey-26-scenarios.json").read_text(encoding="utf-8")
)


def reading(id, value, when, **updates):
    return MeasurementRead.model_validate({
        "id": id, "astronaut_id": "A1", "kind": "sleep_hours", "value": value,
        "unit": "h", "measured_at": when, "recorded_at": when,
        "measurement_zone": "astronaut", "source": "synthetic", **updates,
    })


def snapshot(*rows, baseline=8, **updates):
    return IndividualSnapshot(
        astronaut_id="A1", baseline_sleep_hours=baseline, as_of=AS_OF,
        measurements=tuple(sorted(rows, key=lambda row: (row.measured_at, row.id))), **updates,
    )


def detect(*rows, baseline=8, config=IndividualRuleConfig()):
    return detect_individual_changes(snapshot(*rows, baseline=baseline), "demo-v1", config)


@pytest.mark.parametrize("values, expected", [
    ((5.2, 5.4), "attention"), ((6.4, 6.4), "attention"),
    ((6.4, 6.41), "normal"), ((7.7, 7.9), "normal"),
    ((0, 0), "attention"),
])
def test_individual_decision_and_explainable_evidence(values, expected):
    result = detect(reading(1, values[0], NIGHT_1), reading(2, values[1], NIGHT_2))
    assert result.status == expected
    assert result.threshold_sleep_hours == 6.4
    assert [row.measurement_id for row in result.evidence] == [1, 2]
    assert [row.value for row in result.evidence] == list(values)
    assert all(row.quality == "ok" and row.unit == "h" for row in result.evidence)
    assert result.rules_version == "demo-v1" and result.rule_id == "DR-01"
    assert result.findings and result.limitations and result.demo_only
    assert result.status != "critical"


def test_decimal_inclusive_threshold_is_not_changed_by_binary_rounding():
    result = detect(reading(1, 7.28, NIGHT_1), reading(2, 7.28, NIGHT_2), baseline=9.1)
    assert result.status == "attention"
    assert result.threshold_sleep_hours == 7.28


def test_caller_decimal_precision_does_not_change_the_result():
    rows = (reading(1, 7.29, NIGHT_1), reading(2, 7.29, NIGHT_2))
    expected = detect(*rows, baseline=9.1)
    with localcontext() as context:
        context.prec = 2
        actual = detect(*rows, baseline=9.1)
    assert actual == expected
    assert actual.status == "normal"


@pytest.mark.parametrize("baseline", [None, 0, -1])
def test_missing_or_nonpositive_baseline_is_insufficient(baseline):
    result = detect(reading(1, 5, NIGHT_1), reading(2, 5, NIGHT_2), baseline=baseline)
    assert result.status == "insufficient_data"
    assert result.threshold_sleep_hours is None
    assert "baseline" in result.findings[0]


def test_empty_and_single_period_do_not_become_normal():
    assert detect().status == "insufficient_data"
    assert detect(reading(1, 5, NIGHT_1)).status == "insufficient_data"
    result = detect(reading(1, 5, NIGHT_1), reading(2, 5, NIGHT_1 + timedelta(hours=1)))
    assert result.status == "insufficient_data"
    assert [row.measurement_id for row in result.evidence] == [2]


def test_same_instant_duplicates_do_not_count_as_two_periods():
    result = detect(reading(1, 5, NIGHT_1), reading(2, 5, NIGHT_1))
    assert result.status == "insufficient_data"
    assert [row.measurement_id for row in result.evidence] == [2]


def test_suspect_observations_are_excluded_with_an_explicit_limitation():
    result = detect(reading(1, 5, NIGHT_1), reading(2, 5, NIGHT_2, quality="suspect"))
    assert result.status == "insufficient_data"
    assert result.excluded_suspect_ids == (2,)
    assert [row.measurement_id for row in result.evidence] == [1]
    assert any("suspeitas" in text for text in result.limitations)


def test_suspect_repeat_does_not_replace_a_usable_observation():
    result = detect(
        reading(1, 5, NIGHT_1), reading(2, 5, NIGHT_2),
        reading(3, 10, NIGHT_2 + timedelta(minutes=10), quality="suspect"),
    )
    assert result.status == "attention"
    assert [row.measurement_id for row in result.evidence] == [1, 2]
    assert result.excluded_suspect_ids == (3,)


def test_latest_usable_observation_replaces_same_period_even_if_value_recovers():
    result = detect(
        reading(1, 5, NIGHT_1), reading(2, 5, NIGHT_2),
        reading(3, 8, NIGHT_2 + timedelta(minutes=10)),
    )
    assert result.status == "normal"
    assert [row.measurement_id for row in result.evidence] == [1, 3]


def test_latest_two_periods_are_evaluated_instead_of_older_low_values():
    result = detect(
        reading(1, 5, AS_OF - timedelta(hours=47)),
        reading(2, 5, NIGHT_1), reading(3, 8, NIGHT_2),
    )
    assert result.status == "normal"
    assert [row.measurement_id for row in result.evidence] == [2, 3]


def test_window_is_inclusive_and_future_or_stale_data_is_excluded():
    start = AS_OF - timedelta(hours=48)
    assert detect(reading(1, 5, start), reading(2, 5, AS_OF)).status == "attention"
    result = detect(
        reading(1, 5, start - timedelta(microseconds=1)), reading(2, 5, NIGHT_1),
        reading(3, 5, AS_OF + timedelta(microseconds=1)),
        reading(4, 5, NIGHT_2, recorded_at=AS_OF + timedelta(microseconds=1)),
    )
    assert result.status == "insufficient_data"
    assert [row.measurement_id for row in result.evidence] == [2]


def test_other_crew_habitat_and_non_sleep_metrics_do_not_influence_result():
    other_data = (
        reading(3, 0, NIGHT_1, astronaut_id="A2"),
        reading(4, 0, NIGHT_2, astronaut_id="A2"),
        reading(5, 5000, NIGHT_2, astronaut_id=None, kind="co2_ppm", unit="ppm", measurement_zone="habitat"),
        reading(6, 200, NIGHT_2, kind="heart_rate_bpm", unit="bpm"),
    )
    base = (reading(1, 8, NIGHT_1), reading(2, 8, NIGHT_2))
    assert detect(*base, *other_data) == detect(*base)


def test_configuration_is_explicit_and_version_is_preserved():
    rows = (reading(1, 6, NIGHT_1), reading(2, 6, NIGHT_2))
    assert detect(*rows).status == "attention"
    result = detect_individual_changes(
        snapshot(*rows), "demo-v2", IndividualRuleConfig(sleep_ratio=0.7),
    )
    assert result.status == "normal" and result.rules_version == "demo-v2"
    assert result.threshold_sleep_hours == 5.6
    assert detect(*rows, config=IndividualRuleConfig(window=timedelta(hours=12))).status == "insufficient_data"


def test_detector_is_deterministic_and_does_not_mutate_the_snapshot():
    data = snapshot(reading(1, 5, NIGHT_1), reading(2, 5, NIGHT_2))
    original = data.model_dump_json()
    first = detect_individual_changes(data, "demo-v1")
    assert first.model_dump_json() == detect_individual_changes(data, "demo-v1").model_dump_json()
    assert data.model_dump_json() == original
    with pytest.raises(ValidationError):
        first.status = "normal"


def test_utc_dates_determine_distinct_periods():
    # Different written dates, but the same UTC calendar date.
    result = detect(
        reading(1, 5, "2026-11-12T23:00:00-03:00"),
        reading(2, 5, "2026-11-13T07:00:00Z"),
    )
    assert result.status == "insufficient_data"
    assert result.evidence[0].period.isoformat() == "2026-11-13"


def test_unordered_or_repeated_measurement_ids_are_rejected():
    with pytest.raises(ValidationError, match="ordered"):
        IndividualSnapshot(astronaut_id="A1", as_of=AS_OF, measurements=(
            reading(2, 5, NIGHT_2), reading(1, 5, NIGHT_1),
        ))
    with pytest.raises(ValidationError, match="unique"):
        snapshot(reading(1, 5, NIGHT_1), reading(1, 5, NIGHT_2))


@pytest.mark.parametrize("baseline", [float("inf"), float("nan")])
def test_nonfinite_baselines_are_rejected(baseline):
    with pytest.raises(ValidationError):
        snapshot(baseline=baseline)


@pytest.mark.parametrize("config", [
    {"window": timedelta(0)}, {"window": timedelta(hours=-1)},
    {"sleep_ratio": 0}, {"sleep_ratio": 1.1}, {"sleep_ratio": float("nan")},
])
def test_invalid_rule_configuration_is_rejected(config):
    with pytest.raises(ValidationError):
        IndividualRuleConfig(**config)


@pytest.mark.parametrize("version", ["", " ", None])
def test_missing_rule_version_is_rejected(version):
    with pytest.raises(ValueError, match="rules_version"):
        detect_individual_changes(snapshot(), version)


def test_naive_reference_and_window_overflow_are_rejected():
    with pytest.raises(ValidationError, match="timezone"):
        IndividualSnapshot(astronaut_id="A1", as_of=AS_OF.replace(tzinfo=None))
    with pytest.raises(ValueError, match="Window"):
        detect_individual_changes(
            IndividualSnapshot(astronaut_id="A1", as_of=datetime(1, 1, 1, tzinfo=timezone.utc)),
            "demo-v1",
        )


@pytest.mark.parametrize("reference", [1794643200, "1794643200", "2026-11-14"])
def test_reference_requires_explicit_datetime_with_timezone(reference):
    with pytest.raises(ValidationError):
        IndividualSnapshot(astronaut_id="A1", as_of=reference)


@pytest.mark.parametrize("scenario", list(SCENARIOS))
def test_official_scenarios_have_expected_individual_results(scenario):
    case = SCENARIOS[scenario]
    rows = []
    for index, observation in enumerate(observations(), 1):
        data = observation.model_dump()
        if observation.kind == "sleep_hours" and observation.astronaut_id in case["sleep_overrides"]:
            night = 0 if observation.measured_at == NIGHT_1 else 1
            value = case["sleep_overrides"][observation.astronaut_id][night]
            if value is None:
                continue
            data["value"] = value
        rows.append(MeasurementRead.model_validate({
            **data, "id": index, "recorded_at": observation.measured_at + timedelta(minutes=5),
            "measurement_zone": observation.zone(),
        }))
    statuses = {}
    for profile in PROFILES:
        result = detect_individual_changes(IndividualSnapshot(
            astronaut_id=profile.id, baseline_sleep_hours=profile.baseline_sleep_hours,
            as_of=AS_OF, measurements=tuple(sorted(rows, key=lambda row: (row.measured_at, row.id))),
        ), "demo-v1")
        statuses[profile.id] = result.status
    assert [key for key, status in statuses.items() if status == "attention"] == case["expected"]["affected_astronauts"]
    if scenario == "insufficient":
        assert statuses == {"A1": "attention", "A2": "insufficient_data", "A3": "insufficient_data", "A4": "insufficient_data"}
    else:
        assert all(statuses[profile] == "normal" for profile in statuses if profile not in case["expected"]["affected_astronauts"])
