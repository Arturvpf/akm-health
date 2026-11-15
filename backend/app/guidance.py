"""Explain the stored demo analysis using AKM-08 and AKM-07 references."""

from pydantic import ValidationError

from .next_check import NextCheckSelection
from .rules import CollectiveDetection, IndividualDetection
from .schemas import (
    HumanReview, InvestigationCheckContext, InvestigationCoverage,
    InvestigationExplanation, InvestigationReference, InvestigationResult,
)


def explain_investigation(
    result: InvestigationResult,
    detection: IndividualDetection | CollectiveDetection | None,
    selection: NextCheckSelection | None,
) -> InvestigationExplanation:
    references = [
        InvestigationReference(
            source_id="AKM-ARCH",
            title="AKM Health · Demo architecture and rules",
            url="https://github.com/Arturvpf/akm-health/blob/main/docs/architecture-backend.md",
            relevance="Defines the sleep comparison and the experimental criteria.",
        ),
        InvestigationReference(
            source_id="HRR-100",
            title="NASA Human Research Roadmap · Sleep, circadian rhythms, and workload",
            url="https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100",
            relevance="Provides context for monitoring sleep on missions. The AKM architecture defines the demo rule.",
        ),
        InvestigationReference(
            source_id="AKM-08",
            title="AKM Health · Alert criteria and human review",
            url="https://github.com/Arturvpf/akm-health/blob/main/docs/akm-08-alert-safety.md",
            relevance="Explains when to contact mission staff and how to follow the mission protocol.",
        ),
    ]
    limitations = ["This investigation describes demo readings. Clinical assessment belongs to mission staff."]
    coverage = None
    if detection is not None:
        evaluated = detection.comparable_astronaut_ids if isinstance(detection, CollectiveDetection) else (
            (detection.astronaut_id,) if detection.status != "insufficient_data" else ()
        )
        coverage = InvestigationCoverage(
            window_start=detection.window_start, window_end=detection.as_of, evaluated_astronaut_ids=list(evaluated),
        )
        limitations.extend(detection.limitations)
    else:
        limitations.append("The saved record lacks auditable details about coverage.")

    if result.status == "insufficient_data":
        uncertainty = "This scope lacks enough readings to assess the sleep pattern."
    elif result.status == "attention":
        uncertainty = "The cause of the sleep pattern remains unknown."
    elif result.status == "normal":
        uncertainty = "The result applies to the evaluated sleep pattern, profiles, and observation window."
    else:
        uncertainty = "Mission staff are responsible for interpreting the record operationally."

    comparison = None
    if result.status == "attention" and isinstance(detection, CollectiveDetection):
        comparison = next((item for item in detection.environment if item.kind == "co2_ppm"), None)
    if comparison is not None:
        uncertainty += f" The CO₂ readings describe cabin air. {comparison.explanation}"
    if (comparison is not None
            or (result.next_check and result.next_check.kind == "co2_ppm")
            or any(item.kind == "co2_ppm" for item in result.evidence)):
        references.append(InvestigationReference(
            source_id="NASA-CO2",
            title="NASA OCHMO-TB-004 · Carbon dioxide",
            url="https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/",
            relevance="Provides cabin-air context. The investigation uses demo readings.",
        ))

    check_context = None
    if selection is not None:
        check_context = InvestigationCheckContext(status=selection.status, reason=selection.reason)
    if selection is not None and selection.status == "protocol_referral":
        human_review = HumanReview(
            mode="per_protocol",
            instruction="Contact the person designated by the mission protocol without waiting for a new reading.",
            protocol_reference=selection.protocol_reference,
        )
    else:
        human_review = HumanReview(
            mode="conditional",
            instruction=(
                "If the pattern persists after a follow-up, repeated collections fail, or you need help, "
                "share the scope, readings, timestamps, quality, gaps, and completed checks with mission staff. "
                "If the protocol calls for immediate referral, contact the designated person without waiting for reanalysis."
            ),
        )
    return InvestigationExplanation(
        coverage=coverage, limitations=limitations, uncertainty=uncertainty, references=references,
        check_context=check_context, human_review=human_review,
    )


def explain_stored_investigation(result: InvestigationResult, audit: dict) -> InvestigationExplanation:
    """Read available facts from the original audit without re-running the rules."""
    detection_model = CollectiveDetection if result.scope == "crew" else IndividualDetection
    try:
        detection = detection_model.model_validate(audit.get("detection"))
    except ValidationError:
        detection = None
    if detection is not None and (
        detection.status != result.status or detection.rules_version != result.rules_version
        or detection.as_of != result.created_at
        or detection.window_start.utcoffset() is None
        or isinstance(detection, IndividualDetection) and detection.astronaut_id != result.astronaut_id
    ):
        detection = None
    try:
        selection = NextCheckSelection.model_validate(audit.get("selection"))
    except ValidationError:
        selection = None
    if selection is not None:
        expected_check = result.next_check.model_dump() if result.next_check is not None else None
        stored_check = selection.next_check.model_dump() if selection.next_check is not None else None
        if (selection.scope, selection.astronaut_id, selection.rules_version, selection.as_of, stored_check) != (
            result.scope, result.astronaut_id, result.rules_version, result.created_at, expected_check,
        ):
            selection = None
    return explain_investigation(result, detection, selection)
