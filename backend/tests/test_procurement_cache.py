import asyncio

import pytest

from app.integrations.teoria import teoria_client
from app.services import procurement_cache
from app.services.cache import AsyncTTLCache


def test_concurrent_readers_share_work_and_return_independent_values():
    async def run():
        cache = AsyncTTLCache(2, 10)
        entered = asyncio.Event()
        release = asyncio.Event()
        calls = []

        async def load():
            calls.append(True)
            entered.set()
            await release.wait()
            return {"items": [1]}

        first = asyncio.create_task(cache.get_or_load("key", load))
        await entered.wait()
        second = asyncio.create_task(cache.get_or_load("key", load))
        release.set()
        left, right = await asyncio.gather(first, second)
        left["items"].append(2)
        assert right == {"items": [1]}
        assert await cache.get_or_load("key", load) == {"items": [1]}
        assert calls == [True]

    asyncio.run(run())


def test_cancelled_reader_does_not_cancel_other_reader():
    async def run():
        cache = AsyncTTLCache(2, 10)
        entered, release = asyncio.Event(), asyncio.Event()
        calls = []

        async def load():
            calls.append(True)
            entered.set()
            await release.wait()
            return {"value": 1}

        first = asyncio.create_task(cache.get_or_load("key", load))
        await entered.wait()
        second = asyncio.create_task(cache.get_or_load("key", load))
        first.cancel()
        with pytest.raises(asyncio.CancelledError):
            await first
        release.set()
        assert await second == {"value": 1}
        assert calls == [True]

    asyncio.run(run())


def test_failed_refresh_keeps_previous_snapshot_but_does_not_cache_error():
    async def run():
        now = [0]
        cache = AsyncTTLCache(2, 10, clock=lambda: now[0])
        cache.set("key", {"partial": True})
        calls = []

        async def fail():
            calls.append(True)
            raise ValueError("unavailable")

        with pytest.raises(ValueError):
            await cache.get_or_load("key", fail, refresh=True)
        assert await cache.get_or_load("key", fail) == {"partial": True}
        now[0] = 11
        with pytest.raises(ValueError):
            await cache.get_or_load("key", fail)
        assert calls == [True, True]
        assert cache.get("key") is None

    asyncio.run(run())


def test_runtime_read_cache_separates_filters_and_never_caches_assessments(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs, options))
        return {"outcome": {"summary": {}}, "truncated": False}

    monkeypatch.setattr(teoria_client, "execute", execute)

    async def run():
        for field in ["A", "A", "B"]:
            await procurement_cache.cached_runtime_read(
                "analyze_company_procurement_profile",
                {"business_registration_number": "1234567890", "field_code": field},
                max_objects=500,
            )
        for _ in range(2):
            await procurement_cache.cached_runtime_read("assess_company_bid_eligibility", {})

    asyncio.run(run())
    assert len(calls) == 4


def test_partial_runtime_results_expire_earlier_and_keep_truncation(monkeypatch):
    now = [0]
    cache = AsyncTTLCache(2, 300, clock=lambda: now[0])
    monkeypatch.setattr(procurement_cache, "_runtime_read_cache", cache)
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(True)
        return {"outcome": {"summary": {}}, "truncated": True}

    monkeypatch.setattr(teoria_client, "execute", execute)

    async def run():
        first = await procurement_cache.cached_runtime_read(
            "analyze_company_procurement_profile", {}
        )
        assert first["truncated"] is True
        now[0] = 59
        await procurement_cache.cached_runtime_read("analyze_company_procurement_profile", {})
        assert len(calls) == 1
        now[0] = 61
        await procurement_cache.cached_runtime_read("analyze_company_procurement_profile", {})
        assert len(calls) == 2

    asyncio.run(run())


def test_snapshot_read_does_not_wait_for_background_refresh():
    async def run():
        cache = AsyncTTLCache(2, 30)
        cache.set("snapshot", {"generation": 1, "partial": True})
        entered, release = asyncio.Event(), asyncio.Event()

        async def refresh():
            entered.set()
            await release.wait()
            return {"generation": 2, "partial": False}

        task = asyncio.create_task(cache.get_or_load("snapshot", refresh, refresh=True))
        await entered.wait()
        assert await asyncio.wait_for(cache.get_or_load("snapshot", refresh), 0.1) == {
            "generation": 1,
            "partial": True,
        }
        release.set()
        assert await task == {"generation": 2, "partial": False}
        assert cache.get("snapshot")["generation"] == 2

    asyncio.run(run())


def test_explicit_year_range_reuses_analysis_between_index_and_detail(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(inputs)
        return {"outcome": {"summary": {"contract_event_count": 7}}}

    monkeypatch.setattr(teoria_client, "execute", execute)

    async def run():
        inputs = {
            "business_registration_number": "1234567890",
            "period_from_year": 2025,
            "period_to_year": 2025,
            "target_year": 2025,
            "page": 1,
            "page_size": 20,
        }
        await procurement_cache.cached_runtime_read(
            "analyze_company_procurement_profile", {**inputs, "period_years": 1}, max_objects=500
        )
        result = await procurement_cache.cached_runtime_read(
            "analyze_company_procurement_profile", {**inputs, "period_years": 5}, max_objects=500
        )
        assert result["outcome"]["summary"]["contract_event_count"] == 7
        assert len(calls) == 1
        await procurement_cache.cached_runtime_read(
            "analyze_company_procurement_profile",
            {**inputs, "period_from_year": 2024},
            max_objects=500,
        )
        assert len(calls) == 2

    asyncio.run(run())
