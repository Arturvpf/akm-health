"""RR-1 radiation and CO2 context: strict import, explicit units, not_imported without invented values.

The CSV fixtures below are synthetic test inputs that only mimic the audited export's layout; they are
never shipped as NASA data. The real exports are accepted only with their audited SHA-256.
"""

import hashlib
import importlib.util
import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from app import nasa_reference
from app.main import app
from app.schemas import NASAReferenceResponse

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "import_rr1_radiation.py"
spec = importlib.util.spec_from_file_location("import_rr1_radiation", SCRIPT)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def radiation_csv(days=39, *, cumulative_fault=False) -> bytes:
    lines = ["Date,GCR_Dose_mGy_d,SAA_Dose_mGy_d,Total_Dose_mGy_d,Accumulated_Dose_mGy_d"]
    total = 0.0
    from datetime import date, timedelta
    for index in range(days):
        gcr, saa = 0.1 + index / 1000, 0.05
        total += gcr + saa
        lines.append(f"{date(2014, 9, 21) + timedelta(days=index)},{gcr},{saa},{gcr + saa},{-1 if cumulative_fault else total}")
    return ("\n".join(lines) + "\n").encode()


def telemetry_csv(values) -> bytes:
    lines = ["Controller_Time_GMT,Temp_degC_ISS,RH_percent_ISS,CO2_ppm_ISS"]
    lines += [f"2014-09-{20 + index // 600:02d} 00:{index % 60:02d}:00,22,40,{value}" for index, value in enumerate(values)]
    return ("\n".join(lines) + "\n").encode()


def test_importer_refuses_an_export_with_a_different_hash():
    with pytest.raises(importer.ImportError_, match="hash differs"):
        importer.build_radiation(radiation_csv())
    with pytest.raises(importer.ImportError_, match="hash differs"):
        importer.build_co2_context(telemetry_csv([3000, 3100]))


def test_importer_keeps_explicit_units_and_does_not_interpolate():
    original = radiation_csv()
    document = importer.build_radiation(original, expected_sha256=hashlib.sha256(original).hexdigest())
    assert len(document["days"]) == 39
    assert set(document["days"][0]) == {
        "date", "gcr_mgy_per_day", "saa_mgy_per_day", "total_mgy_per_day", "accumulated_mgy",
    }
    assert document["days"][0]["date"] == "2014-09-21" and document["days"][-1]["date"] == "2014-10-29"
    assert "not crew dose" in document["context"]


@pytest.mark.parametrize("days,fault", [(38, False), (39, True)])
def test_importer_rejects_incomplete_or_invalid_series(days, fault):
    original = radiation_csv(days, cumulative_fault=fault)
    with pytest.raises(importer.ImportError_):
        importer.build_radiation(original, expected_sha256=hashlib.sha256(original).hexdigest())


def test_co2_context_must_reproduce_the_audited_figures():
    original = telemetry_csv([3000, 3100, 3200])
    digest = hashlib.sha256(original).hexdigest()
    expected = {"sample_count": 3, "mean_ppm": 3100.0, "median_ppm": 3100.0, "min_ppm": 3000.0, "max_ppm": 3200.0}
    document = importer.build_co2_context(original, expected_sha256=digest, expected=expected)
    assert document["mean_ppm"] == 3100.0 and "not a safety limit" in document["context"]
    with pytest.raises(importer.ImportError_, match="do not reproduce"):
        importer.build_co2_context(original, expected_sha256=digest)


def serve(tmp_path, monkeypatch, files: dict[str, str]):
    (tmp_path / "hrp_catalog.json").write_bytes((nasa_reference.DATA_DIR / "hrp_catalog.json").read_bytes())
    for name, content in files.items():
        (tmp_path / name).write_text(content, encoding="utf-8")
    monkeypatch.setattr(nasa_reference, "DATA_DIR", tmp_path)
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "demo.db"))
    with TestClient(app) as client:
        response = client.get("/api/nasa/references")
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize("content", [None, "{invalid json", "{}", '{"mission_id":"RR-1","days":[]}'])
def test_missing_or_invalid_radiation_is_not_imported_without_invented_values(content, tmp_path, monkeypatch):
    files = {} if content is None else {"radiation.json": content, "co2_context.json": content}
    body = serve(tmp_path, monkeypatch, files)
    assert body["radiation_status"] == "not_imported" and body["radiation"] is None
    assert body["co2_context_status"] == "not_imported" and body["co2_context"] is None
    assert len(body["scientific_references"]) == 3  # the existing contract is unchanged


def test_imported_radiation_and_co2_context_are_exposed_with_units(tmp_path, monkeypatch):
    original = radiation_csv()
    radiation = importer.build_radiation(original, expected_sha256=hashlib.sha256(original).hexdigest())
    co2 = {"mission_id": "RR-1", "source": "NASA OSDR EDA", "source_url": "https://visualization.osdr.nasa.gov/eda/",
           "context": "Historical context, not a safety limit.", "period_start": "2014-09-20", "period_end": "2014-11-01",
           "sample_count": 3, "mean_ppm": 3100.0, "median_ppm": 3100.0, "min_ppm": 3000.0, "max_ppm": 3200.0}
    body = serve(tmp_path, monkeypatch, {"radiation.json": json.dumps(radiation), "co2_context.json": json.dumps(co2)})
    assert body["radiation_status"] == "imported" and body["co2_context_status"] == "imported"
    day = body["radiation"]["days"][0]
    assert {"gcr_mgy_per_day", "saa_mgy_per_day", "total_mgy_per_day", "accumulated_mgy"} <= set(day)
    assert body["co2_context"]["max_ppm"] == 3200.0


def test_status_must_match_presence_of_values():
    base = dict(scientific_references=[], historical_series=[], historical_data_status="not_imported")
    assert NASAReferenceResponse(**base).radiation_status == "not_imported"
    with pytest.raises(ValidationError):
        NASAReferenceResponse(**base, radiation_status="imported")
    with pytest.raises(ValidationError):
        NASAReferenceResponse(**base, co2_context_status="imported")
