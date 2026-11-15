"""Loopback-only, disposable AKM-30 fixture. Never changes the production clock/database."""
import argparse
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--empty", action="store_true")
    parser.add_argument("--database", type=Path, help="New disposable database path supplied by the test runner")
    args = parser.parse_args()
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    import uvicorn
    from sqlmodel import Session, select
    from app.db import make_engine, migrate
    from app.models import Measurement
    from app.seed import seed

    if args.database and args.database.exists():
        parser.error("Acceptance database must not already exist")
    context = nullcontext(args.database.parent) if args.database else TemporaryDirectory(prefix="akm30-")
    with context as directory:
        os.environ["AKM_DB_PATH"] = str(args.database.resolve() if args.database else Path(directory) / "mission.db")
        os.environ.pop("AKM_INVESTIGATION_CONFIG", None)
        engine = make_engine()
        try:
            migrate(engine)
            if not args.empty:
                seed(engine)
                # Explicitly synthetic fixture: preserve relative intervals, move it into today's window.
                anchor = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
                shift = datetime.now(timezone.utc) - timedelta(minutes=2) - anchor
                with Session(engine) as session:
                    for row in session.exec(select(Measurement)):
                        row.measured_at += shift
                        row.recorded_at += shift
                        session.add(row)
                    session.commit()
        finally:
            engine.dispose()
        uvicorn.run("app.main:app", host="127.0.0.1", port=args.port, log_level="warning")

if __name__ == "__main__":
    main()
