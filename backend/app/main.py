"""AKM Health execution proof: FastAPI + SQLite connectivity, not the full MVP."""
from fastapi import FastAPI
from .db import connect
from .schemas import MeasurementCreate

app = FastAPI(title="AKM Health · backend foundation", version="0.2.0")

@app.get("/api/health")
def health():
    with connect() as db:
        db.execute("SELECT 1").fetchone()
    return {"status": "ok", "storage": "sqlite_reachable"}

@app.post("/api/_contract/validate-measurement")
def validate_measurement(body: MeasurementCreate):
    """Testing-only endpoint. Not part of the ten canonical business API routes."""
    return {"kind": body.kind, "measurement_zone": body.zone(), "valid": True}
