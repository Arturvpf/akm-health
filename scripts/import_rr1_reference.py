"""Prepare AKM-39's local excerpt from the audited NASA EDA CSV export."""

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path


EXPORT_SHA256 = "6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805"
REFERENCE_DATE = "2014-10-01"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path, help="Original RR-1_EDA_Telemetry_table.csv")
    args = parser.parse_args()
    original = args.export.read_bytes()
    if hashlib.sha256(original).hexdigest() != EXPORT_SHA256:
        parser.error("CSV hash differs from the RR-1 export verified in AKM-38")

    rows = csv.DictReader(StringIO(original.decode("utf-8-sig"), newline=""))
    observations = []
    for row in rows:
        stamp = row["Controller_Time_GMT"]
        if not stamp.startswith(REFERENCE_DATE + " "):
            continue
        timestamp = datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc)
        observations.append({
            "observed_at": timestamp.isoformat().replace("+00:00", "Z"),
            "temperature_c": float(row["Temp_degC_ISS"]),
            "relative_humidity_pct": float(row["RH_percent_ISS"]),
            "co2_ppm": float(row["CO2_ppm_ISS"]),
        })
    if not observations:
        parser.error("No observations found on the selected UTC date")

    target = Path(__file__).resolve().parents[1] / "backend" / "data" / "nasa" / "reference.json"
    formatted = ",\n".join(f"  {json.dumps(row, allow_nan=False)}" for row in observations)
    target.write_text(f"[\n{formatted}\n]\n", encoding="utf-8", newline="\n")
    print(f"Wrote {len(observations)} RR-1 sample times to {target}")


if __name__ == "__main__":
    main()
