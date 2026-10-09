import asyncio
from datetime import UTC, datetime, timedelta

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
    period_from_year: int | None = Query(None, ge=2000),
    period_to_year: int | None = Query(None, ge=2000),
    q: str | None = Query(None, max_length=200),
    kind: str = Query("all", pattern="^(all|awards|contracts)$"),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other|unknown)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
):
    now = datetime.now(UTC)
    if (period_from_year is None) != (period_to_year is None):
        raise HTTPException(422, detail="시작 연도와 종료 연도를 함께 입력해 주세요.")
    if period_from_year is not None and (period_from_year > period_to_year or period_to_year > now.year):
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    start = datetime(period_from_year, 1, 1, tzinfo=UTC) if period_from_year else (datetime(now.year - period_years + 1, 1, 1, tzinfo=UTC) if period_years else now - timedelta(days=days))
    end = datetime(period_to_year, 12, 31, 23, 59, 59, tzinfo=UTC) if period_to_year and period_to_year < now.year else now
    shared_filters = {
        **({"query": q} if q else {}),
        **({"large_category": large_category} if large_category else {}),
        **({"middle_category": middle_category} if middle_category else {}),
        **({"field_code": field_code} if field_code else {}),
        **({"work_type": work_type} if work_type else {}),
    }
    awards_task = teoria_client.execute("search_bid_awards", {"demand_organization_code": organization_code, "opening_at_from": start.isoformat(), "opening_at_to": end.isoformat(), "page": page, "page_size": page_size, **shared_filters}, max_objects=page_size * 4) if kind in {"all", "awards"} else None
    contracts_task = teoria_client.execute("search_public_procurement_contracts", {"contracting_organization_code": organization_code, "concluded_date_from": start.date().isoformat(), "concluded_date_to": end.date().isoformat(), "page": page, "page_size": page_size, **shared_filters}, max_objects=page_size * 3) if kind in {"all", "contracts"} else None
    pending = [task for task in (awards_task, contracts_task) if task is not None]
    results = await asyncio.gather(*pending)
    awards = results.pop(0) if awards_task is not None else {}
    contracts = results.pop(0) if contracts_task is not None else {}
    return {"awards": [award(obj) for obj in objects_of(awards, "bid_award")], "award_pagination": awards.get("pagination", {}), "contracts": [contract(obj) for obj in objects_of(contracts, "contract")], "contract_pagination": contracts.get("pagination", {})}


@router.get("/{organization_code}/procurement-profile")
async def get_organization_procurement_profile(
    organization_code: str,
    period_years: int = Query(5, ge=1, le=10),
    period_from_year: int | None = Query(None, ge=2000),
    period_to_year: int | None = Query(None, ge=2000),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other|unknown)$"),
    company_query: str | None = Query(None, max_length=200),
    sort: str = Query("contract_amount_desc", pattern="^(contract_amount_desc|contract_count_desc|latest_contract_desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    current_year = datetime.now(UTC).year
    if (period_from_year is None) != (period_to_year is None):
        raise HTTPException(422, detail="시작 연도와 종료 연도를 함께 입력해 주세요.")
    if period_from_year is not None and (period_from_year > period_to_year or period_to_year > current_year):
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    data = await teoria_client.execute(
        "analyze_organization_procurement_profile",
        {
            "organization_code": organization_code,
            "period_years": period_years,
            **({"period_from_year": period_from_year, "period_to_year": period_to_year} if period_from_year is not None else {}),
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
            **({"company_query": company_query} if company_query else {}),
            "sort": sort,
            "page": page,
            "page_size": page_size,
        },
        max_objects=500,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}


@router.get("/{organization_code}/supplier-entries")
async def get_organization_supplier_entries(
    organization_code: str,
    target_year: int = Query(..., ge=2000),
    entry_status: str = Query("first_observed", pattern="^(first_observed|reentering|incumbent)$"),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other|unknown)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=100),
):
    current_year = datetime.now(UTC).year
    if target_year > current_year:
        raise HTTPException(422, detail="대상 연도가 올바르지 않습니다.")
    data = await teoria_client.execute(
        "search_organization_supplier_entries",
        {
            "organization_code": organization_code,
            "target_year": target_year,
            "entry_status": entry_status,
            "sort": "contract_amount_desc",
            "page": page,
            "page_size": page_size,
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
        },
        max_objects=page_size * 2,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}


@router.get("/{organization_code}/outcomes")
async def get_organization_procurement_outcomes(
    organization_code: str,
    period_from_year: int = Query(..., ge=2000),
    period_to_year: int = Query(..., ge=2000),
    q: str | None = Query(None, max_length=200),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other|unknown)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    current_year = datetime.now(UTC).year
    if period_from_year > period_to_year or period_to_year > current_year:
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    data = await teoria_client.execute(
        "search_procurement_outcomes",
        {
            "organization_code": organization_code,
            "period_from_year": period_from_year,
            "period_to_year": period_to_year,
            **({"query": q} if q else {}),
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
            "page": page,
            "page_size": page_size,
        },
        max_objects=page_size * 3,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}


@router.get("/{organization_code}/procurement-activity")
async def get_organization_procurement_activity(
    organization_code: str,
    period_from_year: int = Query(..., ge=2000),
    period_to_year: int = Query(..., ge=2000),
    q: str | None = Query(None, max_length=200),
    stage: str = Query("all", pattern="^(all|scheduled|open|closed|award|contract|failed_or_cancelled)$"),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other|unknown)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    current_year = datetime.now(UTC).year
    if period_from_year > period_to_year or period_to_year > current_year:
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    data = await teoria_client.execute(
        "search_procurement_activity",
        {
            "organization_code": organization_code,
            "period_from_year": period_from_year,
            "period_to_year": period_to_year,
            "stage": stage,
            **({"query": q} if q else {}),
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
            "page": page,
            "page_size": page_size,
        },
        max_objects=page_size * 4,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}


@router.get("/{organization_code}/companies/{company_number}/relationship")
async def get_organization_company_relationship(
    organization_code: str,
    company_number: str,
    period_years: int = Query(5, ge=1, le=5),
    period_from_year: int | None = Query(None, ge=2000),
    period_to_year: int | None = Query(None, ge=2000),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other|unknown)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    current_year = datetime.now(UTC).year
    if (period_from_year is None) != (period_to_year is None):
        raise HTTPException(422, detail="시작 연도와 종료 연도를 함께 입력해 주세요.")
    if period_from_year is not None and (period_from_year > period_to_year or period_to_year > current_year):
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    number = "".join(ch for ch in company_number if ch.isdigit())
    data = await teoria_client.execute(
        "get_organization_company_relationship",
        {
            "organization_code": organization_code,
            "business_registration_number": number,
            "period_years": period_years,
            **({"period_from_year": period_from_year, "period_to_year": period_to_year} if period_from_year is not None else {}),
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
            "page": page,
            "page_size": page_size,
        },
        max_objects=500,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}
