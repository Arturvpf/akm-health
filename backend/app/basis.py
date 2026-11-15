"""Read-only "why this finding" view built from the audit stored with an investigation.

Nothing is recomputed: the rule, thresholds and readings come from the facts saved when the
investigation ran, so the explanation always matches the original result.
"""
from datetime import datetime

from pydantic import ValidationError

from .rules import CollectiveDetection, IndividualDetection
from .schemas import InvestigationResult, StrictModel

RULE_TEXT = {
    "DR-01": (
        "Short sleep on two distinct days",
        "A crew member is flagged when the two latest usable sleep observations are both at or "
        "below a set share of that member's simulated baseline.",
    ),
    "DR-02": (
        "Same pattern across the crew",
        "A crew pattern is reported when at least two members with comparable sleep periods are "
        "each flagged by DR-01.",
    ),
    "DR-03": (
        "Cabin context",
        "Cabin CO₂ and temperature readings near those sleep periods are compared with an earlier "
        "reference. A shared direction of change is context only, never a cause.",
    ),
    "DR-04": (
        "Data quality",
        "Readings marked suspect are left out of the evidence, and the result says so.",
    ),
}


class BasisParameter(StrictModel):
    label: str
    value: str


class BasisReading(StrictModel):
    measurement_id: int
    kind: str
    value: float
    unit: str
    measured_at: datetime
    role: str


class BasisMember(StrictModel):
    astronaut_id: str
    status: str
    baseline_sleep_hours: float | None
    threshold_sleep_hours: float | None
    readings: list[BasisReading]
    excluded_suspect_ids: list[int]
    summary: str


class BasisEnvironment(StrictModel):
    kind: str
    consistent_shift: bool
    explanation: str
    readings: list[BasisReading]


class BasisRule(StrictModel):
    rule_id: str
    title: str
    description: str


class InvestigationBasis(StrictModel):
    investigation_id: int
    scope: str
    rules_version: str
    window_start: datetime
    window_end: datetime
    rules: list[BasisRule]
    parameters: list[BasisParameter]
    members: list[BasisMember]
    environment: list[BasisEnvironment]
    data_sources: list[str]
    limitations: list[str]
    demo_only: bool = True


def _hours(value) -> str:
    total = value.total_seconds() / 3600
    return f"{total:g} h"


def _member(result: IndividualDetection) -> BasisMember:
    readings = [
        BasisReading(
            measurement_id=row.measurement_id, kind="sleep_hours", value=row.value, unit=row.unit,
            measured_at=row.measured_at,
            role="at or below threshold" if result.threshold_sleep_hours is not None
            and row.value <= result.threshold_sleep_hours else "above threshold",
        )
        for row in result.evidence
    ]
    return BasisMember(
        astronaut_id=result.astronaut_id, status=result.status,
        baseline_sleep_hours=result.baseline_sleep_hours,
        threshold_sleep_hours=result.threshold_sleep_hours, readings=readings,
        excluded_suspect_ids=list(result.excluded_suspect_ids),
        summary=result.findings[0] if result.findings else "",
    )


def build_basis(result: InvestigationResult, audit: dict) -> InvestigationBasis | None:
    """Return None when the stored audit is missing or does not match the stored result."""
    model = CollectiveDetection if result.scope == "crew" else IndividualDetection
    try:
        detection = model.model_validate(audit.get("detection"))
        tolerance_text = None
        if isinstance(detection, CollectiveDetection):
            tolerance_text = _hours(detection.environment_tolerance)
    except (ValidationError, KeyError, TypeError, AttributeError):
        return None
    if detection.status != result.status or detection.rules_version != result.rules_version:
        return None
    if isinstance(detection, CollectiveDetection):
        individual = list(detection.individual_results)
        environment = [
            BasisEnvironment(
                kind=item.kind, consistent_shift=item.consistent_shift, explanation=item.explanation,
                readings=[
                    BasisReading(
                        measurement_id=row.measurement_id, kind=row.kind, value=row.value, unit=row.unit,
                        measured_at=row.measured_at, role=role,
                    )
                    for role, row in (
                        [("reference", item.baseline)] if item.baseline is not None else []
                    ) + [("compared", row) for row in item.aligned_readings]
                ],
            )
            for item in detection.environment
        ]
        rule_ids = ["DR-01", "DR-02", "DR-03", "DR-04"]
        limitations = list(detection.limitations)
        ratio = detection.individual_results[0].sleep_ratio if detection.individual_results else None
    else:
        individual = [detection]
        environment = []
        rule_ids = ["DR-01", "DR-04"]
        limitations = list(detection.limitations)
        ratio = detection.sleep_ratio
    window_hours = (detection.as_of - detection.window_start).total_seconds() / 3600
    parameters = [BasisParameter(label="Observation window", value=f"{window_hours:g} h before the run")]
    if ratio is not None:
        parameters.append(BasisParameter(label="Sleep threshold", value=f"{ratio * 100:g}% of the simulated baseline"))
    parameters.append(BasisParameter(label="Sleep periods required", value="2 distinct UTC days"))
    if tolerance_text is not None:
        parameters.append(BasisParameter(label="Cabin reading tolerance", value=f"{tolerance_text} around each sleep reading"))
    parameters.append(BasisParameter(label="Rules version", value=result.rules_version))
    measurement_ids = sorted({
        reading.measurement_id for member in individual for reading in _member(member).readings
    } | {
        reading.measurement_id for env in environment for reading in env.readings
    })
    sources = [
        "Simulated crew and cabin readings stored in this application"
        + (f" (measurements {', '.join(str(i) for i in measurement_ids)})" if measurement_ids else "") + ".",
        "Simulated per-member sleep baselines from the demo crew profile.",
        "NASA Human Research Program context is listed under the NASA references of this result.",
    ]
    return InvestigationBasis(
        investigation_id=result.id, scope=result.scope, rules_version=result.rules_version,
        window_start=detection.window_start, window_end=detection.as_of,
        rules=[BasisRule(rule_id=i, title=RULE_TEXT[i][0], description=RULE_TEXT[i][1]) for i in rule_ids],
        parameters=parameters, members=[_member(item) for item in individual],
        environment=environment, data_sources=sources, limitations=limitations,
    )
