"""SQLite connectivity smoke check; SQLModel persistence belongs to AKM-17."""
import os
import sqlite3
from pathlib import Path

def connect():
    database = Path(os.environ.get("AKM_DB_PATH", str(Path(__file__).resolve().parents[1] / "akm.db")))
    database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database)
    connection.execute("PRAGMA foreign_keys = ON")
    return connection
