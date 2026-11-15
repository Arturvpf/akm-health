"""Vercel entry point for the AKM Health API.

The same FastAPI application used locally runs here as a Python function. Vercel's
filesystem is read-only except for /tmp, so the demo database lives in /tmp and is
seeded with the simulated ODYSSEY-26 crew on a cold start. That makes this deployment
a stateless demo: data written through the API lasts only as long as the function
instance stays warm. Use the local setup (see README) for persistent data.
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("AKM_DB_PATH", "/tmp/akm-demo.db")

from datetime import datetime, timedelta, timezone  # noqa: E402

from sqlmodel import Session, select  # noqa: E402

from app.db import make_engine, migrate  # noqa: E402
from app.investigations import load_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Measurement  # noqa: E402
from app.seed import DEMO_ANCHOR, seed  # noqa: E402


def prepare_demo_database() -> None:
    engine = make_engine()
    migrate(engine)
    with Session(engine) as session:
        seeded = session.exec(select(Measurement.id).where(Measurement.source == "synthetic").limit(1)).first()
    if seeded is None:
        now = datetime.now(timezone.utc).replace(microsecond=0)
        seed(engine, shift=now - timedelta(minutes=2) - DEMO_ANCHOR)
    # Serverless hosts do not always run ASGI lifespan events, so wire the state here too.
    app.state.engine = engine
    app.state.investigation_settings = load_settings()


prepare_demo_database()
