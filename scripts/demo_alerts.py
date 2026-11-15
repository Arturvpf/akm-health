"""Show AKM-24 labels, icons and colors using actual AKM-21 results."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from app.alerts import alert_legend, present_individual_alert
    from app.rules import IndividualSnapshot, detect_individual_changes
    from app.schemas import MeasurementRead
    from app.seed import PROFILES, observations

    rows = tuple(sorted((
        MeasurementRead(**sample.model_dump(), id=index, measurement_zone=sample.zone(),
                        recorded_at=sample.measured_at + timedelta(minutes=5))
        for index, sample in enumerate(observations(), 1)
    ), key=lambda row: (row.measured_at, row.id)))
    as_of = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
    alerts = [present_individual_alert(detect_individual_changes(IndividualSnapshot(
        astronaut_id=p.id, baseline_sleep_hours=p.baseline_sleep_hours, as_of=as_of, measurements=rows,
    ), "demo-v1")).model_dump(mode="json") for p in PROFILES]
    missing = present_individual_alert(detect_individual_changes(IndividualSnapshot(
        astronaut_id="A1", baseline_sleep_hours=8, as_of=as_of,
    ), "demo-v1"))
    print(json.dumps({
        "legend": [style.model_dump(mode="json") for style in alert_legend()],
        "crew_examples": alerts, "missing_data_example": missing.model_dump(mode="json"),
    }, indent=2))


if __name__ == "__main__":
    main()
