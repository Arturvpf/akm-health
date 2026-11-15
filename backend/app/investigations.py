"""Transactional orchestration and persistence of the pure investigation rules."""

from datetime import datetime, timezone
from hashlib import sha256
import json
import logging
import os
from pathlib import Path
from sqlite3 import SQLITE_CONSTRAINT_UNIQUE

from fastapi import HTTPException
from pydantic import ConfigDict, Field, field_validator, model_validator
from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .guidance import explain_investigation, explain_stored_investigation
from .models import Astronaut, Followup, Investigation, Measurement
from .next_check import CheckResource, NextCheckSelection, ValidatedProtocol, prioritize_next_check
from .rules import (
    CollectiveRuleConfig, CrewMember, CrewSnapshot, IndividualSnapshot,
    detect_collective_patterns, detect_individual_changes,
)
from .schemas import (
    FollowupRead, InvestigationEvidence, InvestigationHypothesis, InvestigationResult,
    InvestigationRunRequest, MeasurementRead, METRICS, NextCheck, StrictModel,
)


logger = logging.getLogger(__name__)


class InvestigationSettings(StrictModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    rules_version: str = Field(min_length=1)
    config: CollectiveRuleConfig = CollectiveRuleConfig()
    resources: tuple[CheckResource, ...]
    protocol: ValidatedProtocol | None = None

    @field_validator("rules_version")
    @classmethod
    def nonblank_version(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("rules_version must not be blank")
        return value

    @model_validator(mode="after")
    def unique_resources(self):
        keys = [(resource.kind, resource.astronaut_id) for resource in self.resources]
        if len(keys) != len(set(keys)):
            raise ValueError("Resource targets must be unique")
        return self


def load_settings() -> InvestigationSettings:
    default = Path(__file__).with_name("investigation_config.json")
    path = Path(os.environ.get("AKM_INVESTIGATION_CONFIG", default))
    return InvestigationSettings.model_validate_json(path.read_text(encoding="utf-8"))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _snapshot(session: Session, request: InvestigationRunRequest, as_of: datetime):
    statement = select(Measurement).where(Measurement.recorded_at <= as_of)
    if request.scope == "individual":
        astronaut = session.get(Astronaut, request.astronaut_id)
        if astronaut is None:
            raise HTTPException(404, "Astronaut not found")
        statement = statement.where(or_(Measurement.astronaut_id == request.astronaut_id,
                                       Measurement.astronaut_id.is_(None)))
    measurements = tuple(
        MeasurementRead.model_validate(row, from_attributes=True)
        for row in session.exec(statement.order_by(Measurement.measured_at, Measurement.id))
    )
    if request.scope == "individual":
        return IndividualSnapshot(
            astronaut_id=astronaut.id, baseline_sleep_hours=astronaut.baseline_sleep_hours,
            as_of=as_of, measurements=measurements,
        )
    return CrewSnapshot(
        as_of=as_of, measurements=measurements,
        astronauts=tuple(CrewMember(id=row.id, baseline_sleep_hours=row.baseline_sleep_hours)
                          for row in session.exec(select(Astronaut).order_by(Astronaut.id))),
    )


def fingerprint_payload(snapshot, request: InvestigationRunRequest, settings: InvestigationSettings) -> dict:
    options = settings.model_dump(mode="json")
    # Catalog order is not semantic, whereas protocol preference order is.
    options["resources"] = sorted(options["resources"], key=lambda row: (row["kind"], row["astronaut_id"] or ""))
    return {
        "schema": "akm-investigation-v1", "request": request.model_dump(mode="json"),
        "snapshot": snapshot.model_dump(mode="json", exclude={"as_of"}), "settings": options,
        "priority_policy_version": NextCheckSelection.model_fields["policy_version"].default,
    }


def _find_by_fingerprint(session: Session, fingerprint: str) -> Investigation | None:
    return session.exec(select(Investigation).where(Investigation.input_fingerprint == fingerprint)).first()


def stored_document(row: Investigation) -> tuple[InvestigationResult, dict]:
    document = json.loads(row.result_json)
    if not isinstance(document, dict):
        raise ValueError("Stored investigation must be an object")
    if document.get("schema_version") == 1:
        result = InvestigationResult.model_validate(document["response"])
        audit = document["audit"]
        if not isinstance(audit, dict):
            raise ValueError("Stored audit must be an object")
    else:
        result = InvestigationResult.model_validate(document)
        audit = {}
    if (result.id, result.scope, result.astronaut_id, result.status, result.created_at,
        result.rules_version, result.input_fingerprint) != (
            row.id, row.scope, row.astronaut_id, row.status, row.created_at,
            row.rules_version, row.input_fingerprint,
    ):
        raise ValueError("Stored investigation metadata is inconsistent")
    return result, audit


def _response(row: Investigation, *, reused: bool = False) -> InvestigationResult:
    result, audit = stored_document(row)
    explanation = explain_stored_investigation(result, audit)
    return result.model_copy(update={"reused": reused, "explanation": explanation})


def _encode_document(response: InvestigationResult, snapshot, settings, detection, selection) -> str:
    return json.dumps({
        "schema_version": 1, "response": response.model_dump(mode="json", exclude={"explanation"}),
        "audit": {
            "snapshot": snapshot.model_dump(mode="json"), "settings": settings.model_dump(mode="json"),
            "detection": detection.model_dump(mode="json"), "selection": selection.model_dump(mode="json"),
        },
    }, sort_keys=True, allow_nan=False)


def _compose_result(row: Investigation, detection, selection, followup_id: int | None) -> InvestigationResult:
    evidence = []
    hypotheses = []
    if row.scope == "individual":
        if detection.evidence:
            evidence.append(InvestigationEvidence(kind="sleep_hours", astronaut_ids=[row.astronaut_id], quality="ok"))
    else:
        subjects = [result.astronaut_id for result in detection.individual_results if result.evidence]
        if subjects:
            evidence.append(InvestigationEvidence(kind="sleep_hours", astronaut_ids=subjects, quality="ok"))
        for comparison in detection.environment:
            if comparison.baseline is not None or comparison.aligned_readings:
                evidence.append(InvestigationEvidence(kind=comparison.kind, astronaut_ids=[], quality="ok"))
        hypotheses = [InvestigationHypothesis.model_validate(item.model_dump()) for item in detection.hypotheses]
    findings = list(detection.findings)
    findings.append(f"Janela observada: {detection.window_start.isoformat()} a {detection.as_of.isoformat()}.")
    findings.extend(f"Limitação: {limitation}" for limitation in detection.limitations)
    if selection.next_check is None:
        findings.append(selection.reason)
    result = InvestigationResult(
        id=row.id, scope=row.scope, astronaut_id=row.astronaut_id, status=row.status,
        created_at=row.created_at, rules_version=row.rules_version, input_fingerprint=row.input_fingerprint,
        reused=False, findings=findings, evidence=evidence, hypotheses=hypotheses,
        next_check=NextCheck.model_validate(selection.next_check.model_dump()) if selection.next_check else None,
        followup_id=followup_id, guidance=[], demo_only=True,
    )
    return result.model_copy(update={"explanation": explain_investigation(result, detection, selection)})


def run_investigation(
    session: Session, request: InvestigationRunRequest, settings: InvestigationSettings,
) -> InvestigationResult:
    fingerprint = None
    try:
        with session.begin():
            # Acquire the writer lock before reading the snapshot or checking a pending target.
            session.exec(text("BEGIN IMMEDIATE"))
            as_of = utc_now()
            snapshot = _snapshot(session, request, as_of)
            payload = fingerprint_payload(snapshot, request, settings)
            fingerprint = sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
            existing = _find_by_fingerprint(session, fingerprint)
            if existing is not None:
                return _response(existing, reused=True)
            if request.scope == "individual":
                detection = detect_individual_changes(snapshot, settings.rules_version, settings.config.individual)
            else:
                detection = detect_collective_patterns(snapshot, settings.rules_version, settings.config)
            selection = prioritize_next_check(snapshot, settings.rules_version, settings.resources,
                                               settings.config, settings.protocol)
            row = Investigation(
                scope=request.scope, astronaut_id=request.astronaut_id, status=detection.status,
                created_at=as_of, rules_version=settings.rules_version, input_fingerprint=fingerprint, result_json="{}",
            )
            session.add(row)
            session.flush()
            followup = None
            if selection.next_check is not None:
                check = selection.next_check
                followup = session.exec(select(Followup).where(
                    Followup.status == "pending", Followup.kind == check.kind,
                    Followup.astronaut_id == check.astronaut_id,
                ).order_by(Followup.id)).first()
                if followup is None:
                    followup = Followup(
                        investigation_id=row.id, astronaut_id=check.astronaut_id, kind=check.kind,
                        reason=check.reason, created_at=as_of,
                    )
                    session.add(followup)
                    session.flush()
            response = _compose_result(row, detection, selection, followup.id if followup else None)
            row.result_json = _encode_document(response, snapshot, settings, detection, selection)
            session.add(row)
        return response
    except HTTPException:
        raise
    except IntegrityError as exc:
        if fingerprint is not None and getattr(exc.orig, "sqlite_errorcode", None) == SQLITE_CONSTRAINT_UNIQUE:
            existing = _find_by_fingerprint(session, fingerprint)
            if existing is not None:
                return _response(existing, reused=True)
        logger.error("Investigation transaction failed: %s", type(exc).__name__)
        raise HTTPException(500, "Could not persist investigation") from None
    except Exception as exc:
        logger.error("Investigation transaction failed: %s", type(exc).__name__)
        raise HTTPException(500, "Could not persist investigation") from None


def get_investigation(session: Session, id: int) -> InvestigationResult:
    row = session.get(Investigation, id)
    if row is None:
        raise HTTPException(404, "Investigation not found")
    try:
        return _response(row)
    except (ValueError, KeyError, TypeError) as exc:
        logger.error("Stored investigation could not be decoded: %s", type(exc).__name__)
        raise HTTPException(500, "Stored investigation is invalid") from None


def complete_followup(session: Session, id: int, measurement_id: int) -> FollowupRead:
    try:
        with session.begin():
            session.exec(text("BEGIN IMMEDIATE"))
            followup = session.get(Followup, id)
            if followup is None:
                raise HTTPException(404, "Followup not found")
            if followup.status == "completed":
                if followup.measurement_id != measurement_id:
                    raise HTTPException(409, "Followup already completed with another measurement")
                return FollowupRead.model_validate(followup, from_attributes=True)
            measurement = session.get(Measurement, measurement_id)
            if measurement is None:
                raise HTTPException(404, "Measurement not found")
            now = utc_now()
            if (measurement.kind != followup.kind or measurement.astronaut_id != followup.astronaut_id
                    or measurement.measurement_zone != METRICS[followup.kind][1]):
                raise HTTPException(422, "Measurement does not match followup kind, zone and astronaut")
            if measurement.quality != "ok":
                raise HTTPException(422, "Followup requires a usable measurement")
            if measurement.recorded_at <= followup.created_at:
                raise HTTPException(422, "Measurement must be recorded after followup creation")
            if measurement.recorded_at > now or measurement.measured_at > now:
                raise HTTPException(422, "Future measurement cannot complete a followup")
            followup.status = "completed"
            followup.measurement_id = measurement_id
            followup.completed_at = now
            session.add(followup)
            session.flush()
            response = FollowupRead.model_validate(followup, from_attributes=True)
        return response
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Followup completion failed: %s", type(exc).__name__)
        raise HTTPException(500, "Could not complete followup") from None
