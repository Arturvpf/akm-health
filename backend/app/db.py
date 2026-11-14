"""Local SQLite connections and schema migration."""

import os
import sqlite3
from pathlib import Path

from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool
from sqlmodel import create_engine

from .models import Astronaut, Followup, Investigation, Measurement


SCHEMA_VERSION = 1
TABLES = (Astronaut.__table__, Measurement.__table__, Investigation.__table__, Followup.__table__)


def database_path() -> Path:
    default = Path(__file__).resolve().parents[1] / "akm.db"
    return Path(os.environ.get("AKM_DB_PATH", default)).resolve()


def connect(path: Path | None = None) -> sqlite3.Connection:
    database = path if path is not None else database_path()
    database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database, check_same_thread=False)
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def make_engine(path: Path | None = None) -> Engine:
    database = path if path is not None else database_path()
    return create_engine("sqlite://", creator=lambda: connect(database), poolclass=NullPool)


def migrate(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        version = connection.exec_driver_sql("PRAGMA user_version").scalar_one()
        if version == SCHEMA_VERSION:
            return
        if version != 0:
            raise RuntimeError(f"Unsupported AKM database schema version: {version}")
        existing_tables = {
            row[0] for row in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        if existing_tables.intersection(table.name for table in TABLES):
            raise RuntimeError("Unversioned database already contains AKM tables. Back it up before migration.")
        Astronaut.metadata.create_all(connection, tables=TABLES)
        connection.exec_driver_sql("PRAGMA user_version = 1")


if __name__ == "__main__":
    migrate(make_engine())
    print(f"AKM schema v{SCHEMA_VERSION} ready: {database_path()}")
