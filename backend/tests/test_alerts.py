from datetime import datetime, timedelta, timezone

from pydantic import ValidationError
import pytest

from app.alerts import AlertContext, alert_legend, present_alert, present_individual_alert
from app.rules import IndividualSnapshot, detect_individual_changes
from app.schemas import MeasurementRead


AS_OF = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)


def context(**updates):
    return AlertContext.model_validate({
        "status": "normal", "scope": "individual", "astronaut_id": "A1",
        "rules_version": "demo-v1", "as_of": AS_OF,
        "window_start": AS_OF - timedelta(hours=48),
        "findings": ("Experimental rule result.",),
        "evaluated_astronaut_ids": ("A1",), "evidence_ids": (1, 2), **updates,
    })


@pytest.mark.parametrize("status, color, icon, label", [
    ("normal", "green", "circle-check", "No pattern under the demo rule"),
    ("attention", "yellow", "triangle-alert", "Experimental pattern to check"),
    ("insufficient_data", "gray", "info", "Insufficient data"),
])
def test_status_always_has_text_icon_and_color(status, color, icon, label):
    result = present_alert(context(status=status))
    assert result.style.color == color and result.style.icon == icon
    assert result.style.label == label
    assert result.context.status == status and not result.style.legend_only
    assert result.explanation == "Experimental rule result."
    assert result.demo_only and result.disclaimer


def test_red_is_reproducible_in_the_legend_and_never_a_synthetic_alert():
    styles = alert_legend()
    red = styles[-1]
    assert red.status == "critical" and red.color == "red" and red.legend_only
    assert red.icon == "siren" and "protocol" in red.label
    with pytest.raises(ValidationError):
        context(status="critical")
    with pytest.raises(ValidationError):
        red.legend_only = False
    assert styles == alert_legend()


@pytest.mark.parametrize("values, expected, color", [
    ((6.4, 6.4), "attention", "yellow"),
    ((6.4, 6.41), "normal", "green"),
    ((0, 0), "attention", "yellow"),
    ((5,), "insufficient_data", "gray"),
    ((), "insufficient_data", "gray"),
])
def test_presentation_uses_real_individual_detector_results(values, expected, color):
    rows = tuple(MeasurementRead(
        id=index + 1, astronaut_id="A1", kind="sleep_hours", value=value, unit="h",
        measured_at=AS_OF - timedelta(days=1 - index, hours=1),
        recorded_at=AS_OF - timedelta(days=1 - index), source="synthetic", measurement_zone="astronaut",
    ) for index, value in enumerate(values))
    detection = detect_individual_changes(IndividualSnapshot(
        astronaut_id="A1", baseline_sleep_hours=8, as_of=AS_OF, measurements=rows,
    ), "demo-v1")
    result = present_individual_alert(detection)
    assert result.context.status == expected and result.style.color == color
    assert result.context.findings == detection.findings
    assert result.context.limitations == detection.limitations
    assert result.context.evidence_ids == tuple(row.measurement_id for row in detection.evidence)
    assert result.evaluated_profile_count == (0 if expected == "insufficient_data" else 1)


@pytest.mark.parametrize("status", ["normal", "attention", "insufficient_data"])
def test_new_measurements_only_add_update_message_and_preserve_confirmed_status(status):
    original = context(status=status)
    before = present_alert(original)
    after = present_alert(context(status=status, has_unanalyzed_measurements=True))
    assert after.context.status == before.context.status
    assert after.style == before.style and after.explanation == before.explanation
    assert before.update_message is None
    assert after.update_message == "New measurements available — update the investigation"


def test_collective_context_preserves_coverage_and_explicit_uncertainty():
    result = present_alert(context(
        scope="crew", astronaut_id=None, status="attention",
        evaluated_astronaut_ids=("A1", "A2", "A3"),
        findings=("Experimental crew pattern.", "Environmental overlap is unconfirmed."),
        limitations=("The overlap does not demonstrate causality.",),
    ))
    assert result.context.scope == "crew" and result.evaluated_profile_count == 3
    assert "unconfirmed" in result.explanation
    assert result.context.limitations == ("The overlap does not demonstrate causality.",)
    assert result.context.as_of == AS_OF


@pytest.mark.parametrize("changes", [
    {"status": "error"}, {"status": "loading"}, {"status": "unknown"},
    {"astronaut_id": None}, {"scope": "crew"}, {"rules_version": " "},
    {"findings": ()}, {"findings": (" ",)}, {"limitations": ("",)},
    {"window_start": AS_OF + timedelta(hours=1)},
    {"as_of": AS_OF.replace(tzinfo=None)}, {"as_of": 1794643200},
    {"evidence_ids": (2, 1)}, {"evidence_ids": (1, 1)}, {"evidence_ids": (0,)},
    {"evaluated_astronaut_ids": ("A2",)}, {"evaluated_astronaut_ids": ("A1", "A1")},
])
def test_invalid_display_context_is_rejected_without_inventing_a_status(changes):
    with pytest.raises(ValidationError):
        context(**changes)


def test_presenter_is_deterministic_and_does_not_mutate_input():
    data = context()
    before = data.model_dump_json()
    first = present_alert(data)
    assert first.model_dump_json() == present_alert(data).model_dump_json()
    assert data.model_dump_json() == before
    with pytest.raises(ValidationError):
        first.style.color = "red"
