"""AKM-24: deterministic presentation of existing experimental statuses."""

from datetime import datetime
from types import MappingProxyType
from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from .rules import IndividualDetection
from .schemas import InvestigationStatus, MeasurementCreate, StrictModel, require_utc


P0Status = Literal["normal", "attention", "insufficient_data"]


class AlertStyle(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: InvestigationStatus
    label: str
    color: Literal["green", "yellow", "gray", "red"]
    icon: Literal["circle-check", "triangle-alert", "info", "siren"]
    attention_level: Literal["routine", "verify", "missing_data", "reserved_protocol"]
    action_text: str
    legend_only: bool = False


_STYLES = MappingProxyType({
    "normal": AlertStyle(
        status="normal", label="No pattern under the demo rule", color="green", icon="circle-check",
        attention_level="routine", action_text="Review the observation window and the data actually evaluated.",
    ),
    "attention": AlertStyle(
        status="attention", label="Experimental pattern to check", color="yellow", icon="triangle-alert",
        attention_level="verify", action_text="Review the finding and the checks available in the investigation.",
    ),
    "insufficient_data": AlertStyle(
        status="insufficient_data", label="Insufficient data", color="gray", icon="info",
        attention_level="missing_data", action_text="Review the reported gap and the collection instructions.",
    ),
    "critical": AlertStyle(
        status="critical", label="Follow mission protocol", color="red", icon="siren",
        attention_level="reserved_protocol", legend_only=True,
        action_text="Reserved for an authorized protocol; no demo rule triggers it automatically.",
    ),
})


class AlertContext(StrictModel):
    """Already computed status and evidence metadata, not raw measurements."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    status: P0Status
    scope: Literal["individual", "crew"]
    astronaut_id: str | None = None
    rules_version: str = Field(min_length=1)
    as_of: datetime
    window_start: datetime
    findings: tuple[str, ...] = Field(min_length=1)
    limitations: tuple[str, ...] = ()
    evaluated_astronaut_ids: tuple[str, ...] = ()
    evidence_ids: tuple[int, ...] = ()
    has_unanalyzed_measurements: bool = False

    @field_validator("as_of", "window_start", mode="before")
    @classmethod
    def explicit_timestamp(cls, value: object) -> object:
        return MeasurementCreate.check_timestamp_input(value)

    @field_validator("as_of", "window_start")
    @classmethod
    def utc_timestamp(cls, value: datetime) -> datetime:
        return require_utc(value)

    @field_validator("rules_version")
    @classmethod
    def nonblank_version(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("rules_version must not be blank")
        return value

    @field_validator("findings", "limitations")
    @classmethod
    def nonblank_text(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if any(not text.strip() for text in value):
            raise ValueError("Findings and limitations must not contain blank text")
        return value

    @model_validator(mode="after")
    def check_context(self):
        if self.scope == "individual" and not (self.astronaut_id and self.astronaut_id.strip()):
            raise ValueError("Individual alert requires astronaut_id")
        if self.scope == "crew" and self.astronaut_id is not None:
            raise ValueError("Crew alert requires astronaut_id=null")
        if self.window_start > self.as_of:
            raise ValueError("window_start must be before or equal to as_of")
        if self.evidence_ids != tuple(sorted(set(self.evidence_ids))) or any(id <= 0 for id in self.evidence_ids):
            raise ValueError("Evidence IDs must be positive, unique and sorted")
        if (self.evaluated_astronaut_ids != tuple(sorted(set(self.evaluated_astronaut_ids)))
                or any(not id.strip() for id in self.evaluated_astronaut_ids)):
            raise ValueError("Evaluated astronaut IDs must be nonblank, unique and sorted")
        if self.scope == "individual" and any(id != self.astronaut_id for id in self.evaluated_astronaut_ids):
            raise ValueError("Individual coverage must refer only to the alert subject")
        return self


class AlertPresentation(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    context: AlertContext
    style: AlertStyle
    explanation: str
    evaluated_profile_count: int
    update_message: str | None
    disclaimer: str = "Experimental preventive investigation; not a diagnosis or a statement of safety."
    demo_only: Literal[True] = True


def alert_legend() -> tuple[AlertStyle, ...]:
    """Four text/icon/color entries; red is explicitly reserved to the legend."""
    return tuple(_STYLES[status] for status in ("normal", "attention", "insufficient_data", "critical"))


def present_alert(context: AlertContext) -> AlertPresentation:
    """Render the supplied status without inventing thresholds or rerunning rules."""
    return AlertPresentation(
        context=context, style=_STYLES[context.status], explanation=" ".join(context.findings),
        evaluated_profile_count=len(context.evaluated_astronaut_ids),
        update_message=("New measurements available — update the investigation"
                        if context.has_unanalyzed_measurements else None),
    )


def present_individual_alert(
    result: IndividualDetection, *, has_unanalyzed_measurements: bool = False,
) -> AlertPresentation:
    """Bridge AKM-21 evidence to its display description without changing status."""
    return present_alert(AlertContext(
        status=result.status, scope="individual", astronaut_id=result.astronaut_id,
        rules_version=result.rules_version, as_of=result.as_of, window_start=result.window_start,
        findings=result.findings, limitations=result.limitations,
        evaluated_astronaut_ids=(result.astronaut_id,) if result.status != "insufficient_data" else (),
        evidence_ids=tuple(sorted(row.measurement_id for row in result.evidence)),
        has_unanalyzed_measurements=has_unanalyzed_measurements,
    ))
