import asyncio
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.integrations.teoria import teoria_client
from app.services import search_service
from app.services.cache import TTLCache
from app.services.teoria_adapter import (
    RequirementSetMismatch,
    first_present,
    notice,
    notice_activity,
    notice_object,
    objects_of,
    participation_finding,
    participation_finding_evidence,
    requirement,
    requirement_evidence,
    requirement_set,
    requirement_set_object,
    runtime_outcome,
    split_notice_id,
)

router = APIRouter()
_market_context_cache = TTLCache(200, 600)
_organization_field_company_cache = TTLCache(200, 600)


@router.get("")
async def search_notices(
    q: str | None = Query(None, max_length=200),
    published_from: datetime | None = None,
    published_to: datetime | None = None,
    deadline_from: datetime | None = None,
    deadline_to: datetime | None = None,
    contract_method: str | None = None,
    work_type: str | None = Query(
        None,
        pattern="^(none|goods|service|construction|foreign|other)(,(goods|service|construction|foreign|other))*$",
    ),
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    notice_organization_code: str | None = Query(None, max_length=50),
    demand_organization_code: str | None = Query(None, max_length=50),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    include_history: bool = Query(False),
    lineage_mode: str = Query("grouped", pattern="^(all|latest_only|grouped)$"),
    sort: str = Query("published_desc", pattern="^(deadline_asc|published_desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return await search_service.search_notices(
        q=q,
        published_from=published_from,
        published_to=published_to,
        deadline_from=deadline_from,
        deadline_to=deadline_to,
        contract_method=contract_method,
        work_type=work_type,
        price_min=price_min,
        price_max=price_max,
        notice_organization_code=notice_organization_code,
        demand_organization_code=demand_organization_code,
        large_category=large_category,
        middle_category=middle_category,
        field_code=field_code,
        include_history=include_history,
        lineage_mode=lineage_mode,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/{notice_id}")
async def get_notice(notice_id: str):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    base = await teoria_client.execute(
        "get_bid_notice", {"notice_number": number, "notice_order": order}, max_objects=20
    )
    found = notice_object(base, notice_id)
    if not found:
        raise HTTPException(
            404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."}
        )
    try:
        req_data = await teoria_client.execute(
            "get_bid_requirements",
            {"notice_number": number, "notice_order": order},
            max_objects=500,
            provenance=True,
        )
        requirements = [requirement(obj) for obj in objects_of(req_data, "bid_requirement")]
        try:
            selected_set = requirement_set_object(req_data, notice_id)
        except RequirementSetMismatch:
            raise HTTPException(
                502,
                detail={
                    "code": "requirement_set_mismatch",
                    "message": "공고에 연결된 참가요건 집합을 확인할 수 없습니다.",
                },
            ) from None
        selected_requirement_set = requirement_set(selected_set) if selected_set else None
        evidence = [
            requirement_evidence(obj) for obj in objects_of(req_data, "bid_requirement_evidence")
        ]
        evidence_by_requirement: dict[str, list[dict]] = {}
        for item in evidence:
            if item["requirement_id"]:
                evidence_by_requirement.setdefault(str(item["requirement_id"]), []).append(item)
        for item in requirements:
            item["evidence"] = evidence_by_requirement.get(str(item["id"]), [])
            if item.get("local_id"):
                item["evidence"] += evidence_by_requirement.get(str(item["local_id"]), [])
        requirement_state = "ready"
    except HTTPException as exc:
        if exc.status_code == 409:
            requirements, selected_requirement_set, requirement_state = [], None, "not_extracted"
        else:
            raise
    try:
        finding_data = await teoria_client.execute(
            "get_bid_participation_findings",
            {"notice_number": number, "notice_order": order},
            max_objects=500,
            provenance=True,
        )
        participation_findings = [
            participation_finding(obj)
            for obj in objects_of(finding_data, "bid_participation_finding")
        ]
        finding_evidence = [
            participation_finding_evidence(obj)
            for obj in objects_of(finding_data, "bid_participation_finding_evidence")
        ]
        evidence_by_finding: dict[str, list[dict]] = {}
        for item in finding_evidence:
            if item["finding_id"]:
                evidence_by_finding.setdefault(str(item["finding_id"]), []).append(item)
        for item in participation_findings:
            item["evidence"] = evidence_by_finding.get(str(item["id"]), [])
    except HTTPException as exc:
        if exc.status_code in {404, 409}:
            participation_findings = []
        else:
            raise
    return {
        "notice": notice(found),
        "requirements": requirements,
        "requirement_set": selected_requirement_set,
        "requirement_state": requirement_state,
        "participation_findings": participation_findings,
        "registry_version": (
            finding_data.get("registry", {}).get("version")
            if "finding_data" in locals()
            else base.get("registry", {}).get("version")
        ),
    }


@router.get("/{notice_id}/organization-field-companies")
async def get_notice_organization_field_companies(
    notice_id: str, period_years: int = Query(5, ge=1, le=10)
):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    canonical_id = f"{number}:{order}"
    cache_key = f"{canonical_id}:{period_years}"
    cached = _organization_field_company_cache.get(cache_key)
    if cached is not None:
        return cached
    data = await teoria_client.execute(
        "analyze_bid_participation_context",
        {"bid_notice_id": canonical_id, "period_years": period_years},
        max_objects=300,
    )
    outcome = data.get("outcome") or {}
    analysis_basis = outcome.get("analysis_basis") or {}
    response = {
        "bid_notice_id": canonical_id,
        "organization": {
            "code": analysis_basis.get("organization_code"),
            "name": analysis_basis.get("organization_name"),
        },
        "analysis_basis": analysis_basis,
        "market_structure": outcome.get("supplier_concentration") or {},
        "market_entry": outcome.get("market_entry") or {},
        "organization_field_companies": outcome.get("top_suppliers") or [],
        "market_similar_companies": outcome.get("attention_suppliers") or [],
        "organization_other_companies": [],
        "policy": outcome.get("top_suppliers_basis") or {},
        "registry_version": data.get("registry", {}).get("version"),
    }
    _organization_field_company_cache.set(cache_key, response)
    return response


@router.get("/{notice_id}/participation-context")
async def get_notice_participation_context(
    notice_id: str, period_years: int = Query(3, ge=1, le=10)
):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    data = await teoria_client.execute(
        "analyze_bid_participation_context",
        {"bid_notice_id": f"{number}:{order}", "period_years": period_years},
        max_objects=100,
    )
    return runtime_outcome(data)


@router.get("/{notice_id}/related-projects")
async def search_notice_related_projects(
    notice_id: str,
    project_filter: str = Query(
        "all", pattern="^(all|similar_amount|entry_or_reentering_supplier|repeat_supplier)$"
    ),
    project_filters: Annotated[list[str] | None, Query()] = None,
    filter_operator: str = Query("and", pattern="^(and|or)$"),
    sort: str = Query("recent_desc", pattern="^(recent_desc|amount_desc|amount_similarity)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    allowed_filters = {"similar_amount", "entry_or_reentering_supplier", "repeat_supplier"}
    normalized_filters = list(dict.fromkeys(project_filters or []))
    if project_filter != "all" and project_filter not in normalized_filters:
        normalized_filters.append(project_filter)
    if any(item not in allowed_filters for item in normalized_filters):
        raise HTTPException(
            422,
            detail={
                "code": "invalid_project_filters",
                "message": "지원하지 않는 계약 이력 필터입니다.",
            },
        )
    inputs = {
        "bid_notice_id": f"{number}:{order}",
        "sort": sort,
        "page": page,
        "page_size": page_size,
    }
    if normalized_filters:
        inputs.update({"project_filters": normalized_filters, "filter_operator": filter_operator})
    data = await teoria_client.execute(
        "search_bid_related_projects",
        inputs,
        max_objects=min(page_size * 5, 500),
    )
    return runtime_outcome(data)


@router.get("/{notice_id}/organization-company-relationship")
async def get_notice_organization_company_relationship(
    notice_id: str,
    organization_code: str = Query(..., min_length=1, max_length=50),
    company_number: str = Query(..., min_length=1, max_length=20),
    period_years: int = Query(5, ge=1, le=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=20),
):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    canonical_id = f"{number}:{order}"
    data = await teoria_client.execute(
        "get_organization_company_relationship",
        {
            "organization_code": organization_code,
            "business_registration_number": company_number,
            "period_years": period_years,
            "page": page,
            "page_size": page_size,
        },
        max_objects=100,
    )
    outcome = data.get("outcome") or {}
    return {
        "bid_notice_id": canonical_id,
        **outcome,
        "registry_version": data.get("registry", {}).get("version"),
    }


@router.get("/{notice_id}/project-lineage")
async def get_notice_project_lineage(notice_id: str, period_years: int = Query(10, ge=1, le=20)):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    canonical_id = f"{number}:{order}"
    data = await teoria_client.execute(
        "find_bid_project_lineage",
        {"bid_notice_id": canonical_id, "period_years": period_years},
        max_objects=100,
    )
    outcome = data.get("outcome") or {}
    return {
        "bid_notice_id": canonical_id,
        **outcome,
        "registry_version": data.get("registry", {}).get("version"),
    }


@router.get("/{notice_id}/activity")
async def get_notice_activity(notice_id: str):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    canonical_id = f"{number}:{order}"
    context, participation_data, contract_data = await asyncio.gather(
        teoria_client.execute(
            "get_bid_notice_relationship_context",
            {"bid_notice_id": canonical_id, "relationship_history_years": 5},
            max_objects=500,
        ),
        teoria_client.execute(
            "get_bid_notice_participations",
            {"bid_notice_id": canonical_id},
            max_objects=500,
        ),
        teoria_client.execute(
            "get_bid_notice_contracts",
            {"notice_number": number, "page": 1, "page_size": 20},
            max_objects=100,
        ),
    )
    if not (context.get("outcome") or {}).get("bid_notice"):
        raise HTTPException(
            404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."}
        )
    return notice_activity(context, participation_data, contract_data, canonical_id)


@router.get("/{notice_id}/relationship-context")
async def get_bid_relationship_context(
    notice_id: str, relationship_history_years: int = Query(5, ge=1, le=10)
):
    try:
        split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    data = await teoria_client.execute(
        "get_bid_notice_relationship_context",
        {"bid_notice_id": notice_id, "relationship_history_years": relationship_history_years},
        max_objects=500,
    )
    return runtime_outcome(data)


@router.get("/{notice_id}/market-context")
async def get_notice_market_context(notice_id: str):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_bid_notice_id",
                "message": "공고 ID는 공고번호:차수 형식이어야 합니다.",
            },
        ) from exc
    cached = _market_context_cache.get(notice_id)
    if cached is not None:
        return cached
    base, similar_data = await asyncio.gather(
        teoria_client.execute(
            "get_bid_notice", {"notice_number": number, "notice_order": order}, max_objects=10
        ),
        teoria_client.execute(
            "search_bid_related_projects",
            {
                "bid_notice_id": notice_id,
                "project_filters": [],
                "sort": "recent_desc",
                "page": 1,
                "page_size": 50,
            },
            max_objects=200,
        ),
    )
    found = notice_object(base, notice_id)
    if not found:
        raise HTTPException(
            404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."}
        )
    current = notice(found)
    similar_outcome = similar_data.get("outcome", {})
    similar_policy = similar_outcome.get("analysis_basis", {})
    similar = [
        {
            "id": item.get("bid_notice_id") or item.get("contract_event_id"),
            "bid_notice_id": item.get("bid_notice_id"),
            "notice_number": str(item.get("bid_notice_id") or "").split(":", 1)[0],
            "notice_order": str(item.get("bid_notice_id") or ":").split(":", 1)[-1],
            "notice_name": item.get("notice_name"),
            "organization_code": item.get("organization_code"),
            "organization_name": item.get("organization_name"),
            "estimated_price": item.get("project_amount"),
            "company_number": item.get("company_number")
            or (item.get("contractors") or [{}])[0].get("company_number"),
            "company_name": item.get("company_name")
            or (item.get("contractors") or [{}])[0].get("company_name"),
            "winning_amount": first_present(
                item.get("attributed_contract_amount"), item.get("contract_amount")
            ),
            "winning_rate": None,
            "award_date": item.get("first_contract_date") or item.get("contract_date"),
            "notice_published_date": item.get("notice_published_at"),
            "similarity_score": None,
            "similarity_level": None,
            "similarity_reasons": item.get("matched_filters") or [],
            "matched_features": {
                "relationship_status": item.get("relationship_status_summary"),
                "is_similar_amount": item.get("is_similar_amount"),
            },
        }
        for item in similar_outcome.get("items", [])
    ]
    companies: dict[str, dict] = {}
    for item in similar:
        company_number = item.get("company_number")
        if not company_number:
            continue
        company = companies.setdefault(
            company_number,
            {
                "company_number": company_number,
                "company_name": item.get("company_name"),
                "participation_count": 0,
                "award_count": 0,
                "contract_count": 0,
                "organization_participation_count": 0,
                "organization_award_count": 0,
                "organization_contract_count": 0,
                "organization_contract_amount": None,
                "organization_similar_participation_count": 0,
                "organization_similar_award_count": 0,
                "organization_similar_contract_count": 0,
                "region_status": "unknown",
                "total_amount": 0,
                "latest_award_date": None,
                "notice_ids": [],
                "activities": [],
            },
        )
        company["award_count"] += 1
        if current.get("organization_code") and item.get("organization_code") == current.get(
            "organization_code"
        ):
            company["organization_award_count"] += 1
            company["organization_similar_award_count"] += 1
        company["total_amount"] += item.get("winning_amount") or 0
        company["notice_ids"].append(item.get("bid_notice_id"))
        if (item.get("award_date") or "") > (company["latest_award_date"] or ""):
            company["latest_award_date"] = item.get("award_date")
    company_items = sorted(
        companies.values(),
        key=lambda item: (item["award_count"], item["total_amount"]),
        reverse=True,
    )
    signals = []
    if similar:
        signals.append(
            {"type": "similar_notices", "label": f"유사공고 {len(similar)}건", "tone": "info"}
        )
    if company_items and company_items[0]["award_count"] >= 2:
        top = company_items[0]
        signals.append(
            {
                "type": "repeat_award",
                "label": f"{top['company_name']} 반복 낙찰 {top['award_count']}회",
                "tone": "relation",
            }
        )
        concentration = round(top["award_count"] / len(similar) * 100) if similar else 0
        if concentration >= 50 and len(similar) >= 3:
            signals.append(
                {
                    "type": "concentration",
                    "label": f"상위 업체 낙찰 비중 {concentration}%",
                    "tone": "review",
                }
            )
    response = {
        "query_basis": similar_policy.get(
            "classification_basis", "organization_official_field_contracts"
        ),
        "signals": signals,
        "companies": company_items,
        "similar_notices": similar,
        "sample_size": len(similar),
        "period_years": similar_policy.get("period_years", 5),
    }
    _market_context_cache.set(notice_id, response)
    return response
