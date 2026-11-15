"""Read the current mission snapshot without running an investigation."""

from collections import defaultdict
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import aliased
from sqlmodel import Session, select

from .alerts import alert_legend
from .investigations import stored_document
from .models import Astronaut, Followup, Investigation, Measurement
from .schemas import (
    AstronautDashboardRead,
    DashboardResponse,
    DashboardAlert,
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
    analyses = session.exec(select(Investigation).order_by(
        Investigation.created_at.desc(), Investigation.id.desc(),
    )).all()
    latest_crew = next((row for row in analyses if row.scope == "crew"), None)
    latest_crew_analysis = latest_crew.created_at if latest_crew else None
    statuses = {}
    alerts = []
    seen_scopes = set()
    audited_ids = None
    styles = {style.status: style for style in alert_legend()}
    for row in analyses:
        try:
            result, audit = stored_document(row)
        except (ValueError, KeyError, TypeError):
            # Older development fixtures have no result payload to project.
            continue
        if row is latest_crew and "snapshot" in audit:
            audited_ids = {sample["id"] for sample in audit["snapshot"]["measurements"]
                           if sample["quality"] == "ok"}
        key = (row.scope, row.astronaut_id)
        if key not in seen_scopes:
            seen_scopes.add(key)
            if result.status != "normal":
                alerts.append(DashboardAlert(
                    id=result.id, level=result.status, label=styles[result.status].label,
                    explanation=" ".join(result.findings),
                ))
        if row.scope == "individual":
            statuses.setdefault(row.astronaut_id, result.status)
        else:
            # A collective status is not the status of every crew member.
            for subject in audit.get("detection", {}).get("individual_results", []):
                statuses.setdefault(subject["astronaut_id"], subject["status"])
    new_measurement = select(Measurement.id).where(Measurement.quality == "ok")
    if latest_crew_analysis is not None:
        new_measurement = new_measurement.where(Measurement.recorded_at > latest_crew_analysis)
    if audited_ids is not None:
        # Also catches late commits and equal timestamps that were absent from the snapshot.
        new_measurement = select(Measurement.id).where(
            Measurement.quality == "ok", Measurement.id.not_in(audited_ids),
        )

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
                status=statuses.get(astronaut.id, "insufficient_data"),
            )
            for astronaut in session.exec(select(Astronaut).order_by(Astronaut.id))
        ],
        environment=HabitatSnapshot(
            co2_ppm=co2.value if co2 else None,
            cabin_temp_c=temperature.value if temperature else None,
            measured_at=max((sample.measured_at for sample in habitat.values()), default=None),
            measurement_zone="habitat",
        ),
        alerts=alerts,
        pending_followups=[
            FollowupRead.model_validate(followup, from_attributes=True)
            for followup in session.exec(
                select(Followup).where(Followup.status == "pending").order_by(Followup.id)
            )
        ],
        last_investigation_at=latest_crew_analysis,
        has_unanalyzed_measurements=session.exec(new_measurement.limit(1)).first() is not None,
    )
