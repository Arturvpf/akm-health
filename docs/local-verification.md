# AKM Health — AKM-02 | Local execution evidence (2026-11-14)

This is the historical smoke run from commit `aa14050`. For the current procedure, see [EP-01 local verification](ep-01-foundation-and-architecture.md#verificação-local), the [README](../README.md), and the [database notes](database.md).

Scope: architecture smoke test only. This does not mean the full MVP is implemented.

## How to reproduce

    cd backend
    python -m venv .venv
    # activate your platform-specific .venv
    pip install -r requirements.txt
    python -m pytest -q
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

For a minimal smoke-only environment: pip install -r requirements-smoke.txt.

Verify /api/health, /docs, /openapi.json. The private /api/_contract/validate-measurement is only a schema test route; the 10 business routes have not been implemented yet.

## Checked locally in an isolated container

- Python 3.13.5, FastAPI 0.128.2, Pydantic 2.13.5, Pytest 9.0.2, Uvicorn 0.48.0, Node 22.16.0.
- cd backend && python -m pytest -q: **23 passed in 0.30s**.
- FastAPI /api/health -> 200, /docs -> 200, /openapi.json -> 200.
- SQLite temporary database created; foreign keys enabled; INSERT/SELECT persisted.

## Limits and blockers

- SQLModel package unavailable locally; its installation failed due to restricted DNS/network. SQLModel ORM and SQLModel-backed models NOT verified.
- React/Vite actual app and npm dependencies NOT installed or tested.
- Business endpoints, full seeded database, real NASA file import, integration tests and no-network browser operation NOT verified.

Thus AKM-02 execution proof is **partial**, AKM-03 data contracts are **technically reviewed** but API business implementation and sign-off are pending. Do not mark AKM-17/18/19/20 done. Offline means server on local machine after dependencies are installed; not independent mobile browser offline.
