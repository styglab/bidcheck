import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

from app.integrations.teoria import teoria_client
from app.services.teoria_adapter import award, contract, objects_of

router = APIRouter()


def organization(obj: dict) -> dict:
    properties = obj.get("properties", {})
    return {
        "id": obj.get("id"),
        "organization_code": properties.get("organization_code"),
        "name": properties.get("name"),
        "jurisdiction_type": properties.get("jurisdiction_type"),
    }


@router.get("")
async def search_organizations(
    q: str | None = Query(None, min_length=2, max_length=100),
    organization_code: str | None = Query(None, max_length=50),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    inputs = {"page": page, "page_size": page_size}
    if q:
        inputs["query"] = q
    if organization_code:
        inputs["organization_code"] = organization_code
    data = await teoria_client.execute("search_public_organizations", inputs, max_objects=page_size * 2)
    return {
        "items": [organization(obj) for obj in objects_of(data, "public_organization")],
        "pagination": data.get("pagination"),
        "registry_version": data.get("registry", {}).get("version"),
    }


@router.get("/{organization_code}")
async def get_organization(organization_code: str):
    data = await teoria_client.execute(
        "search_public_organizations",
        {"organization_code": organization_code, "page": 1, "page_size": 1},
        max_objects=5,
    )
    found = objects_of(data, "public_organization")
    if not found:
        raise HTTPException(404, detail={"code": "organization_not_found", "message": "기관을 찾을 수 없습니다."})
    return {"organization": organization(found[0]), "registry_version": data.get("registry", {}).get("version")}


@router.get("/{organization_code}/activity")
async def get_organization_activity(organization_code: str, days: int = Query(365, ge=30, le=3650), page_size: int = Query(10, ge=1, le=50)):
    now = datetime.now(timezone.utc); start = now - timedelta(days=days)
    awards_task = teoria_client.execute("search_bid_awards", {"demand_organization_code": organization_code, "opening_at_from": start.isoformat(), "opening_at_to": now.isoformat(), "page": 1, "page_size": page_size}, max_objects=page_size * 4)
    contracts_task = teoria_client.execute("search_public_procurement_contracts", {"contracting_organization_code": organization_code, "concluded_date_from": start.date().isoformat(), "concluded_date_to": now.date().isoformat(), "page": 1, "page_size": page_size}, max_objects=page_size * 3)
    awards, contracts = await asyncio.gather(awards_task, contracts_task)
    return {"awards": [award(obj) for obj in objects_of(awards, "bid_award")], "award_pagination": awards.get("pagination", {}), "contracts": [contract(obj) for obj in objects_of(contracts, "contract")], "contract_pagination": contracts.get("pagination", {})}
