import asyncio
import math
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

from app.integrations.teoria import teoria_client
from app.services.cache import TTLCache
from app.services.teoria_adapter import award, notice, objects_of, organization

_notice_search_cache = TTLCache(200, 60)
_search_cache = TTLCache(100, 600)


async def search_notices(
    q: str | None = None,
    published_from: datetime | None = None,
    published_to: datetime | None = None,
    deadline_from: datetime | None = None,
    deadline_to: datetime | None = None,
    contract_method: str | None = None,
    work_type: str | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    notice_organization_code: str | None = None,
    demand_organization_code: str | None = None,
    large_category: str | None = None,
    middle_category: str | None = None,
    field_code: str | None = None,
    include_history: bool = False,
    lineage_mode: str = "grouped",
    sort: str = "published_desc",
    page: int = 1,
    page_size: int = 20,
):
    cache_key = (
        q,
        published_from,
        published_to,
        deadline_from,
        deadline_to,
        contract_method,
        work_type,
        price_min,
        price_max,
        notice_organization_code,
        demand_organization_code,
        large_category,
        middle_category,
        field_code,
        include_history,
        lineage_mode,
        sort,
        page,
        page_size,
    )
    cached = _notice_search_cache.get(cache_key)
    if cached is not None:
        return cached
    end = published_to or datetime.now(UTC)
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    start = published_from or end - timedelta(days=365 * 5 if include_history else 90)
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    inputs = {
        "notice_published_at_from": start.isoformat(),
        "notice_published_at_to": end.isoformat(),
        "sort": sort,
        "page": page,
        "page_size": page_size,
        "lineage_mode": lineage_mode,
    }
    if not include_history:
        inputs["bid_statuses"] = ["scheduled", "open", "unknown"]
        inputs["notice_status"] = "active"
    if work_type == "none":
        return {
            "items": [],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_items": 0,
                "total_pages": 0,
            },
            "truncated": False,
            "registry_version": None,
        }
    work_types = list(dict.fromkeys(work_type.split(","))) if work_type else []
    optional = {
        "query": q,
        "bid_deadline_at_from": deadline_from.isoformat() if deadline_from else None,
        "bid_deadline_at_to": deadline_to.isoformat() if deadline_to else None,
        "contract_method_name": contract_method,
        "estimated_price_min": price_min,
        "estimated_price_max": price_max,
        "notice_organization_code": notice_organization_code,
        "demand_organization_code": demand_organization_code,
        "large_category": large_category,
        "middle_category": middle_category,
        "field_code": field_code,
    }
    inputs.update({key: value for key, value in optional.items() if value not in (None, "")})
    if len(work_types) <= 1:
        if work_types:
            inputs["work_type"] = work_types[0]
        data = await teoria_client.execute(
            "search_bid_notices", inputs, max_objects=min(page_size * 5, 1000)
        )
        items = [notice(obj) for obj in objects_of(data, "bid_notice")]
        pagination = data.get("pagination") or {
            "page": page,
            "page_size": page_size,
            "total_items": len(items),
            "total_pages": 1 if items else 0,
        }
        response = {
            "items": items,
            "pagination": pagination,
            "truncated": data.get("truncated", False),
            "registry_version": data.get("registry", {}).get("version"),
        }
        _notice_search_cache.set(cache_key, response)
        return response
    needed = page * page_size
    source_page_size = min(needed, 100)

    async def fetch_type(value: str) -> list[dict]:
        collected: list[dict] = []
        requested_pages = math.ceil(needed / source_page_size)
        for source_page in range(1, requested_pages + 1):
            grouped_inputs = {
                **inputs,
                "work_type": value,
                "page": source_page,
                "page_size": source_page_size,
            }
            result = await teoria_client.execute(
                "search_bid_notices", grouped_inputs, max_objects=min(source_page_size * 5, 1000)
            )
            collected.append(result)
            if source_page >= (result.get("pagination") or {}).get("total_pages", 1):
                break
        return collected

    grouped = await asyncio.gather(*(fetch_type(value) for value in work_types))
    results = [result for group in grouped for result in group]
    by_id = {}
    for result in results:
        for obj in objects_of(result, "bid_notice"):
            item = notice(obj)
            by_id[item["id"]] = item
    if sort == "deadline_asc":
        items = sorted(
            by_id.values(), key=lambda item: (item.get("deadline_at") or "9999-12-31", item["id"])
        )
    else:
        items = sorted(
            by_id.values(),
            key=lambda item: (item.get("published_at") or "", item["id"]),
            reverse=True,
        )
    start_index = (page - 1) * page_size
    total_items = sum(
        (group[0].get("pagination") or {}).get("total_items", 0) for group in grouped if group
    )
    response = {
        "items": items[start_index : start_index + page_size],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": math.ceil(total_items / page_size),
        },
        "truncated": any(result.get("truncated", False) for result in results),
        "registry_version": next(
            (
                result.get("registry", {}).get("version")
                for result in results
                if result.get("registry")
            ),
            None,
        ),
    }
    _notice_search_cache.set(cache_key, response)
    return response


async def search_companies(q: str):
    cache_key = q.strip().lower()
    cached = _search_cache.get(cache_key)
    if cached is not None:
        return cached
    digits = "".join(ch for ch in q if ch.isdigit())
    if len(digits) == 10:
        data = await teoria_client.execute(
            "get_company_procurement_profile",
            {"business_registration_number": digits},
            max_objects=500,
            provenance=True,
        )
    else:
        now = datetime.now(UTC)
        awards = await teoria_client.execute(
            "search_bid_awards",
            {
                "query": q.strip(),
                "opening_at_from": (now - timedelta(days=1095)).isoformat(),
                "opening_at_to": now.isoformat(),
                "page": 1,
                "page_size": 100,
            },
            max_objects=400,
        )
        normalized = q.strip().lower().replace(" ", "")
        procurement_items: dict[str, dict] = {}
        for obj in objects_of(awards, "bid_award"):
            item = award(obj)
            name = item.get("company_name") or ""
            number = item.get("company_number")
            if number and normalized in name.lower().replace(" ", ""):
                procurement_items[number] = {
                    "id": f"business-registration:{number}",
                    "business_registration_number": number,
                    "name": name,
                    "properties": {
                        "business_registration_number": number,
                        "source": "procurement_award",
                    },
                }
        if procurement_items:
            result = {
                "items": list(procurement_items.values()),
                "count": len(procurement_items),
                "truncated": bool(awards.get("truncated"))
                or awards.get("pagination", {}).get("total_items", 0) > 100,
                "registry_version": awards.get("registry", {}).get("version"),
            }
            _search_cache.set(cache_key, result)
            return result
        try:
            data = await asyncio.wait_for(
                teoria_client.execute(
                    "search_companies_by_name", {"company_name": q}, max_objects=30
                ),
                timeout=5,
            )
        except TimeoutError as exc:
            raise HTTPException(
                504,
                detail={
                    "code": "company_search_timeout",
                    "message": "업체명 조회가 지연되고 있습니다. 상호를 더 구체적으로 입력해 주세요.",
                },
            ) from exc
    businesses = objects_of(data, "business_registration")
    legal_entities = objects_of(data, "legal_entity")
    suppliers = objects_of(data, "procurement_supplier")
    by_id = {obj.get("id"): obj for obj in data.get("objects", [])}
    legal_by_business = {}
    address_by_legal = {}
    for link in data.get("links", []):
        if link.get("type") == "legal_entity_has_business_registration":
            legal_by_business[link.get("target")] = by_id.get(link.get("source"), {})
        elif link.get("type") == "legal_entity_has_address":
            address_by_legal[link.get("source")] = by_id.get(link.get("target"), {})
    items = []
    for obj in businesses:
        p = obj.get("properties", {})
        legal = legal_by_business.get(obj.get("id"), {})
        lp = legal.get("properties", {})
        address = address_by_legal.get(legal.get("id"), {}).get("properties", {})
        items.append(
            {
                "id": obj.get("id"),
                "business_registration_number": p.get("business_registration_number"),
                "name": lp.get("legal_name")
                or p.get("business_name")
                or p.get("company_name")
                or p.get("name"),
                "properties": {
                    **p,
                    "corporate_registration_number": lp.get("corporate_registration_number"),
                    "representative_names": lp.get("representative_names"),
                    "full_address": address.get("full_address"),
                },
            }
        )
    if not items:
        for obj in legal_entities + suppliers:
            p = obj.get("properties", {})
            items.append(
                {
                    "id": obj.get("id"),
                    "business_registration_number": p.get("business_registration_number"),
                    "name": p.get("company_name") or p.get("business_name") or p.get("name"),
                    "properties": p,
                }
            )
    result = {
        "items": items,
        "count": len(items),
        "truncated": data.get("truncated", False),
        "registry_version": data.get("registry", {}).get("version"),
    }
    _search_cache.set(cache_key, result)
    return result


async def search_organizations(
    q: str | None = None, organization_code: str | None = None, page: int = 1, page_size: int = 20
):
    inputs = {"page": page, "page_size": page_size}
    if q:
        inputs["query"] = q
    if organization_code:
        inputs["organization_code"] = organization_code
    data = await teoria_client.execute(
        "search_public_organizations", inputs, max_objects=page_size * 2
    )
    return {
        "items": [organization(obj) for obj in objects_of(data, "public_organization")],
        "pagination": data.get("pagination"),
        "truncated": bool(data.get("truncated")),
        "registry_version": data.get("registry", {}).get("version"),
    }
