"""Read the current mission snapshot without running an investigation."""

from collections import defaultdict
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import aliased
from sqlmodel import Session, select

from .models import Astronaut, Followup, Investigation, Measurement
from .schemas import (
    AstronautDashboardRead,
    DashboardResponse,
    FollowupRead,
    HabitatSnapshot,
    Kind,
    MetricSnapshot,
    MissionContext,
)


MISSION = MissionContext.model_validate_json(
    Path(__file__).with_name("mission_environment.json").read_text(encoding="utf-8")
)


def build_dashboard(session: Session) -> DashboardResponse:
    latest_crew_analysis = session.exec(
        select(Investigation.created_at)
        .where(Investigation.scope == "crew")
        .order_by(Investigation.created_at.desc())
        .limit(1)
    ).first()
    new_measurement = select(Measurement.id).where(Measurement.quality == "ok")
    if latest_crew_analysis is not None:
        new_measurement = new_measurement.where(Measurement.recorded_at > latest_crew_analysis)

    ranked = select(
        Measurement,
        func.row_number().over(
            partition_by=(Measurement.astronaut_id, Measurement.kind),
            order_by=(Measurement.measured_at.desc(), Measurement.id.desc()),
        ).label("rank"),
    ).where(Measurement.quality == "ok").subquery()
    latest = aliased(Measurement, ranked)
    snapshots: dict[str | None, dict[Kind, MetricSnapshot]] = defaultdict(dict)
    for measurement in session.exec(select(latest).where(ranked.c.rank == 1)):
        snapshots[measurement.astronaut_id][Kind(measurement.kind)] = MetricSnapshot(
            value=measurement.value, unit=measurement.unit, measured_at=measurement.measured_at,
        )

    habitat = snapshots[None]
    co2 = habitat.get(Kind.co2_ppm)
    temperature = habitat.get(Kind.cabin_temp_c)
    return DashboardResponse(
        mission=MISSION,
        astronauts=[
            AstronautDashboardRead(
                id=astronaut.id, name=astronaut.name, latest_metrics=snapshots[astronaut.id],
                status="insufficient_data",
            )
            for astronaut in session.exec(select(Astronaut).order_by(Astronaut.id))
        ],
        environment=HabitatSnapshot(
            co2_ppm=co2.value if co2 else None,
            cabin_temp_c=temperature.value if temperature else None,
            measured_at=max((sample.measured_at for sample in habitat.values()), default=None),
            measurement_zone="habitat",
        ),
        alerts=[],
        pending_followups=[
            FollowupRead.model_validate(followup, from_attributes=True)
            for followup in session.exec(
                select(Followup).where(Followup.status == "pending").order_by(Followup.id)
            )
        ],
        last_investigation_at=latest_crew_analysis,
        has_unanalyzed_measurements=session.exec(new_measurement.limit(1)).first() is not None,
    )
