"""Read the curated NASA catalog and telemetry without accessing the mission database."""

import logging
from pathlib import Path

from pydantic import AwareDatetime, Field, TypeAdapter, ValidationError

from .schemas import (
    NASAHistoricalObservation, NASAReferenceResponse, ScientificReference, StrictModel, require_utc,
)


DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "nasa"
SOURCE_URL = "https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/"
logger = logging.getLogger(__name__)


class RR1Sample(StrictModel):
    observed_at: AwareDatetime
    temperature_c: float = Field(strict=True, allow_inf_nan=False)
    relative_humidity_pct: float = Field(strict=True, ge=0, le=100)
    co2_ppm: float = Field(strict=True, ge=0, allow_inf_nan=False)


CATALOG = TypeAdapter(list[ScientificReference])
RR1_SERIES = TypeAdapter(list[RR1Sample])
CHANNELS = (("temperature_c", "°C"), ("relative_humidity_pct", "%"), ("co2_ppm", "ppm"))


def _read_history(path: Path) -> list[NASAHistoricalObservation]:
    try:
        rows = RR1_SERIES.validate_json(path.read_bytes())
        timestamps = [require_utc(row.observed_at) for row in rows]
        if not timestamps or any(a >= b for a, b in zip(timestamps, timestamps[1:])):
            raise ValueError("RR-1 samples must be nonempty and strictly chronological")
    except FileNotFoundError:
        return []
    except (OSError, ValueError):
        logger.warning("Unable to load the local NASA RR-1 series", exc_info=True)
        return []

    return [
        NASAHistoricalObservation(
            source="NASA OSDR Environmental Data Application (EDA)",
            source_url=SOURCE_URL,
            mission_id="RR-1",
            parameter=parameter,
            value=getattr(row, parameter),
            unit=unit,
            observed_at=timestamp.isoformat().replace("+00:00", "Z"),
            instrument="ISS environmental telemetry (sensor model unspecified in the EDA export)",
            context="Rodent Research-1 environmental telemetry, channels labeled ISS by NASA EDA.",
        )
        for row, timestamp in zip(rows, timestamps, strict=True)
        for parameter, unit in CHANNELS
    ]


def load_nasa_references() -> NASAReferenceResponse:
    try:
        references = CATALOG.validate_json((DATA_DIR / "hrp_catalog.json").read_bytes())
    except (OSError, ValidationError) as error:
        logger.error("Unable to load the local NASA HRP catalog", exc_info=True)
        raise RuntimeError("NASA reference catalog unavailable") from error
    history = _read_history(DATA_DIR / "reference.json")
    return NASAReferenceResponse(
        scientific_references=references,
        historical_series=history,
        historical_data_status="imported" if history else "not_imported",
    )
