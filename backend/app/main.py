"""AKM Health API and local database startup."""

from contextlib import asynccontextmanager
from http import HTTPStatus
from math import isfinite
from sqlite3 import SQLITE_CONSTRAINT_FOREIGNKEY
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from starlette.concurrency import run_in_threadpool

from .dashboard import build_dashboard
from .db import make_engine, migrate
from .models import Astronaut, Followup, Measurement
from .nasa_reference import HRP_REFERENCES
from .schemas import (
    AstronautRead,
    DashboardResponse,
    FollowupRead,
    MeasurementCreate,
    MeasurementHistoryQuery,
    MeasurementRead,
    NASAReferenceResponse,
)


@asynccontextmanager
async def lifespan(application: FastAPI):
    engine = make_engine()
    try:
        await run_in_threadpool(migrate, engine)
        application.state.engine = engine
        yield
    finally:
        application.state.engine = None
        engine.dispose()


app = FastAPI(title="AKM Health · backend foundation", version="0.2.0", lifespan=lifespan)


def json_safe_errors(value):
    """Keep non-finite inputs from breaking the validation error response."""
    if isinstance(value, float) and not isfinite(value):
        return str(value)
    if isinstance(value, list):
        return [json_safe_errors(item) for item in value]
    if isinstance(value, dict):
        return {key: json_safe_errors(item) for key, item in value.items()}
    return value


@app.exception_handler(RequestValidationError)
async def request_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        content={"detail": json_safe_errors(jsonable_encoder(exc.errors()))},
    )


@app.get("/api/health")
def health():
    engine = getattr(app.state, "engine", None)
    with (engine if engine is not None else make_engine()).connect() as connection:
        connection.exec_driver_sql("SELECT 1")
    return {"status": "ok", "storage": "sqlite_reachable"}


def get_session(request: Request):
    with Session(request.app.state.engine) as session:
        yield session


DatabaseSession = Annotated[Session, Depends(get_session)]
HISTORY_QUERY_NAMES = frozenset(
    field.alias or name for name, field in MeasurementHistoryQuery.model_fields.items()
)


async def validate_history_query_names(request: Request) -> None:
    # FastAPI 0.115 normalizes aliases to internal names. Check the public names on the wire.
    errors = [
        {"type": "extra_forbidden", "loc": ("query", name), "msg": "Extra inputs are not permitted", "input": value}
        for name, value in request.query_params.items()
        if name not in HISTORY_QUERY_NAMES
    ]
    if errors:
        raise RequestValidationError(errors)


def require_astronaut(session: Session, astronaut_id: str | None) -> None:
    if astronaut_id is not None and session.get(Astronaut, astronaut_id) is None:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Astronaut not found")


@app.get("/api/astronauts", response_model=list[AstronautRead])
def astronauts(session: DatabaseSession):
    """Return fictional profiles and their individual synthetic baselines."""
    return session.exec(select(Astronaut).order_by(Astronaut.id)).all()


@app.get(
    "/api/measurements", response_model=list[MeasurementRead],
    dependencies=[Depends(validate_history_query_names)],
    responses={404: {"description": "Astronaut not found"}},
)
def measurement_history(
    filters: Annotated[MeasurementHistoryQuery, Query()], session: DatabaseSession,
):
    """Read crew or habitat history, including suspect samples and provenance."""
    require_astronaut(session, filters.astronaut_id)
    statement = select(Measurement)
    if filters.astronaut_id is not None:
        statement = statement.where(Measurement.astronaut_id == filters.astronaut_id)
    if filters.kind is not None:
        statement = statement.where(Measurement.kind == filters.kind)
    if filters.from_timestamp is not None:
        statement = statement.where(Measurement.measured_at >= filters.from_timestamp)
    if filters.to_timestamp is not None:
        statement = statement.where(Measurement.measured_at <= filters.to_timestamp)
    return session.exec(
        statement.order_by(Measurement.measured_at, Measurement.id)
        .offset(filters.offset).limit(filters.limit)
    ).all()


@app.get(
    "/api/followups", response_model=list[FollowupRead],
    responses={404: {"description": "Astronaut not found"}},
)
def followups(
    session: DatabaseSession,
    astronaut_id: Annotated[str | None, Query(min_length=1)] = None,
    status: Literal["pending", "completed"] | None = None,
):
    """Read the persisted agenda; scheduling and completion are separate tasks."""
    require_astronaut(session, astronaut_id)
    statement = select(Followup)
    if astronaut_id is not None:
        statement = statement.where(Followup.astronaut_id == astronaut_id)
    if status is not None:
        statement = statement.where(Followup.status == status)
    return session.exec(statement.order_by(Followup.created_at, Followup.id)).all()


@app.post(
    "/api/measurements",
    status_code=HTTPStatus.CREATED,
    response_model=MeasurementRead,
    responses={
        404: {
            "description": "Astronaut not found",
            "content": {"application/json": {"example": {"detail": "Astronaut not found"}}},
        },
    },
)
def create_measurement(body: MeasurementCreate, session: DatabaseSession) -> MeasurementRead:
    """Record a crew or cabin observation and return the stored measurement."""
    if body.astronaut_id is not None and session.get(Astronaut, body.astronaut_id) is None:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Astronaut not found")

    measurement = Measurement.from_payload(body)
    try:
        session.add(measurement)
        session.flush()
        result = MeasurementRead.model_validate(measurement, from_attributes=True)
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        if getattr(exc.orig, "sqlite_errorcode", None) == SQLITE_CONSTRAINT_FOREIGNKEY:
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Astronaut not found") from exc
        raise
    return result


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard(session: DatabaseSession) -> DashboardResponse:
    """Read the local snapshot and indicate observations awaiting investigation."""
    return build_dashboard(session)


@app.get("/api/nasa/references", response_model=NASAReferenceResponse)
def nasa_references():
    return NASAReferenceResponse(
        scientific_references=list(HRP_REFERENCES),
        historical_series=[],
        historical_data_status="not_imported",
    )


@app.post("/api/_contract/validate-measurement")
def validate_measurement(body: MeasurementCreate):
    """Testing-only endpoint. Not part of the ten canonical business API routes."""
    return {"kind": body.kind, "measurement_zone": body.zone(), "valid": True}
