"""Reuse read-only procurement analysis without caching eligibility decisions."""

import json

from app.integrations.teoria import teoria_client
from app.services.cache import AsyncTTLCache

_runtime_read_cache = AsyncTTLCache(max_entries=256, ttl=300)
CACHEABLE = {
    "search_public_procurement_contracts",
    "get_bid_notice",
    "search_public_organizations",
    "search_bid_awards",
    "analyze_company_procurement_profile",
    "analyze_organization_procurement_profile",
    "get_organization_company_relationship",
    "analyze_company_competitors",
    "search_organization_supplier_entries",
    "search_procurement_activity",
    "search_bid_participations",
    "get_bid_notice_relationship_context",
    "analyze_bid_participation_context",
    "get_procurement_classification_catalog",
    "autocomplete_procurement_entities",
    "get_procurement_network",
    "analyze_procurement_field_market",
    "get_procurement_region_filter_options",
}


async def cached_runtime_read(capability: str, inputs: dict, **options) -> dict:
    if capability not in CACHEABLE:
        return await teoria_client.execute(capability, inputs, **options)
    cache_inputs = dict(inputs)
    # With an explicit year range, period_years does not change the Runtime analysis.
    if (
        cache_inputs.get("period_from_year") is not None
        and cache_inputs.get("period_to_year") is not None
    ):
        cache_inputs.pop("period_years", None)
    key = (
        capability,
        json.dumps(cache_inputs, sort_keys=True),
        json.dumps(options, sort_keys=True),
    )

    async def load():
        return await teoria_client.execute(capability, inputs, **options)

    def ttl_for(data):
        # Missing source coverage remains visible; it is not a failed analysis.
        return 60 if data.get("truncated") else 300

    return await _runtime_read_cache.get_or_load(key, load, ttl_for=ttl_for)
