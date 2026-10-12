import asyncio

from fastapi import APIRouter, HTTPException, Query

from app.services.search_service import search_companies, search_notices, search_organizations

router = APIRouter()
_SUGGEST_TIMEOUT_SECONDS = 3.0
_NOTICE_SUGGEST_TIMEOUT_SECONDS = 10.0


async def _safe(coro, fallback, *, timeout: float = _SUGGEST_TIMEOUT_SECONDS):
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except (TimeoutError, HTTPException):
        return fallback


@router.get("/suggest")
async def suggest(q: str = Query(min_length=2, max_length=100), limit: int = Query(3, ge=1, le=5)):
    organizations, companies, notices = await asyncio.gather(
        _safe(
            search_organizations(q=q, organization_code=None, page=1, page_size=limit),
            {"items": [], "pagination": {}},
        ),
        _safe(search_companies(q=q), {"items": [], "count": 0}),
        _safe(
            search_notices(q=q, include_history=True, lineage_mode="grouped", page_size=limit),
            {"items": [], "pagination": {}},
            timeout=_NOTICE_SUGGEST_TIMEOUT_SECONDS,
        ),
    )
    return {
        "organizations": (organizations.get("items") or [])[:limit],
        "companies": (companies.get("items") or [])[:limit],
        "notices": (notices.get("items") or [])[:limit],
        "total_counts": {
            "organizations": (organizations.get("pagination") or {}).get(
                "total_items", len(organizations.get("items") or [])
            ),
            "companies": companies.get("count", len(companies.get("items") or [])),
            "notices": (notices.get("pagination") or {}).get(
                "total_items", len(notices.get("items") or [])
            ),
        },
    }
