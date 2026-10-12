from fastapi.testclient import TestClient

from app.main import app
from app.services import search_service
from app.services.cache import TTLCache


def test_cache_expires_entries_and_bounds_storage():
    now = [0.0]
    cache = TTLCache(2, 10, clock=lambda: now[0])
    cache.set("first", 1)
    cache.set("second", 2)
    cache.set("third", 3)
    assert cache.get("first") is None
    assert cache.get("second") == 2
    now[0] = 11
    cache.set("fresh", 4)
    assert cache.get("third") is None
    assert cache.get("fresh") == 4
    assert len(cache._entries) == 1


def test_company_award_search_uses_bounded_cache(monkeypatch):
    cache = TTLCache(2, 600)
    monkeypatch.setattr(search_service, "_search_cache", cache)
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(inputs["query"])
        return {
            "objects": [
                {
                    "type": "bid_award",
                    "properties": {
                        "winner_business_registration_number": "1234567890",
                        "winner_name": inputs["query"],
                    },
                }
            ],
            "truncated": True,
        }

    monkeypatch.setattr(search_service.teoria_client, "execute", execute)
    client = TestClient(app)
    for query in ["업체가", "업체나", "업체다", "업체가"]:
        response = client.get("/api/v1/companies/search", params={"q": query})
        assert response.status_code == 200
        assert response.json()["truncated"] is True
    assert len(calls) == 4
    assert len(cache._entries) == 2
