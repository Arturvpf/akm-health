"""AKM Health API and local database startup."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.concurrency import run_in_threadpool

from .db import make_engine, migrate
from .nasa_reference import HRP_REFERENCES
from .schemas import MeasurementCreate, NASAReferenceResponse


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


@app.get("/api/health")
def health():
    engine = getattr(app.state, "engine", None)
    with (engine if engine is not None else make_engine()).connect() as connection:
        connection.exec_driver_sql("SELECT 1")
    return {"status": "ok", "storage": "sqlite_reachable"}


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
