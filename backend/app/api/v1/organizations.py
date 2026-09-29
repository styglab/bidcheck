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
async def get_organization_activity(
    organization_code: str,
    days: int = Query(365, ge=30, le=3650),
    period_years: int | None = Query(None, ge=1, le=5),
    field_code: str | None = Query(None, max_length=20),
    page_size: int = Query(10, ge=1, le=50),
):
    now = datetime.now(timezone.utc)
    start = datetime(now.year - period_years + 1, 1, 1, tzinfo=timezone.utc) if period_years else now - timedelta(days=days)
    shared_filters = {
        **({"field_code": field_code} if field_code else {}),
    }
    awards_task = teoria_client.execute("search_bid_awards", {"demand_organization_code": organization_code, "opening_at_from": start.isoformat(), "opening_at_to": now.isoformat(), "page": 1, "page_size": page_size, **shared_filters}, max_objects=page_size * 4)
    contracts_task = teoria_client.execute("search_public_procurement_contracts", {"contracting_organization_code": organization_code, "concluded_date_from": start.date().isoformat(), "concluded_date_to": now.date().isoformat(), "page": 1, "page_size": page_size, **shared_filters}, max_objects=page_size * 3)
    awards, contracts = await asyncio.gather(awards_task, contracts_task)
    return {"awards": [award(obj) for obj in objects_of(awards, "bid_award")], "award_pagination": awards.get("pagination", {}), "contracts": [contract(obj) for obj in objects_of(contracts, "contract")], "contract_pagination": contracts.get("pagination", {})}


@router.get("/{organization_code}/procurement-profile")
async def get_organization_procurement_profile(
    organization_code: str,
    period_years: int = Query(5, ge=1, le=10),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other|unknown)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    data = await teoria_client.execute(
        "analyze_organization_procurement_profile",
        {
            "organization_code": organization_code,
            "period_years": period_years,
            "page": page,
            "page_size": page_size,
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
        },
        max_objects=500,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}


@router.get("/{organization_code}/companies/{company_number}/relationship")
async def get_organization_company_relationship(
    organization_code: str,
    company_number: str,
    period_years: int = Query(5, ge=1, le=5),
    field_code: str | None = Query(None, max_length=20),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    number = "".join(ch for ch in company_number if ch.isdigit())
    data = await teoria_client.execute(
        "get_organization_company_relationship",
        {
            "organization_code": organization_code,
            "business_registration_number": number,
            "period_years": period_years,
            **({"field_code": field_code} if field_code else {}),
            "page": page,
            "page_size": page_size,
        },
        max_objects=500,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}
