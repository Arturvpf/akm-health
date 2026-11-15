"""Prepare the RR-1 radiation and CO2 context excerpts from the audited NASA EDA CSV exports.

Radiation: RR-1_EDA_Radiation_table.csv (daily ISS cabin radiation during Rodent Research-1).
CO2 context: RR-1_EDA_Telemetry_table.csv (the same audited export used by import_rr1_reference.py).

The script refuses files whose SHA-256 differs from the audited exports, never interpolates, and writes
nothing unless every check passes. These values are historical context only: they never feed the detector,
alerts, or the fictional crew's doses.
"""

import argparse
import csv
import hashlib
import json
import statistics
from datetime import date, datetime
from io import StringIO
from pathlib import Path

RADIATION_SHA256 = "766555cabeb9c5bf101d542acfeb13cef2e9d1e20869908311d6045224095c2b"
TELEMETRY_SHA256 = "6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805"
SOURCE = "NASA OSDR Environmental Data Application (EDA)"
SOURCE_URL = "https://visualization.osdr.nasa.gov/eda/"
RADIATION_COLUMNS = {
    "gcr_mgy_per_day": "GCR_Dose_mGy_d",
    "saa_mgy_per_day": "SAA_Dose_mGy_d",
    "total_mgy_per_day": "Total_Dose_mGy_d",
    "accumulated_mgy": "Accumulated_Dose_mGy_d",  # cumulative dose: unit mGy, not mGy/day
}
RADIATION_DAYS = 39
RADIATION_RANGE = (date(2014, 9, 21), date(2014, 10, 29))
# Full-series CO2 figures recorded in the AKM-38 audit; the telemetry export must reproduce them.
CO2_EXPECTED = {"sample_count": 12087, "mean_ppm": 3197.27, "median_ppm": 3192.0, "min_ppm": 1862.0, "max_ppm": 4667.0}
CO2_PERIOD = (date(2014, 9, 20), date(2014, 11, 1))


class ImportError_(ValueError):
    """Raised when an export fails an audit check."""


def _rows(original: bytes) -> tuple[list[str], list[dict[str, str]]]:
    reader = csv.DictReader(StringIO(original.decode("utf-8-sig"), newline=""))
    return list(reader.fieldnames or []), list(reader)


def _date_column(headers: list[str]) -> str:
    for header in headers:
        if "date" in header.lower() or "time" in header.lower() or "day" in header.lower():
            return header
    raise ImportError_(f"No date column found in the radiation export; headers: {headers}")


def build_radiation(original: bytes, *, expected_sha256: str = RADIATION_SHA256) -> dict:
    if hashlib.sha256(original).hexdigest() != expected_sha256:
        raise ImportError_("Radiation CSV hash differs from the export verified in AKM-38")
    headers, rows = _rows(original)
    missing = [column for column in RADIATION_COLUMNS.values() if column not in headers]
    if missing:
        raise ImportError_(f"Radiation CSV is missing columns: {missing}")
    date_column = _date_column(headers)
    days = []
    for row in rows:
        stamp = datetime.fromisoformat(row[date_column].strip()).date()
        entry = {"date": stamp.isoformat()}
        for field, column in RADIATION_COLUMNS.items():
            value = float(row[column])
            if value != value or value in (float("inf"), float("-inf")) or value < 0:
                raise ImportError_(f"Invalid value in {column} on {stamp}")
            entry[field] = value
        days.append(entry)
    stamps = [date.fromisoformat(entry["date"]) for entry in days]
    if len(days) != RADIATION_DAYS or any(a >= b for a, b in zip(stamps, stamps[1:])):
        raise ImportError_(f"Expected {RADIATION_DAYS} strictly chronological daily rows, found {len(days)}")
    if (stamps[0], stamps[-1]) != RADIATION_RANGE:
        raise ImportError_(f"Unexpected period {stamps[0]} to {stamps[-1]}")
    return {
        "mission_id": "RR-1",
        "source": SOURCE,
        "source_url": SOURCE_URL,
        "context": ("ISS cabin radiation during NASA Rodent Research-1 (2014): daily absorbed dose from galactic "
                    "cosmic rays (GCR) and the South Atlantic Anomaly (SAA). Historical context, not crew dose."),
        "days": days,
    }


def build_co2_context(original: bytes, *, expected_sha256: str = TELEMETRY_SHA256, expected: dict | None = None) -> dict:
    if hashlib.sha256(original).hexdigest() != expected_sha256:
        raise ImportError_("Telemetry CSV hash differs from the RR-1 export verified in AKM-38")
    _, rows = _rows(original)
    values, stamps = [], []
    for row in rows:
        stamps.append(datetime.fromisoformat(row["Controller_Time_GMT"]))
        values.append(float(row["CO2_ppm_ISS"]))
    if not values:
        raise ImportError_("No CO2 readings found")
    result = {
        "sample_count": len(values),
        "mean_ppm": round(statistics.fmean(values), 2),
        "median_ppm": statistics.median(values),
        "min_ppm": min(values),
        "max_ppm": max(values),
    }
    target = CO2_EXPECTED if expected is None else expected
    if result != target:
        raise ImportError_(f"CO2 statistics {result} do not reproduce the audited figures {target}")
    return {
        "mission_id": "RR-1",
        "source": SOURCE,
        "source_url": SOURCE_URL,
        "context": ("Full-series ISS cabin CO₂ during NASA Rodent Research-1 (2014). Historical context, "
                    "not a safety limit or an acceptable range."),
        "period_start": min(stamps).date().isoformat(),
        "period_end": max(stamps).date().isoformat(),
        **result,
    }


def _write(target: Path, document: dict) -> None:
    target.write_text(json.dumps(document, ensure_ascii=False, allow_nan=False, indent=2) + "\n",
                      encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("radiation", type=Path, help="Original RR-1_EDA_Radiation_table.csv")
    parser.add_argument("--telemetry", type=Path, help="Original RR-1_EDA_Telemetry_table.csv, to also write the CO2 context")
    args = parser.parse_args()
    data_dir = Path(__file__).resolve().parents[1] / "backend" / "data" / "nasa"
    try:
        radiation = build_radiation(args.radiation.read_bytes())
        co2 = build_co2_context(args.telemetry.read_bytes()) if args.telemetry else None
    except (ImportError_, KeyError, ValueError) as error:
        parser.error(str(error))
    _write(data_dir / "radiation.json", radiation)
    print(f"Wrote {len(radiation['days'])} RR-1 radiation days to {data_dir / 'radiation.json'}")
    if co2:
        _write(data_dir / "co2_context.json", co2)
        print(f"Wrote RR-1 CO2 context ({co2['sample_count']} readings) to {data_dir / 'co2_context.json'}")


if __name__ == "__main__":
    main()
