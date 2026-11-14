"""AKM-06 data-contract acceptance tests, not clinical validation."""
import pytest
from pydantic import ValidationError
from app.schemas import (
    MeasurementCreate, MetricSnapshot, HabitatSnapshot,
    NASAHistoricalObservation, NASAReferenceResponse
)

STAMP = "2026-11-14T14:00:00Z"

def payload(**updates):
    data = {"astronaut_id": "A1", "kind": "sleep_hours", "value": 5.2,
            "unit": "h", "measured_at": STAMP, "source": "synthetic"}
    data.update(updates)
    return data

@pytest.mark.parametrize("updates, zone", [
    ({"value": 0}, "astronaut"),
    ({"kind": "heart_rate_bpm", "unit": "bpm", "value": 72}, "astronaut"),
    ({"kind": "mood_score", "unit": "score_1_to_5", "value": 3}, "astronaut"),
    ({"kind": "co2_ppm", "unit": "ppm", "value": 950, "astronaut_id": None}, "habitat"),
    ({"kind": "cabin_temp_c", "unit": "C", "value": 23.5, "astronaut_id": None}, "habitat"),
])
def test_all_metric_contracts(updates, zone):
    assert MeasurementCreate(**payload(**updates)).zone() == zone

@pytest.mark.parametrize("updates", [
    {"value": -1},
    {"value": 25},
    {"kind": "heart_rate_bpm", "unit": "bpm", "value": 0},
    {"kind": "mood_score", "unit": "score_1_to_5", "value": 3.5},
    {"kind": "co2_ppm", "unit": "ppm", "astronaut_id": None, "value": -2},
    {"kind": "cabin_temp_c", "unit": "C", "astronaut_id": None, "value": float("inf")},
    {"kind": "co2_ppm", "unit": "ppm", "astronaut_id": "A1", "value": 900},
    {"measured_at": "2026-11-14T14:00:00"},
    {"source": "NASA"},
])
def test_invalid_inputs(updates):
    with pytest.raises(ValidationError):
        MeasurementCreate(**payload(**updates))

def test_suspect_quality_is_not_clinical_status():
    item = MeasurementCreate(**payload(quality="suspect"))
    assert item.quality == "suspect"
    assert not hasattr(item, "status")

def test_snapshots_reject_naive_timestamps():
    with pytest.raises(ValidationError):
        MetricSnapshot(value=70, unit="bpm", measured_at="2026-11-14T14:00:00")
    with pytest.raises(ValidationError):
        HabitatSnapshot(co2_ppm=900, cabin_temp_c=23,
                        measured_at="2026-11-14T14:00:00", measurement_zone="habitat")

def test_historical_nasa_requires_https_and_observation_time():
    entry = {"source": "NASA", "source_url": "https://visualization.osdr.nasa.gov/eda/",
             "mission_id": "RR-1", "parameter": "CO2", "value": 900,
             "unit": "ppm", "context": "ISS historical"}
    with pytest.raises(ValidationError):
        NASAHistoricalObservation(**entry)
    with pytest.raises(ValidationError):
        NASAHistoricalObservation(**(entry | {"observed_at": STAMP,
                            "source_url": "http://not-https.example"}))
    assert NASAHistoricalObservation(**(entry | {"observed_at": STAMP})).observed_at == STAMP
    assert NASAHistoricalObservation(**(entry | {"mars_sol": 100})).mars_sol == 100

def test_import_status_requires_actual_history():
    with pytest.raises(ValidationError):
        NASAReferenceResponse(scientific_references=[], historical_series=[],
                              historical_data_status="imported")
