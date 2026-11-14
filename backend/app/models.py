"""SQLModel tables for the local mission database."""

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Index, Text, UniqueConstraint
from sqlalchemy.types import TypeDecorator
from sqlmodel import Field, SQLModel

from .schemas import (
    DataSource,
    InvestigationStatus,
    Kind,
    MeasurementCreate,
    MeasurementZone,
    MetricUnit,
    Quality,
    require_utc,
)


class UTCText(TypeDecorator):
    """Store sortable, fixed-width UTC timestamps and read aware datetimes."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return require_utc(value).isoformat(timespec="microseconds").replace("+00:00", "Z")

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return require_utc(datetime.fromisoformat(value))


class Astronaut(SQLModel, table=True):
    __tablename__ = "astronauts"
    __table_args__ = (CheckConstraint("baseline_sleep_hours > 0", name="ck_astronaut_baseline"),)

    id: str = Field(primary_key=True, sa_type=Text)
    name: str = Field(sa_type=Text)
    role: str | None = Field(default=None, sa_type=Text)
    baseline_sleep_hours: float


class Measurement(SQLModel, table=True):
    __tablename__ = "measurements"
    __table_args__ = (
        Index("ix_measurements_subject_kind_time", "astronaut_id", "kind", "measured_at"),
        CheckConstraint(
            "(measurement_zone = 'astronaut' AND astronaut_id IS NOT NULL) OR "
            "(measurement_zone = 'habitat' AND astronaut_id IS NULL)",
            name="ck_measurement_zone_subject",
        ),
        CheckConstraint("source IN ('manual', 'synthetic')", name="ck_measurement_source"),
        CheckConstraint("quality IN ('ok', 'suspect')", name="ck_measurement_quality"),
    )

    id: int | None = Field(default=None, primary_key=True)
    astronaut_id: str | None = Field(default=None, foreign_key="astronauts.id", sa_type=Text)
    kind: Kind = Field(sa_type=Text)
    value: float
    unit: MetricUnit = Field(sa_type=Text)
    measurement_zone: MeasurementZone = Field(sa_type=Text)
    measured_at: datetime = Field(sa_type=UTCText)
    recorded_at: datetime = Field(sa_type=UTCText)
    source: DataSource = Field(sa_type=Text)
    quality: Quality = Field(default="ok", sa_type=Text)

    @classmethod
    def from_payload(
        cls, payload: MeasurementCreate, *, recorded_at: datetime | None = None
    ) -> "Measurement":
        return cls(
            astronaut_id=payload.astronaut_id,
            kind=payload.kind,
            value=payload.value,
            unit=payload.unit,
            measured_at=payload.measured_at,
            source=payload.source,
            quality=payload.quality,
            measurement_zone=payload.zone(),
            recorded_at=recorded_at if recorded_at is not None else datetime.now(timezone.utc),
        )


class Investigation(SQLModel, table=True):
    __tablename__ = "investigations"
    __table_args__ = (
        UniqueConstraint("input_fingerprint", name="uq_investigation_fingerprint"),
        CheckConstraint(
            "(scope = 'crew' AND astronaut_id IS NULL) OR "
            "(scope = 'individual' AND astronaut_id IS NOT NULL)",
            name="ck_investigation_scope_subject",
        ),
        CheckConstraint(
            "status IN ('normal', 'attention', 'critical', 'insufficient_data')",
            name="ck_investigation_status",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    scope: str = Field(sa_type=Text)
    astronaut_id: str | None = Field(default=None, foreign_key="astronauts.id", sa_type=Text)
    status: InvestigationStatus = Field(sa_type=Text)
    created_at: datetime = Field(sa_type=UTCText)
    rules_version: str = Field(sa_type=Text)
    input_fingerprint: str = Field(sa_type=Text)
    result_json: str = Field(sa_type=Text)


class Followup(SQLModel, table=True):
    __tablename__ = "followups"
    __table_args__ = (
        CheckConstraint(
            "(status = 'pending' AND measurement_id IS NULL AND completed_at IS NULL) OR "
            "(status = 'completed' AND measurement_id IS NOT NULL AND completed_at IS NOT NULL)",
            name="ck_followup_completion",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    investigation_id: int = Field(foreign_key="investigations.id")
    astronaut_id: str | None = Field(default=None, foreign_key="astronauts.id", sa_type=Text)
    kind: Kind = Field(sa_type=Text)
    reason: str = Field(sa_type=Text)
    status: str = Field(default="pending", sa_type=Text)
    due_at: datetime | None = Field(default=None, sa_type=UTCText)
    created_at: datetime = Field(sa_type=UTCText)
    completed_at: datetime | None = Field(default=None, sa_type=UTCText)
    measurement_id: int | None = Field(default=None, foreign_key="measurements.id")
