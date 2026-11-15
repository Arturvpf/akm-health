from datetime import datetime, timezone

import pytest

from app import investigations, models


@pytest.fixture
def investigation_clock(monkeypatch):
    clock = [datetime(2026, 11, 14, 8, tzinfo=timezone.utc)]

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock[0].astimezone(tz) if tz else clock[0].replace(tzinfo=None)

    monkeypatch.setattr(investigations, "utc_now", lambda: clock[0])
    monkeypatch.setattr(models, "datetime", FrozenDatetime)
    return clock