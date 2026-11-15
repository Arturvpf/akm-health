"""AKM-23: pure and explainable selection of one feasible demo observation."""

from datetime import datetime
from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from .rules import (
    CollectiveRuleConfig, CrewSnapshot, IndividualDetection, IndividualSnapshot,
    detect_collective_patterns, detect_individual_changes,
)
from .schemas import Kind, METRICS, NextCheck, StrictModel


Effort = Literal["low", "medium", "high"]


class CheckTarget(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    kind: Kind
    astronaut_id: str | None = None

    @model_validator(mode="after")
    def valid_zone(self):
        if METRICS[self.kind][1] == "habitat":
            if self.astronaut_id is not None:
                raise ValueError("Habitat check requires astronaut_id=null")
        elif not (self.astronaut_id and self.astronaut_id.strip()):
            raise ValueError("Individual check requires astronaut_id")
        return self


class CheckResource(CheckTarget):
    available: bool
    effort: Effort


class ValidatedProtocol(StrictModel):
    """Caller-declared external protocol; this module cannot validate medicine."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    reference: str = Field(min_length=1)
    validated: Literal[True]
    action: Literal["human_review", "measurement"]
    permitted_checks: tuple[CheckTarget, ...] = ()

    @field_validator("validated", mode="before")
    @classmethod
    def explicit_validation(cls, value: object) -> object:
        if value is not True:
            raise ValueError("Protocol validation must be explicitly true")
        return value

    @field_validator("reference")
    @classmethod
    def nonblank_reference(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Protocol reference must not be blank")
        return value

    @model_validator(mode="after")
    def valid_action(self):
        if self.action == "human_review" and self.permitted_checks:
            raise ValueError("Human referral must not require a measurement first")
        if self.action == "measurement" and not self.permitted_checks:
            raise ValueError("Measurement protocol requires an ordered list of permitted checks")
        keys = [(target.kind, target.astronaut_id) for target in self.permitted_checks]
        if len(keys) != len(set(keys)):
            raise ValueError("Protocol checks must be unique")
        return self


class CandidateScore(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    target: CheckTarget
    informational_value: int = Field(ge=0, le=100)
    quality_need: int = Field(ge=0, le=100)
    availability_score: Literal[0, 100]
    effort: Effort | None
    effort_penalty: int
    score: int
    reason: str
    availability_reason: str | None
    protocol_rank: int | None = None


class SelectedCheck(NextCheck):
    model_config = ConfigDict(extra="forbid", frozen=True)


class NextCheckSelection(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: Literal["selected", "unavailable", "no_check_needed", "needs_context", "protocol_referral"]
    scope: Literal["individual", "crew"]
    astronaut_id: str | None
    as_of: datetime
    rules_version: str
    policy_version: Literal["demo-priority-v1"] = "demo-priority-v1"
    detection_status: Literal["normal", "attention", "insufficient_data"] | None
    next_check: SelectedCheck | None
    candidates: tuple[CandidateScore, ...]
    used_alternative: bool
    protocol_reference: str | None
    reason: str
    limitations: tuple[str, ...]
    demo_only: Literal[True] = True


def _key(target: CheckTarget) -> tuple[Kind, str | None]:
    return target.kind, target.astronaut_id


def _sleep_gap(result: IndividualDetection) -> tuple[int, int, str] | None:
    if result.baseline_sleep_hours is None or result.baseline_sleep_hours <= 0:
        return None
    if result.status == "insufficient_data":
        return (
            100 if len(result.evidence) == 1 else 80, 100,
            "Registrar sono em um período distinto para reduzir a lacuna de evidência do perfil; "
            "uma repetição do mesmo período não completa a cobertura.",
        )
    if result.status == "attention":
        return 80, 40 if result.excluded_suspect_ids else 20, (
            "Repetir o registro de sono e conferir horário/rotina de coleta para acompanhar o padrão individual experimental."
        )
    return None


def prioritize_next_check(
    snapshot: IndividualSnapshot | CrewSnapshot,
    rules_version: str,
    resources: tuple[CheckResource, ...],
    config: CollectiveRuleConfig = CollectiveRuleConfig(),
    protocol: ValidatedProtocol | None = None,
) -> NextCheckSelection:
    """Rank relevant observations; absence from resources means unavailable.

    The four-field next_check matches the canonical schema. All scoring and
    fallback diagnostics stay in this internal result, outside HTTP composition.
    """
    if not isinstance(rules_version, str) or not rules_version.strip():
        raise ValueError("rules_version must not be blank")
    if isinstance(snapshot, IndividualSnapshot):
        scope, subject = "individual", snapshot.astronaut_id
        known_subjects = {subject}
    else:
        scope, subject = "crew", None
        known_subjects = {member.id for member in snapshot.astronauts}
    limitations = (
        "Pontuação demonstrativa de software, não probabilidade clínica nem prescrição.",
        "Disponibilidade e esforço são informados pelo chamador; recurso não informado não é considerado viável.",
        "A seleção não grava tarefas nem executa medições. Hipóteses permanecem não confirmadas.",
    )
    base = dict(scope=scope, astronaut_id=subject, as_of=snapshot.as_of, rules_version=rules_version,
                protocol_reference=protocol.reference if protocol else None)
    if protocol is not None:
        for target in protocol.permitted_checks:
            if target.astronaut_id is not None and target.astronaut_id not in known_subjects:
                raise ValueError("Protocol target is outside the requested scope")
        if protocol.action == "human_review":
            return NextCheckSelection(
                **base, status="protocol_referral", detection_status=None, next_check=None,
                candidates=(), used_alternative=False,
                reason="Seguir o encaminhamento humano do protocolo validado informado, sem aguardar nova coleta.",
                limitations=limitations + ("A validação e a aplicação do protocolo pertencem à equipe responsável.",),
            )

    catalog = {_key(resource): resource for resource in resources}
    if len(catalog) != len(resources):
        raise ValueError("Resource targets must be unique")

    if isinstance(snapshot, IndividualSnapshot):
        detection = detect_individual_changes(snapshot, rules_version, config.individual)
        individual_results = (detection,)
    else:
        detection = detect_collective_patterns(snapshot, rules_version, config)
        individual_results = detection.individual_results

    proposals: list[tuple[CheckTarget, int, int, str, int | None]] = []
    alignment_alternatives: set[str] = set()
    if protocol is not None:
        proposals = [
            (target, 100, 100, f"Checagem permitida pelo protocolo validado informado: {protocol.reference}.", rank)
            for rank, target in enumerate(protocol.permitted_checks)
        ]
    else:
        if isinstance(snapshot, CrewSnapshot) and detection.status == "attention":
            co2 = next(comparison for comparison in detection.environment if comparison.kind == "co2_ppm")
            missing = co2.baseline is None or len(co2.aligned_readings) < 2
            info, quality = (100, 50) if co2.consistent_shift else ((95, 100) if missing else (35, 10))
            proposals.append((CheckTarget(kind="co2_ppm"), info, quality,
                "Confirmar nova leitura de CO₂ interno e conferir horário/qualidade da coleta; "
                "a coincidência ambiental não demonstra causalidade.", None))
            proposals.append((CheckTarget(kind="cabin_temp_c"), 25, 20,
                "Obter contexto adicional da temperatura interna; não substitui a confirmação de CO₂.", None))
        has_alignment_pair = sum(result.status != "insufficient_data" for result in individual_results) >= 2
        for result in individual_results:
            gap = _sleep_gap(result)
            if scope == "crew" and detection.status == "insufficient_data" and result.status != "insufficient_data":
                gap = None
                if has_alignment_pair:
                    info = 90 if result.evidence[-1].period < snapshot.as_of.date() else 70
                    gap = (info, 80, "Registrar um novo período distinto de sono para alinhar a cobertura temporal coletiva.")
                    alignment_alternatives.add(result.astronaut_id)
            elif (gap is not None and scope == "crew"
                    and detection.status == "attention" and result.status == "insufficient_data"):
                gap = (50, 70, gap[2])
            if gap is not None:
                info, quality, reason = gap
                proposals.append((CheckTarget(kind="sleep_hours", astronaut_id=result.astronaut_id),
                                  info, quality, reason, None))

    scored = []
    for target, info, quality, reason, rank in proposals:
        resource = catalog.get(_key(target))
        effort = resource.effort if resource is not None else None
        penalty = {"low": 0, "medium": 20, "high": 40}.get(effort, 0)
        available = resource is not None and resource.available
        scored.append(CandidateScore(
            target=target, informational_value=info, quality_need=quality,
            availability_score=100 if available else 0, effort=effort, effort_penalty=penalty,
            score=3 * info + quality - penalty, reason=reason, protocol_rank=rank,
            availability_reason=None if available else (
                "Recurso não informado." if resource is None else "Recurso informado como indisponível."
            ),
        ))
    ranked = tuple(sorted(scored, key=lambda candidate: (
        candidate.protocol_rank if candidate.protocol_rank is not None else 0,
        # Keep alignment eligible after checks that fill an individual coverage gap.
        candidate.target.astronaut_id in alignment_alternatives,
        -candidate.score, candidate.effort_penalty, candidate.target.kind.value,
        candidate.target.astronaut_id or "",
    )))
    selected = next((candidate for candidate in ranked if candidate.availability_score == 100), None)
    if selected is None:
        if ranked:
            status = "unavailable"
            reason = "Não há checagem relevante disponível; conferir recursos ou solicitar revisão humana, sem inventar uma alternativa."
        elif detection.status == "normal":
            status = "no_check_needed"
            reason = "Sem checagem adicional pela regra da demo; as avaliações programadas continuam nas tarefas de rotina."
        else:
            status = "needs_context"
            reason = "Conferir perfis, baselines e cobertura temporal: não há alvo adequado para uma nova coleta informativa."
        return NextCheckSelection(
            **base, status=status, detection_status=detection.status, next_check=None,
            candidates=ranked, used_alternative=False, reason=reason,
            limitations=limitations + detection.limitations,
        )
    fallback = ranked.index(selected) > 0
    reason = selected.reason
    if fallback:
        reason += " Alternativa viável: as opções anteriores na priorização estão indisponíveis."
    return NextCheckSelection(
        **base, status="selected", detection_status=detection.status,
        next_check=SelectedCheck(kind=selected.target.kind, astronaut_id=selected.target.astronaut_id,
                                 reason=reason, effort=selected.effort),
        candidates=ranked, used_alternative=fallback, reason=reason,
        limitations=limitations + detection.limitations,
    )
