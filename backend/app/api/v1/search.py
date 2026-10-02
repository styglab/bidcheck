import asyncio

from fastapi import APIRouter, Query

from app.api.v1.bids import search_notices
from app.api.v1.companies import search_companies
from app.api.v1.organizations import search_organizations

router = APIRouter()


async def _safe(coro, fallback):
    try:
        return await asyncio.wait_for(coro, timeout=3.0)
    except Exception:
        return fallback


@router.get("/suggest")
async def suggest(q: str = Query(min_length=2, max_length=100), limit: int = Query(3, ge=1, le=5)):
    organizations, companies, notices = await asyncio.gather(
        _safe(search_organizations(q=q, organization_code=None, page=1, page_size=limit), {"items": [], "pagination": {}}),
        _safe(search_companies(q=q), {"items": [], "count": 0}),
        _safe(search_notices(q=q, published_from=None, published_to=None, deadline_from=None, deadline_to=None, contract_method=None, work_type=None, price_min=None, price_max=None, notice_organization_code=None, demand_organization_code=None, large_category=None, middle_category=None, field_code=None, include_history=True, sort="published_desc", page=1, page_size=limit), {"items": [], "pagination": {}}),
    )
    return {
        "organizations": (organizations.get("items") or [])[:limit],
        "companies": (companies.get("items") or [])[:limit],
        "notices": (notices.get("items") or [])[:limit],
        "total_counts": {
            "organizations": (organizations.get("pagination") or {}).get("total_items", len(organizations.get("items") or [])),
            "companies": companies.get("count", len(companies.get("items") or [])),
            "notices": (notices.get("pagination") or {}).get("total_items", len(notices.get("items") or [])),
        },
    }
