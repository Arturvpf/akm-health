"""Pure planning of explicitly configured demonstration collection windows."""

from datetime import datetime, timedelta
from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from .next_check import CheckResource, CheckTarget, ValidatedProtocol
from .rules import CrewSnapshot, IndividualSnapshot
from .schemas import MeasurementCreate, StrictModel, require_utc


class RoutineCheck(CheckTarget):
    every: timedelta = Field(gt=timedelta(0))
    anchor_at: datetime
    reason: str = Field(min_length=1)
    reference: str = Field(min_length=1)

    @field_validator("anchor_at", mode="before")
    @classmethod
    def explicit_timestamp(cls, value):
        return MeasurementCreate.check_timestamp_input(value)

    @field_validator("anchor_at")
    @classmethod
    def utc_timestamp(cls, value):
        return require_utc(value)

    @field_validator("reason", "reference")
    @classmethod
    def nonblank_text(cls, value):
        if not value.strip():
            raise ValueError("Routine reason and reference must not be blank")
        return value


class RoutinePolicy(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    policy_version: Literal["demo-routine-v1"] = "demo-routine-v1"
    checks: tuple[RoutineCheck, ...] = ()

    @model_validator(mode="after")
    def unique_targets(self):
        keys = [(check.kind, check.astronaut_id) for check in self.checks]
        if len(keys) != len(set(keys)):
            raise ValueError("Routine targets must be unique")
        return self


class RoutineItem(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    check: RoutineCheck
    window_start: datetime | None
    due_at: datetime | None
    status: Literal["needed", "satisfied", "unavailable", "outside_scope", "not_started", "protocol_deferred"]
    explanation: str
    measurement_id: int | None = None


class RoutinePlan(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    policy_version: Literal["demo-routine-v1"] = "demo-routine-v1"
    items: tuple[RoutineItem, ...]
    demo_only: Literal[True] = True


def current_window(check: RoutineCheck, as_of: datetime) -> tuple[datetime, datetime] | None:
    if as_of < check.anchor_at:
        return None
    index = (as_of - check.anchor_at) // check.every
    try:
        start = check.anchor_at + index * check.every
        return start, start + check.every
    except OverflowError as exc:
        raise ValueError("Routine window is outside supported datetime range") from exc


def plan_routine(
    snapshot: CrewSnapshot | IndividualSnapshot, policy: RoutinePolicy,
    resources: tuple[CheckResource, ...], protocol: ValidatedProtocol | None = None,
) -> RoutinePlan:
    """A window needs a check only when it lacks a usable, already recorded sample."""
    subjects = ({snapshot.astronaut_id} if isinstance(snapshot, IndividualSnapshot)
                else {member.id for member in snapshot.astronauts})
    catalog = {(resource.kind, resource.astronaut_id): resource.available for resource in resources}
    items = []
    for check in sorted(policy.checks, key=lambda item: (item.kind, item.astronaut_id or "")):
        window = current_window(check, snapshot.as_of)
        start, due_at = window if window else (None, None)
        base = dict(check=check, window_start=start, due_at=due_at)
        if check.astronaut_id is not None and check.astronaut_id not in subjects:
            items.append(RoutineItem(**base, status="outside_scope", explanation="Alvo fora do escopo conhecido."))
        elif window is None:
            items.append(RoutineItem(**base, status="not_started", explanation="A janela configurada ainda não começou."))
        elif protocol is not None:
            items.append(RoutineItem(**base, status="protocol_deferred",
                explanation="A rotina aguarda o encaminhamento prioritário do protocolo informado."))
        else:
            usable = [sample for sample in snapshot.measurements
                      if sample.kind == check.kind and sample.astronaut_id == check.astronaut_id
                      and sample.quality == "ok" and start <= sample.measured_at < due_at
                      and sample.measured_at <= snapshot.as_of and sample.recorded_at <= snapshot.as_of]
            if usable:
                sample = max(usable, key=lambda row: (row.measured_at, row.id))
                items.append(RoutineItem(**base, status="satisfied", measurement_id=sample.id,
                    explanation="Já existe medição utilizável nesta janela de demonstração."))
            elif not catalog.get((check.kind, check.astronaut_id), False):
                items.append(RoutineItem(**base, status="unavailable",
                    explanation="Recurso não informado ou indisponível; não criar coleta inviável."))
            else:
                items.append(RoutineItem(**base, status="needed", explanation=check.reason))
    return RoutinePlan(items=tuple(items))
