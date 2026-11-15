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
            title="AKM Health · Arquitetura e regras da demonstração",
            url="https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4",
            relevance="Define a comparação de sono e os critérios experimentais da análise.",
        ),
        InvestigationReference(
            source_id="HRR-100",
            title="NASA Human Research Roadmap · Sono, ritmo circadiano e carga de trabalho",
            url="https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100",
            relevance="Contextualiza o monitoramento do sono em missão. O critério da demo vem da arquitetura AKM.",
        ),
        InvestigationReference(
            source_id="AKM-08",
            title="AKM Health · Critérios de alerta e revisão humana",
            url="https://github.com/Arturvpf/akm-health/blob/9cd37e8fc33cc4ac271281e0b36f61e33b2d40ba/docs/akm-08-alert-safety.md",
            relevance="Explica quando levar a análise à equipe e como seguir o protocolo da missão.",
        ),
    ]
    limitations = ["A investigação descreve dados da demonstração. A avaliação clínica cabe à equipe responsável."]
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
        limitations.append("Este registro não fornece detalhes auditáveis da cobertura da análise.")

    if result.status == "insufficient_data":
        uncertainty = "A cobertura das leituras é insuficiente para avaliar o padrão de sono neste escopo."
    elif result.status == "attention":
        uncertainty = "A causa do padrão de sono permanece em aberto."
    elif result.status == "normal":
        uncertainty = "O resultado se limita ao padrão de sono avaliado, aos perfis cobertos e à janela das leituras."
    else:
        uncertainty = "A interpretação operacional do registro cabe à equipe da missão."

    comparison = None
    if result.status == "attention" and isinstance(detection, CollectiveDetection):
        comparison = next((item for item in detection.environment if item.kind == "co2_ppm"), None)
    if comparison is not None:
        uncertainty += f" O CO₂ considerado é o do ar interno da cabine. {comparison.explanation}"
    if (comparison is not None
            or (result.next_check and result.next_check.kind == "co2_ppm")
            or any(item.kind == "co2_ppm" for item in result.evidence)):
        references.append(InvestigationReference(
            source_id="NASA-CO2",
            title="NASA OCHMO-TB-004 · Dióxido de carbono",
            url="https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/",
            relevance="Contextualiza a observação do ar da cabine. As leituras da investigação vêm da demonstração.",
        ))

    check_context = None
    if selection is not None:
        check_context = InvestigationCheckContext(status=selection.status, reason=selection.reason)
    if selection is not None and selection.status == "protocol_referral":
        human_review = HumanReview(
            mode="per_protocol",
            instruction="Procure o responsável designado pelo protocolo da missão sem aguardar nova coleta.",
            protocol_reference=selection.protocol_reference,
        )
    else:
        human_review = HumanReview(
            mode="conditional",
            instruction=(
                "Se o padrão persistir após a rechecagem, as coletas repetidas falharem ou você precisar de ajuda, "
                "leve o escopo da investigação, as leituras, os horários, a qualidade, as lacunas e as verificações "
                "já feitas à equipe responsável. "
                "Se o protocolo indicar encaminhamento imediato, procure o responsável designado sem aguardar reanálise."
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
