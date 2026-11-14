"""Pure, deterministic individual sleep detection for the synthetic demo (AKM-21)."""

from datetime import date, datetime, timedelta
from decimal import Context, Decimal, localcontext
from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from .schemas import MeasurementCreate, MeasurementRead, StrictModel, require_utc


class IndividualSnapshot(StrictModel):
    """Caller supplies a UTC reference time and history ordered by (measured_at, id)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    astronaut_id: str = Field(min_length=1)
    baseline_sleep_hours: float | None = Field(default=None, allow_inf_nan=False)
    as_of: datetime
    measurements: tuple[MeasurementRead, ...] = ()

    @field_validator("astronaut_id")
    @classmethod
    def nonblank_subject(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("astronaut_id must not be blank")
        return value

    @field_validator("as_of")
    @classmethod
    def utc_reference(cls, value: datetime) -> datetime:
        return require_utc(value)

    @field_validator("as_of", mode="before")
    @classmethod
    def explicit_reference_timestamp(cls, value: object) -> object:
        return MeasurementCreate.check_timestamp_input(value)

    @model_validator(mode="after")
    def ordered_unique_history(self):
        keys = [(row.measured_at, row.id) for row in self.measurements]
        if keys != sorted(keys):
            raise ValueError("Snapshot must be ordered by (measured_at, id)")
        if len({row.id for row in self.measurements}) != len(self.measurements):
            raise ValueError("Snapshot measurement IDs must be unique")
        return self


class IndividualRuleConfig(StrictModel):
    """Software-demo parameters, never clinical thresholds."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    window: timedelta = Field(default=timedelta(hours=48), gt=timedelta(0))
    sleep_ratio: float = Field(default=0.8, gt=0, le=1, allow_inf_nan=False)


class SleepEvidence(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    measurement_id: int
    period: date
    measured_at: datetime
    value: float
    unit: Literal["h"] = "h"
    quality: Literal["ok"] = "ok"


class IndividualDetection(StrictModel):
    """Internal detector output; persistence/API composition belong to later tasks."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    astronaut_id: str
    status: Literal["normal", "attention", "insufficient_data"]
    rules_version: str
    rule_id: Literal["DR-01"] = "DR-01"
    as_of: datetime
    window_start: datetime
    sleep_ratio: float
    baseline_sleep_hours: float | None
    threshold_sleep_hours: float | None
    evidence: tuple[SleepEvidence, ...]
    excluded_suspect_ids: tuple[int, ...]
    findings: tuple[str, ...]
    limitations: tuple[str, ...]
    demo_only: Literal[True] = True


def detect_individual_changes(
    snapshot: IndividualSnapshot,
    rules_version: str,
    config: IndividualRuleConfig = IndividualRuleConfig(),
) -> IndividualDetection:
    """Apply DR-01/04 to the latest two usable, distinct UTC sleep dates.

    The existing measurement contract has no sleep-period identifier. For this
    demo, a UTC calendar date is the documented period proxy. Same-date entries
    never count as two periods; the latest usable (measured_at, id) wins.
    """
    if not isinstance(rules_version, str) or not rules_version.strip():
        raise ValueError("rules_version must not be blank")
    try:
        window_start = snapshot.as_of - config.window
    except OverflowError as exc:
        raise ValueError("Window starts outside the supported datetime range") from exc

    by_period: dict[date, MeasurementRead] = {}
    suspect_ids: list[int] = []
    for row in snapshot.measurements:
        if row.astronaut_id != snapshot.astronaut_id or row.kind != "sleep_hours":
            continue
        if not window_start <= row.measured_at <= snapshot.as_of:
            continue
        if row.recorded_at > snapshot.as_of:
            continue
        if row.quality == "suspect":
            suspect_ids.append(row.id)
            continue
        by_period[row.measured_at.date()] = row

    selected = sorted(by_period.values(), key=lambda row: (row.measured_at, row.id))[-2:]
    evidence = tuple(
        SleepEvidence(
            measurement_id=row.id, period=row.measured_at.date(),
            measured_at=row.measured_at, value=row.value,
        )
        for row in selected
    )
    limitations = [
        "Regra experimental de software com dados fictícios; não é avaliação clínica.",
        "Período de sono aproximado pela data UTC; o resultado depende da janela e dos dados usados.",
        "Este detector individual não avalia padrões coletivos nem causalidade ambiental.",
    ]
    if suspect_ids:
        limitations.append("Leituras suspeitas foram excluídas da evidência.")

    baseline = snapshot.baseline_sleep_hours
    # Two finite float representations need at most 34 significant digits in
    # their product. Isolate arithmetic from a caller's decimal context.
    with localcontext(Context(prec=50)):
        threshold = (
            Decimal(str(baseline)) * Decimal(str(config.sleep_ratio))
            if baseline is not None and baseline > 0 else None
        )
    if threshold is None:
        status = "insufficient_data"
        findings = ("É necessária uma baseline sintética de sono positiva para avaliar a regra.",)
    elif len(evidence) < 2:
        status = "insufficient_data"
        findings = (
            f"Há {len(evidence)} período(s) de sono utilizável(is) na janela; são necessários dois períodos distintos.",
        )
    elif all(Decimal(str(row.value)) <= threshold for row in evidence):
        status = "attention"
        findings = (
            f"As duas observações de sono são menores ou iguais a {config.sleep_ratio * 100:g}% "
            "da baseline sintética: padrão experimental a verificar.",
        )
    else:
        status = "normal"
        findings = ("Há dados suficientes, sem padrão pela regra individual de sono da demo.",)

    return IndividualDetection(
        astronaut_id=snapshot.astronaut_id, status=status, rules_version=rules_version,
        as_of=snapshot.as_of, window_start=window_start, sleep_ratio=config.sleep_ratio,
        baseline_sleep_hours=baseline, threshold_sleep_hours=float(threshold) if threshold is not None else None,
        evidence=evidence, excluded_suspect_ids=tuple(suspect_ids),
        findings=findings, limitations=tuple(limitations),
    )
