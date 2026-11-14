"""Show AKM-21 results for the official synthetic seed without opening a database."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from app.rules import IndividualSnapshot, detect_individual_changes
    from app.schemas import MeasurementRead
    from app.seed import PROFILES, observations

    # IDs exist only in this in-memory example; these are not persisted records.
    rows = tuple(sorted((
        MeasurementRead(
            **sample.model_dump(), id=index, measurement_zone=sample.zone(),
            recorded_at=sample.measured_at + timedelta(minutes=5),
        )
        for index, sample in enumerate(observations(), 1)
    ), key=lambda row: (row.measured_at, row.id)))
    results = [
        detect_individual_changes(IndividualSnapshot(
            astronaut_id=profile.id, baseline_sleep_hours=profile.baseline_sleep_hours,
            as_of=datetime(2026, 11, 14, 8, tzinfo=timezone.utc), measurements=rows,
        ), "demo-v1").model_dump(mode="json")
        for profile in PROFILES
    ]
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
