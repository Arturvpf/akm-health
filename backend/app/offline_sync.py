"""AKM-33: exactly-once durable measurement insertion for retries of one client operation."""

import hashlib
import json
from datetime import datetime, timezone
from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import Session

from .models import Astronaut, Measurement, SyncOperation
from .schemas import MeasurementRead, SyncMeasurementRequest, SyncMeasurementReceipt


def _fingerprint(body: SyncMeasurementRequest) -> str:
    # Pydantic normalizes the timestamp to UTC, source and quality defaults included.
    canonical = json.dumps(body.measurement.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def register_sync_measurement(session: Session, body: SyncMeasurementRequest) -> tuple[SyncMeasurementReceipt, int]:
    """SQLite write-lock serializes competing deliveries of the same operation ID."""
    operation_id = str(body.operation_id)
    payload_hash = _fingerprint(body)
    with session.begin():
        session.exec(text("BEGIN IMMEDIATE"))
        previous = session.get(SyncOperation, operation_id)
        if previous is not None:
            if previous.payload_hash != payload_hash:
                raise HTTPException(HTTPStatus.CONFLICT, "Operation ID reused with different measurement")
            existing = session.get(Measurement, previous.measurement_id)
            if existing is None:
                raise HTTPException(HTTPStatus.CONFLICT, "Operation receipt references a missing measurement")
            return SyncMeasurementReceipt(
                operation_id=body.operation_id,
                measurement=MeasurementRead.model_validate(existing, from_attributes=True),
                reused=True,
            ), HTTPStatus.OK
        try:
            body.measurement.ensure_not_in_future()
        except ValueError as error:
            raise HTTPException(HTTPStatus.UNPROCESSABLE_ENTITY, str(error)) from None
        if body.measurement.astronaut_id is not None and session.get(
            Astronaut, body.measurement.astronaut_id
        ) is None:
            raise HTTPException(HTTPStatus.NOT_FOUND, "Astronaut not found")
        measurement = Measurement.from_payload(body.measurement)
        session.add(measurement)
        session.flush()
        session.add(SyncOperation(
            id=operation_id, payload_hash=payload_hash, measurement_id=measurement.id,
            created_at=datetime.now(timezone.utc),
        ))
        return SyncMeasurementReceipt(
            operation_id=body.operation_id,
            measurement=MeasurementRead.model_validate(measurement, from_attributes=True),
            reused=False,
        ), HTTPStatus.CREATED
