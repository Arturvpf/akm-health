"""AKM Health API and local database startup."""

from contextlib import asynccontextmanager
from http import HTTPStatus
from math import isfinite
from sqlite3 import SQLITE_CONSTRAINT_FOREIGNKEY
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session
from starlette.concurrency import run_in_threadpool

from .dashboard import build_dashboard
from .db import make_engine, migrate
from .models import Astronaut, Measurement
from .nasa_reference import HRP_REFERENCES
from .schemas import DashboardResponse, MeasurementCreate, MeasurementRead, NASAReferenceResponse


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
