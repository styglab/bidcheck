import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.request_timeout import RequestTimeoutMiddleware
from app.core.config import settings


def test_whole_api_request_is_cancelled_at_deadline(monkeypatch):
    monkeypatch.setattr(settings, "api_timeout_seconds", 0.03)
    app = FastAPI()
    app.add_middleware(RequestTimeoutMiddleware)
    cancelled = []

    @app.get("/api/v1/slow")
    async def slow():
        try:
            # Includes more than one orchestration step under the same deadline.
            await asyncio.sleep(0.01)
            await asyncio.sleep(1)
        finally:
            cancelled.append(True)
        return {"done": True}

    response = TestClient(app).get("/api/v1/slow")
    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "request_timeout"
    assert cancelled == [True]


def test_health_check_is_independent_of_api_deadline(monkeypatch):
    monkeypatch.setattr(settings, "api_timeout_seconds", 0.005)
    app = FastAPI()
    app.add_middleware(RequestTimeoutMiddleware)

    @app.get("/health")
    async def health():
        await asyncio.sleep(0.01)
        return {"status": "ok"}

    assert TestClient(app).get("/health").status_code == 200


def test_application_timeout_error_is_not_misclassified(monkeypatch):
    monkeypatch.setattr(settings, "api_timeout_seconds", 1)
    app = FastAPI()
    app.add_middleware(RequestTimeoutMiddleware)

    @app.get("/api/v1/error")
    async def error():
        raise TimeoutError("application failure")

    assert TestClient(app, raise_server_exceptions=False).get("/api/v1/error").status_code == 500
