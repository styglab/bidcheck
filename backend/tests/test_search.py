import asyncio

from fastapi.testclient import TestClient

from app.api.v1 import search
from app.main import app


def test_suggest_keeps_notice_results_when_other_sources_time_out(monkeypatch):
    notice_inputs = []

    async def slow_organizations(**kwargs):
        await asyncio.sleep(0.05)
        return {"items": [{"organization_code": "late"}], "pagination": {}}

    async def slow_companies(**kwargs):
        await asyncio.sleep(0.05)
        return {"items": [{"business_registration_number": "0000000000"}], "count": 1}

    async def notices(**kwargs):
        notice_inputs.append(kwargs)
        await asyncio.sleep(0.02)
        return {
            "items": [{"id": "R26BK01759670:000", "name": "지능형 생활안정지원시스템 구축 사업"}],
            "pagination": {"total_items": 1},
        }

    original_safe = search._safe

    async def short_safe(coro, fallback, *, timeout=3.0):
        adjusted_timeout = 0.1 if timeout == search._NOTICE_SUGGEST_TIMEOUT_SECONDS else 0.01
        return await original_safe(coro, fallback, timeout=adjusted_timeout)

    monkeypatch.setattr(search, "search_organizations", slow_organizations)
    monkeypatch.setattr(search, "search_companies", slow_companies)
    monkeypatch.setattr(search, "search_notices", notices)
    monkeypatch.setattr(search, "_safe", short_safe)

    response = TestClient(app).get("/api/v1/search/suggest?q=지능형생활안정&limit=3")

    assert response.status_code == 200
    assert response.json()["organizations"] == []
    assert response.json()["companies"] == []
    assert response.json()["notices"] == [
        {"id": "R26BK01759670:000", "name": "지능형 생활안정지원시스템 구축 사업"}
    ]
    assert response.json()["total_counts"]["notices"] == 1
    assert notice_inputs[0]["lineage_mode"] == "grouped"
