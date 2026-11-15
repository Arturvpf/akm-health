"""Read the current mission snapshot without running an investigation."""

from collections import defaultdict
from datetime import datetime
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import aliased
from sqlmodel import Session, select

from .alerts import alert_legend
from .agenda import pending_followups
from .investigations import stored_document
from .models import Astronaut, Investigation, Measurement
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
    astronauts = session.exec(select(Astronaut).order_by(Astronaut.id)).all()
    analyses = session.exec(select(Investigation).order_by(
        Investigation.created_at.desc(), Investigation.id.desc(),
    )).all()
    statuses = {}
    alerts = []
    seen_crew = False
    last_investigation_at = None
    coverage: dict[str | None, set[int] | datetime] = {}
    styles = {style.status: style for style in alert_legend()}
    for row in analyses:
        try:
            result, audit = stored_document(row)
        except (ValueError, KeyError, TypeError):
            # Older development fixtures have no result payload to project.
            result, audit = None, {}
            if row.scope == "individual":
                continue
        if last_investigation_at is None:
            last_investigation_at = row.created_at
        snapshot = audit.get("snapshot")
        if row.scope == "individual":
            targets = (row.astronaut_id, None)
        else:
            subjects = (member["id"] for member in snapshot["astronauts"]) if snapshot else (
                astronaut.id for astronaut in astronauts
            )
            targets = (*subjects, None)
        # The first entry for each target is its newest relevant input snapshot.
        # Individual analysis covers its subject and the habitat, never other crew.
        if snapshot is not None:
            audited_ids = defaultdict(set)
            for sample in snapshot["measurements"]:
                if sample["quality"] == "ok":
                    audited_ids[sample["astronaut_id"]].add(sample["id"])
            for target in targets:
                coverage.setdefault(target, audited_ids[target])
        else:
            # Legacy records have no IDs; keep their registration-time comparison.
            for target in targets:
                coverage.setdefault(target, row.created_at)
        if result is None:
            continue
        if row.scope == "individual":
            active_alert = row.astronaut_id not in statuses
            statuses.setdefault(row.astronaut_id, result.status)
        else:
            active_alert = not seen_crew
            seen_crew = True
            # A collective status is not the status of every crew member.
            for subject in audit.get("detection", {}).get("individual_results", []):
                statuses.setdefault(subject["astronaut_id"], subject["status"])
        if active_alert and result.status != "normal":
            alerts.append(DashboardAlert(
                id=result.id, level=result.status, label=styles[result.status].label,
                explanation=" ".join(result.findings),
            ))
    has_unanalyzed = False
    for id, target, recorded_at in session.exec(select(
        Measurement.id, Measurement.astronaut_id, Measurement.recorded_at,
    ).where(Measurement.quality == "ok")):
        covered = coverage.get(target)
        if covered is None or (recorded_at > covered if isinstance(covered, datetime) else id not in covered):
            has_unanalyzed = True
            break

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
            source=measurement.source,
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
            for astronaut in astronauts
        ],
        environment=HabitatSnapshot(
            co2_ppm=co2.value if co2 else None,
            cabin_temp_c=temperature.value if temperature else None,
            measured_at=max((sample.measured_at for sample in habitat.values()), default=None),
            measurement_zone="habitat",
            latest_metrics=habitat,
        ),
        alerts=alerts,
        pending_followups=[
            FollowupRead.model_validate(followup, from_attributes=True)
            for followup in pending_followups(session)
        ],
        last_investigation_at=last_investigation_at,
        has_unanalyzed_measurements=has_unanalyzed,
    )
