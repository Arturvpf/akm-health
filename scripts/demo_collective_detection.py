"""Run the synthetic AKM-22 collective example in memory."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from app.rules import CrewMember, CrewSnapshot, detect_collective_patterns
    from app.schemas import MeasurementRead
    from app.seed import PROFILES, observations

    rows = tuple(sorted((
        MeasurementRead(**sample.model_dump(), id=index, measurement_zone=sample.zone(),
                        recorded_at=sample.measured_at + timedelta(minutes=5))
        for index, sample in enumerate(observations(), 1)
    ), key=lambda row: (row.measured_at, row.id)))
    snapshot = CrewSnapshot(
        as_of=datetime(2026, 11, 14, 8, tzinfo=timezone.utc), measurements=rows,
        astronauts=tuple(CrewMember(id=p.id, baseline_sleep_hours=p.baseline_sleep_hours) for p in PROFILES),
    )
    print(json.dumps(detect_collective_patterns(snapshot, "demo-v1").model_dump(mode="json"), indent=2))


if __name__ == "__main__":
    main()
