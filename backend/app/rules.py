"""Pure, deterministic individual sleep detection for the synthetic demo (AKM-21)."""

from datetime import date, datetime, timedelta
from decimal import Context, Decimal, localcontext
from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from .schemas import InvestigationHypothesis, MeasurementCreate, MeasurementRead, StrictModel, require_utc


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


class CrewMember(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(min_length=1)
    baseline_sleep_hours: float | None = Field(default=None, allow_inf_nan=False)

    @field_validator("id")
    @classmethod
    def nonblank_id(cls, value: str) -> str:
        return IndividualSnapshot.nonblank_subject(value)


class CrewSnapshot(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    astronauts: tuple[CrewMember, ...] = ()
    measurements: tuple[MeasurementRead, ...] = ()
    as_of: datetime

    @field_validator("as_of", mode="before")
    @classmethod
    def explicit_reference(cls, value: object) -> object:
        return MeasurementCreate.check_timestamp_input(value)

    @field_validator("as_of")
    @classmethod
    def utc_reference(cls, value: datetime) -> datetime:
        return require_utc(value)

    @model_validator(mode="after")
    def ordered_snapshot(self):
        ids = [member.id for member in self.astronauts]
        if ids != sorted(set(ids)):
            raise ValueError("Crew members must be unique and ordered by id")
        keys = [(row.measured_at, row.id) for row in self.measurements]
        if keys != sorted(keys) or len({row.id for row in self.measurements}) != len(keys):
            raise ValueError("Measurements must have unique IDs and be ordered by (measured_at, id)")
        return self


class CollectiveRuleConfig(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    individual: IndividualRuleConfig = IndividualRuleConfig()
    environment_tolerance: timedelta = Field(default=timedelta(hours=12), ge=timedelta(0))


class HabitatEvidence(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    measurement_id: int
    kind: Literal["co2_ppm", "cabin_temp_c"]
    value: float
    unit: Literal["ppm", "C"]
    measured_at: datetime
    source: Literal["manual", "synthetic"]


class EnvironmentalComparison(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    kind: Literal["co2_ppm", "cabin_temp_c"]
    baseline: HabitatEvidence | None
    aligned_readings: tuple[HabitatEvidence, ...]
    consistent_shift: bool
    explanation: str


class CollectiveHypothesis(InvestigationHypothesis):
    model_config = ConfigDict(extra="forbid", frozen=True)


class CollectiveDetection(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: Literal["normal", "attention", "insufficient_data"]
    rules_version: str
    as_of: datetime
    window_start: datetime
    environment_tolerance: timedelta
    individual_results: tuple[IndividualDetection, ...]
    sufficient_astronaut_ids: tuple[str, ...]
    comparable_astronaut_ids: tuple[str, ...]
    affected_astronaut_ids: tuple[str, ...]
    periods: tuple[date, ...]
    environment: tuple[EnvironmentalComparison, ...]
    hypotheses: tuple[CollectiveHypothesis, ...]
    findings: tuple[str, ...]
    limitations: tuple[str, ...]
    demo_only: Literal[True] = True


def _habitat_evidence(row: MeasurementRead) -> HabitatEvidence:
    return HabitatEvidence(
        measurement_id=row.id, kind=row.kind, value=row.value, unit=row.unit,
        measured_at=row.measured_at, source=row.source,
    )


def _compare_environment(
    kind: Literal["co2_ppm", "cabin_temp_c"],
    snapshot: CrewSnapshot,
    cohort: tuple[IndividualDetection, ...],
    window_start: datetime,
    tolerance: timedelta,
) -> EnvironmentalComparison:
    # Collapse repeated sensor timestamps before using them as distinct evidence.
    by_time = {
        row.measured_at: row for row in snapshot.measurements
        if row.astronaut_id is None and row.kind == kind and row.quality == "ok"
        and window_start <= row.measured_at <= snapshot.as_of and row.recorded_at <= snapshot.as_of
    }
    available = list(by_time.values())
    matched: list[MeasurementRead] = []
    if cohort:
        candidates_by_period = []
        for index in range(2):
            references = [result.evidence[index].measured_at for result in cohort]
            candidates_by_period.append([
                row for row in available
                if all(abs(row.measured_at - reference) <= tolerance for reference in references)
            ])
        first_candidates, second_candidates = candidates_by_period
        second = max(second_candidates, key=lambda row: (row.measured_at, row.id), default=None)
        first = max(
            (row for row in first_candidates if second is None or row.measured_at < second.measured_at),
            key=lambda row: (row.measured_at, row.id), default=None,
        )
        if first is not None:
            matched = [first] + ([second] if second is not None else [])
    baseline_candidates = [row for row in available if matched and row.measured_at < matched[0].measured_at]
    baseline = max(baseline_candidates, key=lambda row: (row.measured_at, row.id), default=None)
    shifted = bool(baseline is not None and len(matched) == 2 and (
        all(row.value > baseline.value for row in matched)
        or all(row.value < baseline.value for row in matched)
    ))
    if not cohort:
        explanation = "Sem dois perfis com períodos de sono comparáveis para relacionar o ambiente."
    elif len(matched) != 2:
        explanation = "Faltam leituras ambientais utilizáveis em ambos os períodos comparáveis."
    elif baseline is None:
        explanation = "Não há leitura ambiental anterior para servir de referência na janela."
    elif shifted:
        explanation = "Duas leituras comparáveis variam na mesma direção frente à referência; coincidência não estabelece causalidade."
    else:
        explanation = "As leituras não sustentam uma mudança consistente frente à referência."
    return EnvironmentalComparison(
        kind=kind, baseline=_habitat_evidence(baseline) if baseline is not None else None,
        aligned_readings=tuple(_habitat_evidence(row) for row in matched),
        consistent_shift=shifted, explanation=explanation,
    )


def detect_collective_patterns(
    snapshot: CrewSnapshot,
    rules_version: str,
    config: CollectiveRuleConfig = CollectiveRuleConfig(),
) -> CollectiveDetection:
    """Apply DR-02/03/04 to the most recent comparable two-period crew cohort."""
    if not isinstance(rules_version, str) or not rules_version.strip():
        raise ValueError("rules_version must not be blank")
    try:
        window_start = snapshot.as_of - config.individual.window
    except OverflowError as exc:
        raise ValueError("Window starts outside the supported datetime range") from exc
    results = tuple(
        detect_individual_changes(IndividualSnapshot(
            astronaut_id=member.id, baseline_sleep_hours=member.baseline_sleep_hours,
            as_of=snapshot.as_of, measurements=snapshot.measurements,
        ), rules_version, config.individual)
        for member in snapshot.astronauts
    )
    sufficient = tuple(result for result in results if result.status != "insufficient_data")
    cohorts: dict[tuple[date, ...], list[IndividualDetection]] = {}
    for result in sufficient:
        cohorts.setdefault(tuple(row.period for row in result.evidence), []).append(result)
    comparable_periods = [periods for periods, members in cohorts.items() if len(members) >= 2]
    periods = max(comparable_periods, key=lambda pair: (pair[1], pair[0]), default=())
    cohort = tuple(cohorts.get(periods, ()))
    affected = tuple(result.astronaut_id for result in cohort if result.status == "attention")
    if not cohort:
        status = "insufficient_data"
        findings = ("São necessários pelo menos dois perfis com sono suficiente nos mesmos dois períodos UTC.",)
    elif len(affected) >= 2:
        status = "attention"
        findings = (f"Padrão experimental de sono compartilhado por {len(affected)} astronautas: {', '.join(affected)}.",)
    else:
        status = "normal"
        findings = ("Sem padrão coletivo pela regra da demo; alterações individuais permanecem nos resultados de cada perfil.",)
    environment = tuple(
        _compare_environment(kind, snapshot, cohort, window_start, config.environment_tolerance)
        for kind in ("co2_ppm", "cabin_temp_c")
    )
    hypotheses: list[CollectiveHypothesis] = []
    if status == "attention":
        if environment[0].consistent_shift:
            hypotheses.append(CollectiveHypothesis(
                label="Coincidência temporal com mudança de CO₂ interno", certainty="unconfirmed",
                explanation="O padrão de sono e as leituras de CO₂ são temporalmente comparáveis; os dados não demonstram causalidade.",
            ))
        hypotheses.append(CollectiveHypothesis(
            label="Explicações alternativas ainda não verificadas", certainty="unconfirmed",
            explanation="Rotina compartilhada, fatores individuais e condições da coleta também podem contribuir; os dados disponíveis não distinguem essas possibilidades.",
        ))
    return CollectiveDetection(
        status=status, rules_version=rules_version, as_of=snapshot.as_of, window_start=window_start,
        environment_tolerance=config.environment_tolerance, individual_results=results,
        sufficient_astronaut_ids=tuple(result.astronaut_id for result in sufficient),
        comparable_astronaut_ids=tuple(result.astronaut_id for result in cohort),
        affected_astronaut_ids=affected, periods=periods, environment=environment,
        hypotheses=tuple(hypotheses), findings=findings,
        limitations=(
            "Regra experimental com tripulação fictícia; não é avaliação clínica nem diagnóstico.",
            "Datas UTC aproximam os períodos de sono. Só o par comparável mais recente é avaliado coletivamente.",
            "Coincidência ambiental não demonstra causalidade; temperatura permanece contexto descritivo.",
            "Qualidade suspeita, ausência de referência ou incompatibilidade temporal limitam a evidência ambiental sem apagar achados de sono.",
        ),
    )
