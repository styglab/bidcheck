import asyncio

from fastapi.testclient import TestClient

from app import main


def test_snapshot_warmup_does_not_block_startup_and_is_cancelled_on_shutdown(monkeypatch):
    events = []

    async def refresh():
        events.append("started")
        try:
            await asyncio.Future()
        finally:
            events.append("cancelled")

    monkeypatch.setattr(main, "refresh_discovery_snapshots", refresh)
    with TestClient(main.app) as client:
        assert client.get("/health").status_code == 200
        assert events == ["started"]
    assert events == ["started", "cancelled"]
