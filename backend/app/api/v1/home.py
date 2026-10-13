from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query

from app.integrations.teoria import teoria_client
from app.services import company_discovery_service, relationship_service
from app.services.teoria_adapter import award, objects_of

router = APIRouter()


@router.get("/recent-awards")
async def recent_awards():
    now = datetime.now(UTC)
    data = await teoria_client.execute(
        "search_bid_awards",
        {
            "opening_at_from": (now - timedelta(days=90)).isoformat(),
            "opening_at_to": now.isoformat(),
            "sort": "award_desc",
            "page": 1,
            "page_size": 5,
        },
        max_objects=30,
    )
    return {
        "items": [award(obj) for obj in objects_of(data, "bid_award")],
        "registry_version": data.get("registry", {}).get("version"),
    }


@router.get("/relationships")
async def discover_relationships(
    period_years: int = Query(3, ge=1, le=5),
    organization_limit: int = Query(12, ge=1, le=24),
    include_profiles: bool = Query(True),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other)$"),
):
    return await relationship_service.discover_relationships(
        period_years,
        work_type,
        organization_limit=organization_limit,
        include_profiles=include_profiles,
    )


@router.get("/company-sectors")
async def discover_company_sectors():
    return await company_discovery_service.discover_company_sectors()
