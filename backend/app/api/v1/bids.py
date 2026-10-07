import asyncio
import math
from datetime import UTC, datetime, timedelta
from time import monotonic
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.integrations.teoria import teoria_client
from app.services.teoria_adapter import (
    contract,
    notice,
    objects_of,
    participation_finding,
    participation_finding_evidence,
    requirement,
    requirement_evidence,
    requirement_set,
    split_notice_id,
)

router = APIRouter()
_notice_search_cache: dict[tuple, tuple[float, dict]] = {}
_NOTICE_SEARCH_CACHE_TTL_SECONDS = 60
_market_context_cache: dict[str, tuple[float, dict]] = {}
_MARKET_CONTEXT_CACHE_TTL_SECONDS = 600
_organization_field_company_cache: dict[str, tuple[float, dict]] = {}

_SIMILARITY_REASON_LABELS = {
    "notice_title_similar": "공고명 유사",
    "industry_requirements_matched": "요구 업종 일치",
    "product_requirements_matched": "요구 품목 일치",
    "similar_amount_range": "금액대 유사",
    "contract_method_matched": "계약방법 일치",
}


def _company_activity_items(similar_history: dict, relationship: dict, similar_by_id: dict[str, dict]) -> list[dict]:
    raw_items = similar_history.get("activities") or []
    if not raw_items:
        participation_ids = similar_history.get("matched_participation_bid_notice_ids", [])
        award_ids = similar_history.get("matched_award_bid_notice_ids", [])
        contract_ids = similar_history.get("matched_contract_bid_notice_ids", [])
        result = [
            {
                "bid_notice_id": bid_notice_id,
                "notice_name": similar_by_id.get(bid_notice_id, {}).get("notice_name"),
                "organization_code": similar_by_id.get(bid_notice_id, {}).get("organization_code"),
                "organization_name": similar_by_id.get(bid_notice_id, {}).get("organization_name"),
                "notice_published_date": similar_by_id.get(bid_notice_id, {}).get("notice_published_date"),
                "participated": bid_notice_id in participation_ids,
                "awarded": bid_notice_id in award_ids,
                "contracted": bid_notice_id in contract_ids,
                "result": "awarded" if bid_notice_id in award_ids else "contracted" if bid_notice_id in contract_ids else "participation_only",
                "activity_date": similar_by_id.get(bid_notice_id, {}).get("award_date"),
                "winning_amount": similar_by_id.get(bid_notice_id, {}).get("winning_amount"),
                "is_similar_notice": True,
                "is_same_organization": similar_by_id.get(bid_notice_id, {}).get("organization_code") == relationship.get("organization_code"),
            }
            for bid_notice_id in dict.fromkeys([*participation_ids, *award_ids, *contract_ids])
        ]
    else:
        contracted_notice_ids = {
            item.get("bid_notice_id") for item in raw_items if item.get("result") == "contracted"
        }
        opening_notice_ids = {
            item.get("bid_notice_id") for item in raw_items if item.get("result") != "contracted"
        }
        latest_contract_by_notice: dict[str, dict] = {}
        selected = []
        for item in raw_items:
            bid_notice_id = item.get("bid_notice_id")
            if not bid_notice_id:
                continue
            if item.get("result") == "contracted":
                previous = latest_contract_by_notice.get(bid_notice_id)
                if previous is None or (item.get("activity_date") or "") > (previous.get("activity_date") or ""):
                    latest_contract_by_notice[bid_notice_id] = item
            else:
                selected.append(item)
        selected.extend(item for bid_notice_id, item in latest_contract_by_notice.items() if bid_notice_id not in opening_notice_ids)
        result = []
        for item in selected:
            bid_notice_id = item.get("bid_notice_id")
            source = similar_by_id.get(bid_notice_id, {})
            activity_result = item.get("result")
            result.append({
                "bid_notice_id": bid_notice_id,
                "notice_name": source.get("notice_name") or item.get("notice_name"),
                "organization_code": source.get("organization_code"),
                "organization_name": source.get("organization_name"),
                "notice_published_date": source.get("notice_published_date") or item.get("notice_published_date"),
                "bid_classification_number": item.get("bid_classification_number"),
                "rebid_number": item.get("rebid_number"),
                "opening_rank": item.get("opening_rank"),
                "bid_amount": item.get("bid_amount"),
                "winning_amount": item.get("winning_amount"),
                "result": activity_result,
                "activity_date": item.get("activity_date"),
                "participated": activity_result in {"awarded", "not_awarded", "participation_only"},
                "awarded": activity_result == "awarded",
                "contracted": bid_notice_id in contracted_notice_ids,
                "unified_contract_number": item.get("unified_contract_number"),
                "is_similar_notice": True,
                "is_same_organization": source.get("organization_code") == relationship.get("organization_code"),
            })

    by_key = {
        (item.get("bid_notice_id"), item.get("bid_classification_number"), item.get("rebid_number")): item
        for item in result
    }
    for item in relationship.get("activities") or []:
        key = (item.get("bid_notice_id"), item.get("bid_classification_number"), item.get("rebid_number"))
        existing = by_key.get(key)
        if existing:
            existing["is_same_organization"] = True
            continue
        activity_result = item.get("result")
        by_key[key] = {
            "bid_notice_id": item.get("bid_notice_id"),
            "notice_name": item.get("notice_name"),
            "organization_code": relationship.get("organization_code"),
            "organization_name": relationship.get("organization_name"),
            "notice_published_date": item.get("notice_published_date"),
            "bid_classification_number": item.get("bid_classification_number"),
            "rebid_number": item.get("rebid_number"),
            "opening_rank": item.get("opening_rank"),
            "bid_amount": item.get("bid_amount"),
            "winning_amount": item.get("winning_amount"),
            "result": activity_result,
            "activity_date": item.get("activity_date"),
            "participated": activity_result in {"awarded", "not_awarded", "participation_only"},
            "awarded": activity_result == "awarded",
            "contracted": activity_result == "contracted",
            "is_similar_notice": False,
            "is_same_organization": True,
        }
    result = list(by_key.values())
    return sorted(result, key=lambda item: item.get("activity_date") or "", reverse=True)


@router.get("")
async def search_notices(
    q: str | None = Query(None, max_length=200), published_from: datetime | None = None,
    published_to: datetime | None = None, deadline_from: datetime | None = None,
    deadline_to: datetime | None = None, contract_method: str | None = None,
    work_type: str | None = Query(None, pattern="^(none|goods|service|construction|foreign|other)(,(goods|service|construction|foreign|other))*$"),
    price_min: int | None = Query(None, ge=0), price_max: int | None = Query(None, ge=0),
    notice_organization_code: str | None = Query(None, max_length=50),
    demand_organization_code: str | None = Query(None, max_length=50),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    field_code: str | None = Query(None, max_length=20),
    include_history: bool = Query(False),
    lineage_mode: str = Query("grouped", pattern="^(all|latest_only|grouped)$"),
    sort: str = Query("published_desc", pattern="^(deadline_asc|published_desc)$"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
):
    cache_key = (
        q, published_from, published_to, deadline_from, deadline_to, contract_method,
        work_type, price_min, price_max, notice_organization_code,
        demand_organization_code, large_category, middle_category, field_code,
        include_history, lineage_mode, sort, page, page_size,
    )
    cached = _notice_search_cache.get(cache_key)
    if cached and monotonic() - cached[0] < _NOTICE_SEARCH_CACHE_TTL_SECONDS:
        return cached[1]
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
        return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_items": 0, "total_pages": 0}, "truncated": False, "registry_version": None}
    work_types = list(dict.fromkeys(work_type.split(","))) if work_type else []
    optional = {"query": q, "bid_deadline_at_from": deadline_from.isoformat() if deadline_from else None, "bid_deadline_at_to": deadline_to.isoformat() if deadline_to else None, "contract_method_name": contract_method, "estimated_price_min": price_min, "estimated_price_max": price_max, "notice_organization_code": notice_organization_code, "demand_organization_code": demand_organization_code, "large_category": large_category, "middle_category": middle_category, "field_code": field_code}
    inputs.update({key: value for key, value in optional.items() if value not in (None, "")})
    if len(work_types) <= 1:
        if work_types:
            inputs["work_type"] = work_types[0]
        data = await teoria_client.execute(
            "search_bid_notices",
            inputs,
            max_objects=min(page_size * 5, 1000),
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
        if len(_notice_search_cache) >= 200:
            oldest_key = min(_notice_search_cache, key=lambda key: _notice_search_cache[key][0])
            _notice_search_cache.pop(oldest_key, None)
        _notice_search_cache[cache_key] = (monotonic(), response)
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
                "search_bid_notices",
                grouped_inputs,
                max_objects=min(source_page_size * 5, 1000),
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
            by_id.values(),
            key=lambda item: (item.get("deadline_at") or "9999-12-31", item["id"]),
        )
    else:
        items = sorted(
            by_id.values(),
            key=lambda item: (item.get("published_at") or "", item["id"]),
            reverse=True,
        )
    start_index = (page - 1) * page_size
    total_items = sum(
        (group[0].get("pagination") or {}).get("total_items", 0)
        for group in grouped
        if group
    )
    response = {
        "items": items[start_index:start_index + page_size],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": math.ceil(total_items / page_size),
        },
        "truncated": any(result.get("truncated", False) for result in results),
        "registry_version": next(
            (result.get("registry", {}).get("version") for result in results if result.get("registry")),
            None,
        ),
    }
    if len(_notice_search_cache) >= 200:
        oldest_key = min(_notice_search_cache, key=lambda key: _notice_search_cache[key][0])
        _notice_search_cache.pop(oldest_key, None)
    _notice_search_cache[cache_key] = (monotonic(), response)
    return response


@router.get("/{notice_id}")
async def get_notice(notice_id: str):
    try: number, order = split_notice_id(notice_id)
    except ValueError as exc: raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
    base = await teoria_client.execute("get_bid_notice", {"notice_number": number, "notice_order": order}, max_objects=20)
    found = objects_of(base, "bid_notice")
    if not found: raise HTTPException(404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."})
    try:
        req_data = await teoria_client.execute("get_bid_requirements", {"notice_number": number, "notice_order": order}, max_objects=500, provenance=True)
        requirements = [requirement(obj) for obj in objects_of(req_data, "bid_requirement")]
        requirement_sets = [requirement_set(obj) for obj in objects_of(req_data, "bid_requirement_set")]
        evidence = [requirement_evidence(obj) for obj in objects_of(req_data, "bid_requirement_evidence")]
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
        if exc.status_code == 409: requirements, requirement_sets, requirement_state = [], [], "not_extracted"
        else: raise
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
        "notice": notice(found[0]),
        "requirements": requirements,
        "requirement_set": requirement_sets[0] if requirement_sets else None,
        "requirement_state": requirement_state,
        "participation_findings": participation_findings,
        "registry_version": (
            finding_data.get("registry", {}).get("version")
            if "finding_data" in locals()
            else base.get("registry", {}).get("version")
        ),
    }


@router.get("/{notice_id}/organization-field-companies")
async def get_notice_organization_field_companies(notice_id: str, period_years: int = Query(5, ge=1, le=10)):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
    canonical_id = f"{number}:{order}"
    cache_key = f"{canonical_id}:{period_years}"
    cached = _organization_field_company_cache.get(cache_key)
    if cached and monotonic() - cached[0] < _MARKET_CONTEXT_CACHE_TTL_SECONDS:
        return cached[1]
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
    if len(_organization_field_company_cache) >= 200:
        oldest_key = min(_organization_field_company_cache, key=lambda key: _organization_field_company_cache[key][0])
        _organization_field_company_cache.pop(oldest_key, None)
    _organization_field_company_cache[cache_key] = (monotonic(), response)
    return response


@router.get("/{notice_id}/participation-context")
async def get_notice_participation_context(notice_id: str, period_years: int = Query(3, ge=1, le=10)):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
    data = await teoria_client.execute(
        "analyze_bid_participation_context",
        {"bid_notice_id": f"{number}:{order}", "period_years": period_years},
        max_objects=100,
    )
    outcome = data.get("outcome") or {}
    outcome.setdefault("registry_version", data.get("registry", {}).get("version"))
    return outcome


@router.get("/{notice_id}/related-projects")
async def search_notice_related_projects(
    notice_id: str,
    project_filter: str = Query("all", pattern="^(all|similar_amount|entry_or_reentering_supplier|repeat_supplier)$"),
    project_filters: Annotated[list[str] | None, Query()] = None,
    filter_operator: str = Query("and", pattern="^(and|or)$"),
    sort: str = Query("recent_desc", pattern="^(recent_desc|amount_desc|amount_similarity)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
    allowed_filters = {"similar_amount", "entry_or_reentering_supplier", "repeat_supplier"}
    normalized_filters = list(dict.fromkeys(project_filters or []))
    if any(item not in allowed_filters for item in normalized_filters):
        raise HTTPException(422, detail={"code": "invalid_project_filters", "message": "지원하지 않는 계약 이력 필터입니다."})
    inputs = {"bid_notice_id": f"{number}:{order}", "project_filter": project_filter, "sort": sort, "page": page, "page_size": page_size}
    if project_filters is not None:
        inputs.update({"project_filters": normalized_filters, "filter_operator": filter_operator})
    data = await teoria_client.execute(
        "search_bid_related_projects",
        inputs,
        max_objects=min(page_size * 5, 500),
    )
    outcome = data.get("outcome") or {}
    outcome.setdefault("registry_version", data.get("registry", {}).get("version"))
    return outcome


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
        raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
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
        raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
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
    try: number, order = split_notice_id(notice_id)
    except ValueError as exc: raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
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
    outcome = context.get("outcome") or {}
    if not outcome.get("bid_notice"):
        raise HTTPException(404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."})

    participants = outcome.get("participants") or []
    participation_outcome = participation_data.get("outcome") or {}
    opening_events = participation_outcome.get("opening_events") or []
    participations = []
    awards = []
    contracted_participants = []
    for event_index, event in enumerate(opening_events):
        for participant_index, item in enumerate(event.get("participants") or []):
            company_number = item.get("business_registration_number")
            participations.append({
                "id": f"{canonical_id}:participation:{event.get('bid_classification_number') or event_index}:{event.get('rebid_number') or '000'}:{company_number or participant_index}",
                "bid_notice_id": canonical_id,
                "notice_number": number,
                "notice_order": order,
                "bid_classification_number": event.get("bid_classification_number"),
                "rebid_number": event.get("rebid_number"),
                "company_number": company_number,
                "company_name": item.get("company_name"),
                "rank": item.get("opening_rank"),
                "bid_amount": item.get("bid_amount"),
                "bid_rate": item.get("bid_rate"),
                "result": item.get("result"),
                "result_confirmed": item.get("result_confirmed"),
            })
    for index, item in enumerate(participants):
        company_number = item.get("business_registration_number")
        company_name = item.get("company_name")
        current_award = item.get("current_award") or {}
        if current_award.get("awarded"):
            awards.append({
                "id": f"{canonical_id}:award:{company_number or index}",
                "bid_notice_id": canonical_id,
                "notice_number": number,
                "notice_order": order,
                "notice_name": outcome["bid_notice"].get("notice_name"),
                "company_number": company_number,
                "company_name": company_name,
                "winning_amount": current_award.get("winning_amount"),
                "winning_rate": current_award.get("winning_rate"),
                "award_date": current_award.get("award_date"),
                "organization_code": outcome["bid_notice"].get("organization_code"),
                "organization_name": outcome["bid_notice"].get("organization_name"),
            })
        current_contract = item.get("current_contract") or {}
        if current_contract.get("contracted"):
            contracted_participants.append((item, current_contract))

    contracts = [contract(obj) for obj in objects_of(contract_data, "contract")]
    if contracted_participants:
        representative = contracted_participants[0][1]
        contractors = [{
            "business_registration_number": item.get("business_registration_number"),
            "company_name": item.get("company_name"),
            "company_role": current.get("company_role"),
            "share_percent": current.get("share_percent"),
            "share_completeness": "complete" if current.get("share_percent") is not None else "unknown",
        } for item, current in contracted_participants]
        lead = next((item for item in contractors if item.get("company_role") in {"sole", "consortium_lead"}), contractors[0])
        relationship_contract = {
            "id": f"{canonical_id}:contract",
            "name": outcome["bid_notice"].get("notice_name"),
            "notice_number": number,
            "bid_notice_id": canonical_id,
            "amount": representative.get("contract_amount"),
            "concluded_date": representative.get("contract_date"),
            "contractors": contractors,
            "lead_contractor": lead,
            "contractor_count": len(contractors),
            "contractor_completeness": outcome.get("data_completeness", {}).get("status"),
        }
        if contracts:
            for contract_item in contracts:
                contract_item["contractors"] = contractors
                contract_item["lead_contractor"] = lead
                contract_item["contractor_count"] = len(contractors)
                contract_item["contractor_completeness"] = outcome.get("data_completeness", {}).get("status")
        else:
            contracts.append(relationship_contract)

    return {
        "participations": participations,
        "opening_events": opening_events,
        "participation_summary": {
            "source_participant_count": sum(event.get("source_participant_count") or 0 for event in opening_events),
            "stored_participant_count": sum(event.get("stored_participant_count") or 0 for event in opening_events),
            "returned_participant_count": sum(event.get("returned_participant_count") or 0 for event in opening_events),
            "retention_policy": next((event.get("retention_policy") for event in opening_events if event.get("retention_policy")), None),
            "data_completeness": participation_outcome.get("data_completeness") or {},
        },
        "awards": awards,
        "contracts": contracts,
        "contract_pagination": {"page": 1, "page_size": len(contracts), "total_items": len(contracts), "total_pages": 1 if contracts else 0},
        "registry_version": context.get("registry", {}).get("version"),
    }


@router.get("/{notice_id}/relationship-context")
async def get_bid_relationship_context(notice_id: str, relationship_history_years: int = Query(5, ge=1, le=10)):
    try:
        split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
    data = await teoria_client.execute(
        "get_bid_notice_relationship_context",
        {"bid_notice_id": notice_id, "relationship_history_years": relationship_history_years},
        max_objects=500,
    )
    return {**(data.get("outcome") or {}), "registry_version": data.get("registry", {}).get("version")}


@router.get("/{notice_id}/market-context")
async def get_notice_market_context(notice_id: str):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "invalid_bid_notice_id", "message": "공고 ID는 공고번호:차수 형식이어야 합니다."}) from exc
    cached = _market_context_cache.get(notice_id)
    if cached and monotonic() - cached[0] < _MARKET_CONTEXT_CACHE_TTL_SECONDS:
        return cached[1]
    base, similar_data = await asyncio.gather(
        teoria_client.execute("get_bid_notice", {"notice_number": number, "notice_order": order}, max_objects=10),
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
    found = objects_of(base, "bid_notice")
    if not found:
        raise HTTPException(404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."})
    current = notice(found[0])
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
            "company_number": item.get("company_number") or (item.get("contractors") or [{}])[0].get("company_number"),
            "company_name": item.get("company_name") or (item.get("contractors") or [{}])[0].get("company_name"),
            "winning_amount": item.get("attributed_contract_amount") or item.get("contract_amount"),
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
        company = companies.setdefault(company_number, {"company_number": company_number, "company_name": item.get("company_name"), "participation_count": 0, "award_count": 0, "contract_count": 0, "organization_participation_count": 0, "organization_award_count": 0, "organization_contract_count": 0, "organization_contract_amount": None, "organization_similar_participation_count": 0, "organization_similar_award_count": 0, "organization_similar_contract_count": 0, "region_status": "unknown", "total_amount": 0, "latest_award_date": None, "notice_ids": [], "activities": []})
        company["award_count"] += 1
        if current.get("organization_code") and item.get("organization_code") == current.get("organization_code"):
            company["organization_award_count"] += 1
            company["organization_similar_award_count"] += 1
        company["total_amount"] += item.get("winning_amount") or 0
        company["notice_ids"].append(item.get("bid_notice_id"))
        if (item.get("award_date") or "") > (company["latest_award_date"] or ""):
            company["latest_award_date"] = item.get("award_date")
    company_items = sorted(companies.values(), key=lambda item: (item["award_count"], item["total_amount"]), reverse=True)
    signals = []
    if similar:
        signals.append({"type": "similar_notices", "label": f"유사공고 {len(similar)}건", "tone": "info"})
    if company_items and company_items[0]["award_count"] >= 2:
        top = company_items[0]
        signals.append({"type": "repeat_award", "label": f"{top['company_name']} 반복 낙찰 {top['award_count']}회", "tone": "relation"})
        concentration = round(top["award_count"] / len(similar) * 100) if similar else 0
        if concentration >= 50 and len(similar) >= 3:
            signals.append({"type": "concentration", "label": f"상위 업체 낙찰 비중 {concentration}%", "tone": "review"})
    response = {
        "query_basis": similar_policy.get("classification_basis", "organization_official_field_contracts"),
        "signals": signals,
        "companies": company_items,
        "similar_notices": similar,
        "sample_size": len(similar),
        "period_years": similar_policy.get("period_years", 5),
    }
    if len(_market_context_cache) >= 200:
        oldest_key = min(_market_context_cache, key=lambda key: _market_context_cache[key][0])
        _market_context_cache.pop(oldest_key, None)
    _market_context_cache[notice_id] = (monotonic(), response)
    return response
