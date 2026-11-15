"""AKM-23 examples using the synthetic seed, without opening a database."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from app.next_check import CheckResource, prioritize_next_check
    from app.rules import CrewMember, CrewSnapshot, IndividualSnapshot
    from app.schemas import MeasurementRead
    from app.seed import NIGHT_2, PROFILES, observations

    rows = tuple(sorted((
        MeasurementRead(**sample.model_dump(), id=index, measurement_zone=sample.zone(),
                        recorded_at=sample.measured_at + timedelta(minutes=5))
        for index, sample in enumerate(observations(), 1)
    ), key=lambda row: (row.measured_at, row.id)))
    as_of = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
    profiles = tuple(CrewMember(id=p.id, baseline_sleep_hours=p.baseline_sleep_hours) for p in PROFILES)
    crew = CrewSnapshot(as_of=as_of, astronauts=profiles, measurements=rows)
    catalog = (
        CheckResource(kind="co2_ppm", available=True, effort="low"),
        CheckResource(kind="cabin_temp_c", available=True, effort="low"),
        *(CheckResource(kind="sleep_hours", astronaut_id=p.id, available=True, effort="low") for p in PROFILES),
    )
    unavailable_co2 = tuple(resource.model_copy(update={"available": False})
                            if resource.kind == "co2_ppm" else resource for resource in catalog)
    partial = CrewSnapshot(as_of=as_of, astronauts=profiles, measurements=tuple(
        row for row in rows if not (row.kind == "sleep_hours" and row.astronaut_id != "A1"
                                   and row.measured_at == NIGHT_2)
    ))
    individual = IndividualSnapshot(astronaut_id="A1", baseline_sleep_hours=8, as_of=as_of, measurements=rows)
    examples = {
        "collective": prioritize_next_check(crew, "demo-v1", catalog),
        "co2_unavailable": prioritize_next_check(crew, "demo-v1", unavailable_co2),
        "individual": prioritize_next_check(individual, "demo-v1", catalog),
        "insufficient": prioritize_next_check(partial, "demo-v1", catalog),
        "all_unavailable": prioritize_next_check(crew, "demo-v1", ()),
    }
    print(json.dumps({name: result.model_dump(mode="json") for name, result in examples.items()}, indent=2))


if __name__ == "__main__":
    main()
