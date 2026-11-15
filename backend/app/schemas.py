"""AKM Health API contracts (AKM-03). Data persistence belongs to AKM-17/20."""
from datetime import date as date_type, datetime, timedelta, timezone
from enum import Enum
import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from uuid import UUID


class Kind(str, Enum):
    sleep_hours = "sleep_hours"
    heart_rate_bpm = "heart_rate_bpm"
    mood_score = "mood_score"
    co2_ppm = "co2_ppm"
    cabin_temp_c = "cabin_temp_c"


MetricUnit = Literal["h", "bpm", "score_1_to_5", "ppm", "C"]
MeasurementZone = Literal["astronaut", "habitat"]
DataSource = Literal["manual", "synthetic"]
Quality = Literal["ok", "suspect"]
InvestigationStatus = Literal["normal", "attention", "critical", "insufficient_data"]

MEASUREMENT_TIMESTAMP = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt][0-9]{2}:[0-9]{2}"
    r"(?::[0-9]{2}(?:\.[0-9]+)?)?(?:[Zz]|[+-][0-9]{2}:[0-9]{2})"
)

METRICS: dict[Kind, tuple[str, str]] = {
    Kind.sleep_hours: ("h", "astronaut"),
    Kind.heart_rate_bpm: ("bpm", "astronaut"),
    Kind.mood_score: ("score_1_to_5", "astronaut"),
    Kind.co2_ppm: ("ppm", "habitat"),
    Kind.cabin_temp_c: ("C", "habitat"),
}


def require_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timestamp requires an explicit timezone")
    try:
        return value.astimezone(timezone.utc)
    except OverflowError as exc:
        raise ValueError("Timestamp is outside the supported UTC range") from exc


FUTURE_TOLERANCE = timedelta(minutes=10)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MeasurementCreate(StrictModel):
    astronaut_id: str | None = None
    kind: Kind
    value: float = Field(strict=True, allow_inf_nan=False)
    unit: MetricUnit
    measured_at: datetime
    source: DataSource
    quality: Quality = "ok"

    @field_validator("measured_at", mode="before")
    @classmethod
    def check_timestamp_input(cls, value: object) -> object:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str) and MEASUREMENT_TIMESTAMP.fullmatch(value):
            return value
        raise ValueError("Measurement timestamp must be an ISO 8601 date and time with an explicit timezone")

    @field_validator("measured_at")
    @classmethod
    def check_timestamp(cls, value: datetime) -> datetime:
        return require_utc(value)

    @field_serializer("measured_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return value.isoformat().replace("+00:00", "Z")

    @model_validator(mode="after")
    def check_metric(self):
        expected_unit, zone = METRICS[self.kind]
        if self.unit != expected_unit:
            raise ValueError(f"{self.kind.value} must use unit {expected_unit}")
        if zone == "astronaut" and not (self.astronaut_id and self.astronaut_id.strip()):
            raise ValueError("Individual measurement requires astronaut_id")
        if zone == "habitat" and self.astronaut_id is not None:
            raise ValueError("Habitat measurement must have astronaut_id=null")
        if self.kind == Kind.sleep_hours and not 0 <= self.value <= 24:
            raise ValueError("sleep_hours must be between 0 and 24")
        if self.kind == Kind.heart_rate_bpm and not 20 <= self.value <= 250:
            raise ValueError("heart_rate_bpm must be between 20 and 250")
        if self.kind == Kind.mood_score and self.value not in (1, 2, 3, 4, 5):
            raise ValueError("mood_score must be an integer 1..5")
        if self.kind == Kind.co2_ppm and not 0 <= self.value <= 40000:
            raise ValueError("co2_ppm must be between 0 and 40000")
        if self.kind == Kind.cabin_temp_c and not -20 <= self.value <= 60:
            raise ValueError("cabin_temp_c must be between -20 and 60")
        return self

    def zone(self) -> MeasurementZone:
        return METRICS[self.kind][1]  # type: ignore[return-value]

    def ensure_not_in_future(self, now: datetime | None = None) -> None:
        """New observations cannot be dated after now, allowing a few minutes of clock drift."""
        limit = (now or datetime.now(timezone.utc)) + FUTURE_TOLERANCE
        if self.measured_at > limit:
            raise ValueError("measured_at cannot be in the future")


class MeasurementRead(MeasurementCreate):
    id: int = Field(gt=0)
    measurement_zone: MeasurementZone
    recorded_at: datetime

    @field_validator("recorded_at")
    @classmethod
    def check_recorded_at(cls, value: datetime) -> datetime:
        return require_utc(value)

    @model_validator(mode="after")
    def check_zone(self):
        if self.measurement_zone != self.zone():
            raise ValueError("measurement_zone conflicts with kind")
        return self


class AstronautRead(StrictModel):
    id: str
    name: str
    role: str | None = None
    baseline_sleep_hours: float = Field(gt=0, allow_inf_nan=False)


class MeasurementHistoryQuery(StrictModel):
    """Inclusive observation-time filters; keep the canonical JSON list response."""

    # FastAPI 0.115 passes aliased query values using the model field names.
    # Accept both representations internally. The route validates public query names separately.
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    astronaut_id: str | None = Field(default=None, min_length=1)
    kind: Kind | None = None
    from_timestamp: datetime | None = Field(default=None, alias="from")
    to_timestamp: datetime | None = Field(default=None, alias="to")
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0, le=2**63 - 1)

    @field_validator("from_timestamp", "to_timestamp", mode="before")
    @classmethod
    def check_timestamp_input(cls, value: object) -> object:
        if value is None:
            return value
        return MeasurementCreate.check_timestamp_input(value)

    @field_validator("from_timestamp", "to_timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime | None) -> datetime | None:
        return require_utc(value) if value is not None else None

    @model_validator(mode="after")
    def check_period(self):
        if (self.from_timestamp is not None and self.to_timestamp is not None
                and self.from_timestamp > self.to_timestamp):
            raise ValueError("from must be before or equal to to")
        return self


class InvestigationRunRequest(StrictModel):
    scope: Literal["crew", "individual"]
    astronaut_id: str | None = None

    @model_validator(mode="after")
    def check_scope(self):
        if self.scope == "individual" and not (self.astronaut_id and self.astronaut_id.strip()):
            raise ValueError("Individual scope requires astronaut_id")
        if self.scope == "crew" and self.astronaut_id is not None:
            raise ValueError("Crew scope requires astronaut_id=null")
        return self


class InvestigationEvidence(StrictModel):
    kind: Kind
    astronaut_ids: list[str] = Field(default_factory=list)
    quality: Quality


class InvestigationHypothesis(StrictModel):
    label: str
    certainty: Literal["unconfirmed"]
    explanation: str


class NextCheck(StrictModel):
    kind: Kind
    astronaut_id: str | None
    reason: str
    effort: Literal["low", "medium", "high"]


class EducationalGuidance(StrictModel):
    text: str
    source_id: str


class InvestigationReference(StrictModel):
    source_id: str
    title: str
    url: str
    relevance: str


class InvestigationCoverage(StrictModel):
    window_start: datetime
    window_end: datetime
    evaluated_astronaut_ids: list[str]

    @field_validator("window_start", "window_end")
    @classmethod
    def normalize_window(cls, value: datetime) -> datetime:
        return require_utc(value)


class InvestigationCheckContext(StrictModel):
    status: Literal["selected", "unavailable", "no_check_needed", "needs_context", "protocol_referral"]
    reason: str


class HumanReview(StrictModel):
    mode: Literal["conditional", "per_protocol"]
    instruction: str
    protocol_reference: str | None = None


class InvestigationExplanation(StrictModel):
    coverage: InvestigationCoverage | None = None
    limitations: list[str]
    uncertainty: str
    references: list[InvestigationReference]
    check_context: InvestigationCheckContext | None = None
    human_review: HumanReview


class InvestigationResult(StrictModel):
    id: int = Field(gt=0)
    scope: Literal["crew", "individual"]
    astronaut_id: str | None
    status: InvestigationStatus
    created_at: datetime
    rules_version: str
    input_fingerprint: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")
    reused: bool
    findings: list[str]
    evidence: list[InvestigationEvidence]
    hypotheses: list[InvestigationHypothesis]
    next_check: NextCheck | None
    followup_id: int | None = Field(default=None, gt=0)
    guidance: list[EducationalGuidance]
    explanation: InvestigationExplanation | None = None
    demo_only: Literal[True]

    @field_validator("created_at")
    @classmethod
    def check_created_at(cls, value: datetime) -> datetime:
        return require_utc(value)


class FollowupCompleteRequest(StrictModel):
    status: Literal["completed"]
    measurement_id: int = Field(gt=0, le=2**63 - 1, strict=True)


class FollowupRead(StrictModel):
    id: int = Field(gt=0)
    investigation_id: int = Field(gt=0)
    astronaut_id: str | None
    kind: Kind
    reason: str
    status: Literal["pending", "completed"]
    due_at: datetime | None
    created_at: datetime
    completed_at: datetime | None
    measurement_id: int | None = Field(default=None, gt=0)

    @field_validator("due_at", "created_at", "completed_at")
    @classmethod
    def normalize_dates(cls, value: datetime | None) -> datetime | None:
        return require_utc(value) if value is not None else None

    @model_validator(mode="after")
    def check_completed(self):
        if self.status == "completed" and (self.completed_at is None or self.measurement_id is None):
            raise ValueError("Completed followup needs completed_at and measurement_id")
        if self.status == "pending" and (self.completed_at is not None or self.measurement_id is not None):
            raise ValueError("Pending followup must not have completion fields")
        return self


class MetricSnapshot(StrictModel):
    value: float = Field(allow_inf_nan=False)
    unit: MetricUnit
    measured_at: datetime
    source: DataSource | None = None

    @field_validator("measured_at")
    @classmethod
    def utc_timestamp(cls, value: datetime) -> datetime:
        return require_utc(value)

class AstronautDashboardRead(StrictModel):
    id: str
    name: str
    latest_metrics: dict[Kind, MetricSnapshot]
    status: InvestigationStatus


class HabitatSnapshot(StrictModel):
    co2_ppm: float | None = Field(allow_inf_nan=False)
    cabin_temp_c: float | None = Field(allow_inf_nan=False)
    measured_at: datetime | None
    measurement_zone: Literal["habitat"]
    latest_metrics: dict[Kind, MetricSnapshot] = Field(default_factory=dict)

    @field_validator("measured_at")
    @classmethod
    def utc_timestamp(cls, value: datetime | None) -> datetime | None:
        return require_utc(value) if value is not None else None

class DashboardAlert(StrictModel):
    id: int
    level: InvestigationStatus
    label: str
    explanation: str


class MissionContext(StrictModel):
    name: str
    day: int = Field(ge=0)
    destination: Literal["mars_surface"]
    gravity_g_reference: float = Field(gt=0)
    context_source_url: str
    demo_only: Literal[True]


class DashboardResponse(StrictModel):
    mission: MissionContext
    astronauts: list[AstronautDashboardRead]
    environment: HabitatSnapshot
    alerts: list[DashboardAlert]
    pending_followups: list[FollowupRead]
    last_investigation_at: datetime | None
    has_unanalyzed_measurements: bool

    @field_validator("last_investigation_at")
    @classmethod
    def utc_timestamp(cls, value: datetime | None) -> datetime | None:
        return require_utc(value) if value is not None else None

class ScientificReference(StrictModel):
    source: str
    title: str
    url: str
    type: Literal["research_reference"]


class NASAHistoricalObservation(StrictModel):
    """Preserve NASA source-native time; never invent Earth UTC for Mars sols."""
    source: str = Field(min_length=1)
    source_url: str = Field(min_length=10)
    mission_id: str = Field(min_length=1)
    parameter: str = Field(min_length=1)
    value: float = Field(allow_inf_nan=False)
    unit: str = Field(min_length=1)
    observed_at: str | None = None
    mars_sol: int | None = Field(default=None, ge=0)
    instrument: str | None = None
    context: str = Field(min_length=1)

    @field_validator("source_url")
    @classmethod
    def validate_https_source(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("Historical NASA observations require HTTPS source URL")
        return value

    @model_validator(mode="after")
    def require_observation_time(self):
        if not self.observed_at and self.mars_sol is None:
            raise ValueError("Historical observation requires source-native timestamp or mars_sol")
        return self

class NASARadiationDay(StrictModel):
    """One day of ISS cabin radiation during RR-1. Units are explicit per field; nothing is interpolated."""
    date: date_type
    gcr_mgy_per_day: float = Field(ge=0, allow_inf_nan=False)
    saa_mgy_per_day: float = Field(ge=0, allow_inf_nan=False)
    total_mgy_per_day: float = Field(ge=0, allow_inf_nan=False)
    accumulated_mgy: float = Field(ge=0, allow_inf_nan=False)  # cumulative dose in mGy, not mGy/day


class NASARadiationSeries(StrictModel):
    mission_id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    source_url: str = Field(min_length=10)
    context: str = Field(min_length=1)
    days: list[NASARadiationDay] = Field(min_length=1)

    @field_validator("source_url")
    @classmethod
    def validate_https_source(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("Historical NASA data require an HTTPS source URL")
        return value


class NASACo2Context(StrictModel):
    """Full-series ISS CO₂ statistics from RR-1: historical context, not a safety limit."""
    mission_id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    source_url: str = Field(min_length=10)
    context: str = Field(min_length=1)
    period_start: str
    period_end: str
    sample_count: int = Field(gt=0)
    mean_ppm: float = Field(ge=0, allow_inf_nan=False)
    median_ppm: float = Field(ge=0, allow_inf_nan=False)
    min_ppm: float = Field(ge=0, allow_inf_nan=False)
    max_ppm: float = Field(ge=0, allow_inf_nan=False)

    @field_validator("source_url")
    @classmethod
    def validate_https_source(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("Historical NASA data require an HTTPS source URL")
        return value

    @model_validator(mode="after")
    def check_order(self):
        if not self.min_ppm <= self.median_ppm <= self.max_ppm or not self.min_ppm <= self.mean_ppm <= self.max_ppm:
            raise ValueError("CO₂ statistics must satisfy min <= mean/median <= max")
        return self


class NASAReferenceResponse(StrictModel):
    scientific_references: list[ScientificReference]
    historical_series: list[NASAHistoricalObservation]
    historical_data_status: Literal["not_imported", "imported"]
    # Added after the first contract: defaults keep earlier clients and fixtures valid.
    radiation: NASARadiationSeries | None = None
    radiation_status: Literal["not_imported", "imported"] = "not_imported"
    co2_context: NASACo2Context | None = None
    co2_context_status: Literal["not_imported", "imported"] = "not_imported"

    @model_validator(mode="after")
    def check_history_status(self):
        if self.historical_data_status == "not_imported" and self.historical_series:
            raise ValueError("Cannot label existing NASA series not_imported")
        if self.historical_data_status == "imported" and not self.historical_series:
            raise ValueError("Imported status requires verified observations")
        for status, value, name in ((self.radiation_status, self.radiation, "radiation"),
                                    (self.co2_context_status, self.co2_context, "co2_context")):
            if (status == "imported") != (value is not None):
                raise ValueError(f"{name} status must match whether verified values are present")
        return self


# AKM-33: transport envelope is independent of the canonical measurement payload.

class SyncMeasurementRequest(StrictModel):
    operation_id: UUID
    measurement: MeasurementCreate

class SyncMeasurementReceipt(StrictModel):
    operation_id: UUID
    measurement: MeasurementRead
    reused: bool
