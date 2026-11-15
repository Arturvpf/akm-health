"""AKM-30 canonical T01-T12 across real routes, SQLite, and local NASA artifacts."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import nasa_reference
from app.main import app
from app.models import Followup, Investigation, Measurement
from app.seed import seed


def rows(model):
    with Session(app.state.engine) as session:
        return session.exec(select(model)).all()


def post(client, **changes):
    body = dict(kind="co2_ppm", astronaut_id=None, value=850, unit="ppm",
                measured_at="2026-11-14T08:01:00Z", source="manual", quality="ok")
    return client.post("/api/measurements", json=body | changes)


def test_t01_t12_mvp_acceptance(tmp_path, monkeypatch, investigation_clock):
    database = tmp_path / "acceptance.db"
    monkeypatch.setenv("AKM_DB_PATH", str(database))
    monkeypatch.delenv("AKM_INVESTIGATION_CONFIG", raising=False)
    with TestClient(app) as client:
        # T01, T06: empty storage is explicit; GET cannot run the engine.
        for path in ("/api/health", "/docs", "/openapi.json"):
            assert client.get(path).status_code == 200
        schema = client.get("/openapi.json").json()
        assert schema["paths"]["/api/measurements"]["post"]["responses"]["201"]
        assert client.get("/api/dashboard").json()["astronauts"] == []
        empty = client.post("/api/investigations/run", json={"scope": "crew"}).json()
        assert empty["status"] == "insufficient_data"

        # T11: missing and corrupt NASA history never invent a fallback value.
        original_dir = nasa_reference.DATA_DIR
        isolated = tmp_path / "nasa"
        isolated.mkdir()
        (isolated / "hrp_catalog.json").write_bytes((original_dir / "hrp_catalog.json").read_bytes())
        monkeypatch.setattr(nasa_reference, "DATA_DIR", isolated)
        for content in (None, "[not-json]"):
            if content is not None:
                (isolated / "reference.json").write_text(content)
            response = client.get("/api/nasa/references")
            assert response.status_code == 200
            assert response.json()["historical_data_status"] == "not_imported"
            assert response.json()["historical_series"] == []
        monkeypatch.setattr(nasa_reference, "DATA_DIR", original_dir)

        # T02, T12: seed twice; NASA remains independent of the mission database.
        nasa_before = client.get("/api/nasa/references").json()
        assert nasa_before["historical_data_status"] == "imported"
        assert len(nasa_before["historical_series"]) == 864
        assert {x["mission_id"] for x in nasa_before["historical_series"]} == {"RR-1"}
        assert {x["parameter"] for x in nasa_before["historical_series"]} == {
            "co2_ppm", "temperature_c", "relative_humidity_pct"}
        assert all(x["source_url"].startswith("https://visualization.osdr.nasa.gov/")
                   and x["observed_at"].startswith("2014-10-01T")
                   for x in nasa_before["historical_series"])
        assert seed(app.state.engine) == (4, 29)
        assert seed(app.state.engine) == (0, 0)
        assert len(client.get("/api/astronauts").json()) == 4
        assert client.get("/api/nasa/references").json() == nasa_before
        assert {row.source for row in rows(Measurement)} == {"synthetic"}

        # T04: rejection must not change persisted counts.
        count = len(rows(Measurement))
        invalid = [
            (dict(kind="sleep_hours", astronaut_id="A1", unit="ppm"), 422),
            (dict(kind="sleep_hours", astronaut_id="A99", unit="h", value=6), 404),
            (dict(kind="mood_score", astronaut_id="A1", unit="score_1_to_5", value=6), 422),
            (dict(measured_at="2026-11-14T08:00:00"), 422),
            (dict(astronaut_id="A1"), 422),
        ]
        for changes, status in invalid:
            assert post(client, **changes).status_code == status
        raw = '{"kind":"co2_ppm","value":NaN,"unit":"ppm","measured_at":"2026-11-14T08:00:00Z","source":"manual"}'
        assert client.post("/api/measurements", content=raw,
                           headers={"Content-Type": "application/json"}).status_code == 422
        assert len(rows(Measurement)) == count

        # T03: form-compatible input normalizes UTC; recording does not run rules.
        before = len(rows(Investigation))
        sleep_response = post(client, kind="sleep_hours", astronaut_id="A4", value=7.9, unit="h",
                              measured_at="2026-11-14T04:01:00-03:00")
        assert sleep_response.status_code == 201
        sleep = sleep_response.json()
        assert sleep["measurement_zone"] == "astronaut"
        assert sleep["measured_at"] == "2026-11-14T07:01:00Z"
        assert sleep["source"] == "manual"
        assert any(x["id"] == sleep["id"] for x in client.get(
            "/api/measurements", params={"astronaut_id": "A4", "kind": "sleep_hours"}).json())
        assert len(rows(Investigation)) == before

        # T07: explicit analysis and replay have one result/check.
        first_response = client.post("/api/investigations/run", json={"scope": "crew"})
        assert first_response.status_code == 200
        first = first_response.json()
        assert first["status"] == "attention"
        assert all(x["certainty"] == "unconfirmed" for x in first["hypotheses"])
        first_counts = (len(rows(Investigation)), len(rows(Followup)))
        repeat = client.post("/api/investigations/run", json={"scope": "crew"}).json()
        assert repeat == first | {"reused": True}
        assert first_counts == (len(rows(Investigation)), len(rows(Followup)))
        assert client.get(f'/api/investigations/{first["id"]}').json() == first

        # T08/T05: new habitat observation is persistent but unanalyzed.
        investigation_clock[0] += timedelta(minutes=2)
        response = post(client)
        assert response.status_code == 201
        cabin = response.json()
        assert cabin["astronaut_id"] is None and cabin["measurement_zone"] == "habitat"
        assert client.get("/api/dashboard").json()["has_unanalyzed_measurements"] is True
        assert first_counts == (len(rows(Investigation)), len(rows(Followup)))

        # T09: incompatible, suspect and missing evidence do not complete the check.
        check_id = first["followup_id"]
        url = f"/api/followups/{check_id}"
        assert client.patch(url, json={"status": "completed"}).status_code == 422
        assert client.patch(url, json={"status": "completed", "measurement_id": sleep["id"]}).status_code == 422
        suspect = post(client, quality="suspect").json()
        assert client.patch(url, json={"status": "completed", "measurement_id": suspect["id"]}).status_code == 422
        assert next(x for x in client.get("/api/followups").json() if x["id"] == check_id)["status"] == "pending"

        # T10: compatible completion and replay; different evidence conflicts.
        completion = client.patch(url, json={"status": "completed", "measurement_id": cabin["id"]})
        assert completion.status_code == 200
        assert completion.json()["measurement_id"] == cabin["id"]
        assert completion.json()["completed_at"]
        assert client.patch(url, json={"status": "completed", "measurement_id": cabin["id"]}).json() == completion.json()
        another = post(client, value=851).json()
        assert client.patch(url, json={"status": "completed", "measurement_id": another["id"]}).status_code == 409
        updated = client.post("/api/investigations/run", json={"scope": "crew"}).json()
        assert updated["input_fingerprint"] != first["input_fingerprint"]
        assert client.get("/api/dashboard").json()["has_unanalyzed_measurements"] is False
        assert client.get("/api/nasa/references").json() == nasa_before
        # GET sweeps cannot mutate analysis/checks.
        after = (len(rows(Investigation)), len(rows(Followup)))
        for path in ("/api/dashboard", "/api/measurements", "/api/followups", "/api/nasa/references"):
            assert client.get(path).status_code == 200
        assert after == (len(rows(Investigation)), len(rows(Followup)))
        saved_id = updated["id"]

    # Startup against the same file recovers persisted evidence.
    with TestClient(app) as restarted:
        assert restarted.get(f"/api/investigations/{saved_id}").json()["id"] == saved_id
        assert any(x["measurement_id"] == cabin["id"] for x in restarted.get("/api/followups").json())


def test_t06_suspect_only_is_not_normal(tmp_path, monkeypatch, investigation_clock):
    monkeypatch.setenv("AKM_DB_PATH", str(tmp_path / "suspect.db"))
    monkeypatch.delenv("AKM_INVESTIGATION_CONFIG", raising=False)
    with TestClient(app) as client:
        seed(app.state.engine)
        with Session(app.state.engine) as session:
            for row in session.exec(select(Measurement)):
                row.quality = "suspect"
                session.add(row)
            session.commit()
        result = client.post("/api/investigations/run", json={"scope": "crew"}).json()
        assert result["status"] == "insufficient_data"
        assert result["hypotheses"] == []
        assert {x["quality"] for x in client.get("/api/measurements").json()} == {"suspect"}
