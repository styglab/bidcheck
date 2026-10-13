import pytest

from app.api.v1 import bids
from app.services import (
    company_discovery_service,
    procurement_cache,
    relationship_service,
    search_service,
)


@pytest.fixture(autouse=True)
def isolate_runtime_caches():
    caches = (
        procurement_cache._runtime_read_cache,
        company_discovery_service._sector_cache,
        relationship_service._relationship_cache,
        search_service._notice_search_cache,
        search_service._search_cache,
        bids._market_context_cache,
        bids._organization_field_company_cache,
    )
    for cache in caches:
        cache.clear()
    yield
    for cache in caches:
        cache.clear()
