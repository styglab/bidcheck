import asyncio
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query

from app.integrations.teoria import teoria_client
from app.services import company_discovery_service, search_service
from app.services.procurement_cache import cached_runtime_read
from app.services.teoria_adapter import award, objects_of, opening_participation, runtime_outcome

router = APIRouter()


@router.get("/search")
async def search_companies(q: str = Query(min_length=2, max_length=100)):
    return await search_service.search_companies(q=q)


@router.get("/discover")
async def discover_companies(q: str = Query(min_length=2, max_length=100)):
    """Find suppliers from recent awards whose notice title matches a product or field."""
    now = datetime.now(UTC)
    data = await teoria_client.execute(
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
    companies: dict[str, dict] = {}
    for obj in objects_of(data, "bid_award"):
        item = award(obj)
        number = item.get("company_number")
        if not number:
            continue
        company = companies.setdefault(
            number,
            {
                "business_registration_number": number,
                "name": item.get("company_name") or "업체명 확인 필요",
                "award_count": 0,
                "winning_amount": 0,
                "organization_codes": set(),
                "organization_names": set(),
                "latest_award_date": None,
                "representative_award": None,
            },
        )
        company["award_count"] += 1
        company["winning_amount"] += item.get("winning_amount") or 0
        if item.get("organization_code"):
            company["organization_codes"].add(item["organization_code"])
        if item.get("organization_name"):
            company["organization_names"].add(item["organization_name"])
        award_date = item.get("award_date") or ""
        if not company["latest_award_date"] or award_date > company["latest_award_date"]:
            company["latest_award_date"] = award_date or None
            company["representative_award"] = item

    items = sorted(
        companies.values(),
        key=lambda item: (item["award_count"], item["winning_amount"]),
        reverse=True,
    )
    for item in items:
        item["organization_count"] = len(item.pop("organization_codes"))
        item["organization_names"] = sorted(item["organization_names"])[:3]
    pagination = data.get("pagination", {})
    return {
        "items": items,
        "matched_award_count": pagination.get("total_items", len(objects_of(data, "bid_award"))),
        "sampled_award_count": len(objects_of(data, "bid_award")),
        "partial": bool(data.get("truncated"))
        or pagination.get("total_items", 0) > len(objects_of(data, "bid_award")),
        "registry_version": data.get("registry", {}).get("version"),
    }


@router.get("/contract-discovery")
async def discover_contract_companies(
    q: str = Query(min_length=2, max_length=100),
    period_years: int = Query(3, ge=1, le=5),
):
    if len(q.strip()) < 2:
        raise HTTPException(
            422, detail={"code": "invalid_query", "message": "검색어를 2자 이상 입력해 주세요."}
        )
    year = datetime.now(UTC).year
    return await company_discovery_service.discover_contract_companies(
        q, year - period_years + 1, year
    )


@router.get("/{business_number}/profile")
async def company_profile(business_number: str, reference_date: date | None = None):
    number = "".join(ch for ch in business_number if ch.isdigit())
    profile_result, qualification_result = await asyncio.gather(
        teoria_client.execute(
            "get_company_procurement_profile",
            {"business_registration_number": number},
            max_objects=500,
            provenance=True,
        ),
        teoria_client.execute(
            "get_company_bid_qualification_profile",
            {
                "business_registration_number": number,
                "reference_date": (reference_date or datetime.now(UTC).date()).isoformat(),
            },
            max_objects=500,
            provenance=True,
        ),
        return_exceptions=True,
    )
    if isinstance(profile_result, BaseException):
        raise profile_result
    profile = profile_result
    qualification_error = None
    if isinstance(qualification_result, BaseException):
        qualifications = {"objects": []}
        detail = (
            qualification_result.detail
            if isinstance(qualification_result, HTTPException)
            and isinstance(qualification_result.detail, dict)
            else {}
        )
        qualification_error = detail.get("code", "qualification_lookup_failed")
    else:
        qualifications = qualification_result
    return {
        "business_registration": [
            x.get("properties", {}) for x in objects_of(profile, "business_registration")
        ],
        "suppliers": [x.get("properties", {}) for x in objects_of(profile, "procurement_supplier")],
        "industries": [x.get("properties", {}) for x in objects_of(profile, "registered_industry")],
        "products": [
            x.get("properties", {}) for x in objects_of(profile, "registered_supply_product")
        ],
        "sanctions": [x.get("properties", {}) for x in objects_of(profile, "procurement_sanction")],
        "qualifications": [
            x.get("properties", {}) for x in objects_of(qualifications, "qualification")
        ],
        "direct_production": [
            x.get("properties", {})
            for x in objects_of(qualifications, "direct_production_confirmation")
        ],
        "partial": profile.get("truncated", False)
        or qualifications.get("truncated", False)
        or qualification_error is not None,
        "qualification_error": qualification_error,
    }


@router.get("/{business_number}/detail-context")
async def company_detail_context(
    business_number: str,
    company_name: str | None = Query(None, max_length=200),
):
    """Expose Teoria's composed company context without duplicating its source rules."""
    number = "".join(ch for ch in business_number if ch.isdigit())
    if len(number) != 10:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_business_number",
                "message": "사업자등록번호를 확인해 주세요.",
            },
        )
    data = await teoria_client.execute(
        "get_company_detail_context",
        {
            "business_registration_number": number,
            **(
                {"company_name": company_name.strip()}
                if company_name and company_name.strip()
                else {}
            ),
            "financial_year_limit": 3,
            "financial_lookback_years": 7,
            "include_relationships": True,
        },
        max_objects=500,
    )
    return runtime_outcome(data)


@router.get("/{business_number}/activity")
async def company_procurement_activity(
    business_number: str,
    days: int = Query(default=365, ge=30, le=3650),
    period_from_year: int | None = Query(None, ge=2000),
    period_to_year: int | None = Query(None, ge=2000),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(
        None, pattern="^(goods|service|construction|foreign|other|unknown)$"
    ),
    query: str | None = Query(None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
):
    number = "".join(ch for ch in business_number if ch.isdigit())
    if (period_from_year is None) != (period_to_year is None) or (
        period_from_year is not None and period_from_year > period_to_year
    ):
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    common_filters = {
        **({"large_category": large_category} if large_category else {}),
        **({"middle_category": middle_category} if middle_category else {}),
        **({"field_code": field_code} if field_code else {}),
        **({"work_type": work_type} if work_type else {}),
    }
    participations = await cached_runtime_read(
        "search_bid_participations",
        {
            "business_registration_number": number,
            **(
                {"period_from_year": period_from_year, "period_to_year": period_to_year}
                if period_from_year
                else {}
            ),
            **common_filters,
            **({"query": query.strip()} if query and query.strip() else {}),
            "page": page,
            "page_size": page_size,
        },
        max_objects=page_size * 3,
    )
    participation_outcome = participations.get("outcome") or {}
    participation_items = participation_outcome.get("items") or [
        opening_participation(obj)
        for obj in objects_of(participations, "bid_opening_participation")
    ]
    return {
        "items": participation_items,
        "awards": [],
        "award_pagination": {},
        "contracts": [],
        "pagination": participation_outcome.get("pagination")
        or participations.get("pagination", {}),
        "data_completeness": participation_outcome.get("data_completeness") or {},
        "contract_count": 0,
        "registry_version": participations.get("registry", {}).get("version"),
    }


@router.get("/{business_number}/competitors")
async def get_company_competitors(
    business_number: str,
    period_from_year: int = Query(..., ge=2000),
    period_to_year: int = Query(..., ge=2000),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(
        None, pattern="^(goods|service|construction|foreign|other|unknown)$"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
):
    if period_from_year > period_to_year:
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    data = await cached_runtime_read(
        "analyze_company_competitors",
        {
            "business_registration_number": "".join(ch for ch in business_number if ch.isdigit()),
            "period_from_year": period_from_year,
            "period_to_year": period_to_year,
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
            "page": page,
            "page_size": page_size,
        },
        max_objects=page_size * 3,
    )
    return runtime_outcome(data)


@router.get("/{business_number}/procurement-profile")
async def get_company_procurement_analysis(
    business_number: str,
    period_years: int = Query(5, ge=1, le=10),
    period_from_year: int | None = Query(None, ge=2000),
    period_to_year: int | None = Query(None, ge=2000),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    work_type: str | None = Query(
        None, pattern="^(goods|service|construction|foreign|other|unknown)$"
    ),
    organization_query: str | None = Query(None, max_length=200),
    target_year: int | None = Query(None, ge=2000),
    organization_entry_status: str | None = Query(
        None,
        pattern="^(first_observed|reentering|incumbent)$",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    current_year = datetime.now(UTC).year
    if (period_from_year is None) != (period_to_year is None):
        raise HTTPException(422, detail="시작 연도와 종료 연도를 함께 입력해 주세요.")
    if period_from_year is not None and (
        period_from_year > period_to_year or period_to_year > current_year
    ):
        raise HTTPException(422, detail="조회 연도 범위가 올바르지 않습니다.")
    number = "".join(ch for ch in business_number if ch.isdigit())
    data = await cached_runtime_read(
        "analyze_company_procurement_profile",
        {
            "business_registration_number": number,
            "period_years": period_years,
            **(
                {"period_from_year": period_from_year, "period_to_year": period_to_year}
                if period_from_year is not None
                else {}
            ),
            **({"large_category": large_category} if large_category else {}),
            **({"middle_category": middle_category} if middle_category else {}),
            **({"field_code": field_code} if field_code else {}),
            **({"work_type": work_type} if work_type else {}),
            **(
                {"organization_query": organization_query.strip()}
                if organization_query and organization_query.strip()
                else {}
            ),
            **({"target_year": target_year} if target_year else {}),
            **(
                {"organization_entry_status": organization_entry_status}
                if organization_entry_status
                else {}
            ),
            "page": page,
            "page_size": page_size,
        },
        max_objects=500,
    )
    return runtime_outcome(data)
