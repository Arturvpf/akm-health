"""Reproducible synthetic observations for the ODYSSEY-26 demonstration."""

import argparse
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from .db import make_engine, migrate
from .models import Astronaut, Measurement
from .schemas import AstronautRead, Kind, MeasurementCreate


PROFILES = (
    AstronautRead(id="A1", name="Aurora", role="Comando", baseline_sleep_hours=8.0),
    AstronautRead(id="A2", name="Orion", role="Engenharia", baseline_sleep_hours=7.5),
    AstronautRead(id="A3", name="Vega", role="Pesquisa", baseline_sleep_hours=8.0),
    AstronautRead(id="A4", name="Lyra", role="Operações", baseline_sleep_hours=7.8),
)
NIGHT_1 = datetime(2026, 11, 13, 7, tzinfo=timezone.utc)
NIGHT_2 = datetime(2026, 11, 14, 7, tzinfo=timezone.utc)


def observations() -> list[MeasurementCreate]:
    crew: list[MeasurementCreate] = []
    # Each row contains the two nights for sleep, heart rate and mood.
    for astronaut_id, sleep, heart_rate, mood in (
        ("A1", (5.2, 5.4), (72, 74), (4, 3)),
        ("A2", (5.6, 5.7), (68, 71), (4, 3)),
        ("A3", (5.3, 5.6), (75, 76), (3, None)),
        ("A4", (7.7, 7.9), (66, None), (4, 4)),
    ):
        for kind, unit, values in (
            (Kind.sleep_hours, "h", sleep),
            (Kind.heart_rate_bpm, "bpm", heart_rate),
            (Kind.mood_score, "score_1_to_5", mood),
        ):
            for measured_at, value in zip((NIGHT_1, NIGHT_2), values, strict=True):
                if value is not None:
                    crew.append(MeasurementCreate(
                        astronaut_id=astronaut_id,
                        kind=kind,
                        unit=unit,
                        value=value,
                        measured_at=measured_at,
                        source="synthetic",
                    ))

    habitat = []
    for measured_at, co2, temperature in (
        ("2026-11-12T20:00:00Z", 680, 22.1),
        ("2026-11-13T05:00:00Z", 950, 22.2),
        ("2026-11-14T05:00:00Z", 980, 22.2),
    ):
        habitat.extend((
            MeasurementCreate(
                kind=Kind.co2_ppm, unit="ppm", value=co2,
                measured_at=measured_at, source="synthetic",
            ),
            MeasurementCreate(
                kind=Kind.cabin_temp_c, unit="C", value=temperature,
                measured_at=measured_at, source="synthetic",
            ),
        ))

    habitat.append(MeasurementCreate(
        kind=Kind.co2_ppm, unit="ppm", value=2200,
        measured_at="2026-11-14T05:05:00Z", source="synthetic", quality="suspect",
    ))
    return crew + habitat


RECHECK = MeasurementCreate(
    kind=Kind.co2_ppm, unit="ppm", value=850,
    measured_at="2026-11-14T15:00:00Z", source="synthetic",
)


def insert_observation(
    session: Session, payload: MeasurementCreate, *, recorded_at: datetime | None = None
) -> bool:
    existing = session.exec(select(Measurement.id).where(
        Measurement.astronaut_id == payload.astronaut_id,
        Measurement.kind == payload.kind,
        Measurement.measured_at == payload.measured_at,
        Measurement.source == payload.source,
    ).limit(1)).first()
    if existing is not None:
        return False
    session.add(Measurement.from_payload(payload, recorded_at=recorded_at))
    return True


def seed(engine: Engine, *, with_recheck: bool = False) -> tuple[int, int]:
    data = observations()
    migrate(engine)
    profiles_added = 0
    observations_added = 0
    with Session(engine) as session, session.begin():
        # Serialize the existence checks with inserts, including NULL cabin subjects.
        session.exec(text("BEGIN IMMEDIATE"))
        for profile in PROFILES:
            if session.get(Astronaut, profile.id) is None:
                session.add(Astronaut.model_validate(profile.model_dump()))
                profiles_added += 1
        session.flush()
        for payload in data:
            observations_added += insert_observation(
                session, payload, recorded_at=payload.measured_at + timedelta(minutes=5),
            )
        if with_recheck:
            observations_added += insert_observation(session, RECHECK)
    return profiles_added, observations_added


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-recheck", action="store_true", help="Also register the optional CO₂ recheck.")
    args = parser.parse_args()
    engine = make_engine()
    try:
        profiles, measurements = seed(engine, with_recheck=args.with_recheck)
    finally:
        engine.dispose()
    print(f"ODYSSEY-26 (simulated): added {profiles} profiles and {measurements} measurements.")


if __name__ == "__main__":
    main()
