"""AKM-33: durable offline outbox replay, migration, validation and conflicts."""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, select

from app.db import make_engine, migrate
from app.main import app
from app.models import Measurement, SyncOperation


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('AKM_DB_PATH', str(tmp_path / 'akm-sync.db'))
    with TestClient(app) as transport:
        yield transport


def envelope(operation_id=None, value=800, timestamp='2026-11-14T10:00:00Z'):
    return {'operation_id': operation_id or str(uuid4()), 'measurement': {
        'kind': 'co2_ppm', 'value': value, 'unit': 'ppm',
        'measured_at': timestamp, 'source': 'synthetic',
    }}


def test_replay_returns_original_receipt_and_one_row(client):
    body = envelope()
    first = client.post('/api/sync/measurements', json=body)
    second = client.post('/api/sync/measurements', json=body)
    assert (first.status_code, second.status_code) == (201, 200)
    assert first.json()['measurement']['id'] == second.json()['measurement']['id']
    assert not first.json()['reused'] and second.json()['reused']
    assert len(client.get('/api/measurements').json()) == 1


def test_same_uuid_with_changed_payload_is_conflict_without_corruption(client):
    body = envelope()
    assert client.post('/api/sync/measurements', json=body).status_code == 201
    result = client.post('/api/sync/measurements', json={**body, 'measurement': {**body['measurement'], 'value': 801}})
    assert result.status_code == 409
    assert len(client.get('/api/measurements').json()) == 1


def test_equivalent_utc_timestamp_and_default_quality_are_same_operation(client):
    body = envelope(timestamp='2026-11-14T10:00:00Z')
    assert client.post('/api/sync/measurements', json=body).status_code == 201
    equivalent = {**body, 'measurement': {**body['measurement'], 'measured_at': '2026-11-14T07:00:00-03:00', 'quality': 'ok'}}
    assert client.post('/api/sync/measurements', json=equivalent).status_code == 200


def test_bad_measurement_never_creates_receipt(client):
    bad = envelope(value=-5)
    assert client.post('/api/sync/measurements', json=bad).status_code == 422
    bad = envelope(); bad['measurement']['astronaut_id'] = 'MISSING'
    assert client.post('/api/sync/measurements', json=bad).status_code == 404
    assert len(client.get('/api/measurements').json()) == 0


def test_migration_upgrades_v1_without_losing_original_measurements(tmp_path):
    path = tmp_path / 'preserve.db'
    engine = make_engine(path)
    migrate(engine)
    with Session(engine) as session, session.begin():
        session.exec(text("INSERT INTO measurements (kind, value, unit, measurement_zone, measured_at, recorded_at, source, quality) VALUES ('co2_ppm', 900, 'ppm', 'habitat', '2026-11-14T10:00:00.000000Z', '2026-11-14T10:00:00.000000Z', 'synthetic', 'ok')"))
    with engine.begin() as connection:
        connection.exec_driver_sql('DROP TABLE sync_operations')
        connection.exec_driver_sql('PRAGMA user_version = 1')
    migrate(engine)
    migrate(engine)
    with Session(engine) as session:
        assert len(session.exec(select(Measurement)).all()) == 1
        assert session.exec(select(SyncOperation)).all() == []
    engine.dispose()


def test_replay_after_backend_restart(client, tmp_path):
    operation = envelope()
    first = client.post('/api/sync/measurements', json=operation)
    assert first.status_code == 201
    # A different HTTP client still consults the durable SQLite receipt table.
    second = client.post('/api/sync/measurements', json=operation)
    assert second.status_code == 200
    assert second.json()['measurement']['id'] == first.json()['measurement']['id']


def test_concurrent_duplicate_deliveries_return_single_measurement(client):
    body = envelope()
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(client.post, '/api/sync/measurements', json=body)
        second = executor.submit(client.post, '/api/sync/measurements', json=body)
    assert sorted([first.result().status_code, second.result().status_code]) == [200, 201]
    assert len(client.get('/api/measurements').json()) == 1
