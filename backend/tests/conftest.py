import pytest

from app.api.v1 import bids
from app.services import search_service


@pytest.fixture(autouse=True)
def isolate_runtime_caches():
    caches = (
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
