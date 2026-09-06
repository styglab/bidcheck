from datetime import date
from time import monotonic

from fastapi import APIRouter, Query

from app.integrations.teoria import teoria_client
from app.services.teoria_adapter import objects_of

router = APIRouter()
_search_cache: dict[str, tuple[float, dict]] = {}
_SEARCH_CACHE_TTL_SECONDS = 600


@router.get("/search")
async def search_companies(q: str = Query(min_length=2, max_length=100)):
    cache_key = q.strip().lower()
    cached = _search_cache.get(cache_key)
    if cached and monotonic() - cached[0] < _SEARCH_CACHE_TTL_SECONDS:
        return cached[1]
    digits = "".join(ch for ch in q if ch.isdigit())
    if len(digits) == 10:
        data = await teoria_client.execute("get_company_procurement_profile", {"business_registration_number": digits}, max_objects=500, provenance=True)
    else:
        data = await teoria_client.execute("search_companies_by_name", {"company_name": q}, max_objects=100, provenance=True)
    businesses = objects_of(data, "business_registration")
    legal_entities = objects_of(data, "legal_entity")
    suppliers = objects_of(data, "procurement_supplier")
    by_id = {obj.get("id"): obj for obj in data.get("objects", [])}
    legal_by_business = {}
    address_by_legal = {}
    for link in data.get("links", []):
        if link.get("type") == "legal_entity_has_business_registration": legal_by_business[link.get("target")] = by_id.get(link.get("source"), {})
        elif link.get("type") == "legal_entity_has_address": address_by_legal[link.get("source")] = by_id.get(link.get("target"), {})
    items = []
    for obj in businesses:
        p = obj.get("properties", {})
        legal = legal_by_business.get(obj.get("id"), {}); lp = legal.get("properties", {}); address = address_by_legal.get(legal.get("id"), {}).get("properties", {})
        items.append({"id": obj.get("id"), "business_registration_number": p.get("business_registration_number"), "name": lp.get("legal_name") or p.get("business_name") or p.get("company_name") or p.get("name"), "properties": {**p, "corporate_registration_number": lp.get("corporate_registration_number"), "representative_names": lp.get("representative_names"), "full_address": address.get("full_address")}})
    if not items:
        for obj in legal_entities + suppliers:
            p = obj.get("properties", {})
            items.append({"id": obj.get("id"), "business_registration_number": p.get("business_registration_number"), "name": p.get("company_name") or p.get("business_name") or p.get("name"), "properties": p})
    result = {"items": items, "count": len(items), "truncated": data.get("truncated", False), "registry_version": data.get("registry", {}).get("version")}
    if len(_search_cache) >= 100:
        oldest_key = min(_search_cache, key=lambda key: _search_cache[key][0])
        _search_cache.pop(oldest_key, None)
    _search_cache[cache_key] = (monotonic(), result)
    return result


@router.get("/{business_number}/profile")
async def company_profile(business_number: str, reference_date: date | None = None):
    number = "".join(ch for ch in business_number if ch.isdigit())
    profile = await teoria_client.execute("get_company_procurement_profile", {"business_registration_number": number}, max_objects=500, provenance=True)
    qualifications = await teoria_client.execute("get_company_bid_qualification_profile", {"business_registration_number": number, "reference_date": (reference_date or date.today()).isoformat()}, max_objects=500, provenance=True)
    return {"business_registration": [x.get("properties", {}) for x in objects_of(profile, "business_registration")], "suppliers": [x.get("properties", {}) for x in objects_of(profile, "procurement_supplier")], "industries": [x.get("properties", {}) for x in objects_of(profile, "registered_industry")], "products": [x.get("properties", {}) for x in objects_of(profile, "registered_supply_product")], "sanctions": [x.get("properties", {}) for x in objects_of(profile, "procurement_sanction")], "qualifications": [x.get("properties", {}) for x in objects_of(qualifications, "qualification")], "direct_production": [x.get("properties", {}) for x in objects_of(qualifications, "direct_production_confirmation")], "partial": profile.get("truncated", False) or qualifications.get("truncated", False)}
