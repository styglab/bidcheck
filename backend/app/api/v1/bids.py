import asyncio
import math
from datetime import datetime, timedelta, timezone
from time import monotonic

from fastapi import APIRouter, HTTPException, Query

from app.integrations.teoria import teoria_client
from app.services.teoria_adapter import (
    award,
    contract,
    notice,
    opening_participation,
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
    sort: str = Query("published_desc", pattern="^(deadline_asc|published_desc)$"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
):
    cache_key = (
        q, published_from, published_to, deadline_from, deadline_to, contract_method,
        work_type, price_min, price_max, notice_organization_code,
        demand_organization_code, sort, page, page_size,
    )
    cached = _notice_search_cache.get(cache_key)
    if cached and monotonic() - cached[0] < _NOTICE_SEARCH_CACHE_TTL_SECONDS:
        return cached[1]
    end = published_to or datetime.now(timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    start = published_from or end - timedelta(days=90)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    inputs = {
        "notice_published_at_from": start.isoformat(),
        "notice_published_at_to": end.isoformat(),
        "bid_statuses": ["scheduled", "open", "unknown"],
        "notice_status": "active",
        "sort": sort,
        "page": page,
        "page_size": page_size,
    }
    if work_type == "none":
        return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_items": 0, "total_pages": 0}, "truncated": False, "registry_version": None}
    work_types = list(dict.fromkeys(work_type.split(","))) if work_type else []
    optional = {"query": q, "bid_deadline_at_from": deadline_from.isoformat() if deadline_from else None, "bid_deadline_at_to": deadline_to.isoformat() if deadline_to else None, "contract_method_name": contract_method, "estimated_price_min": price_min, "estimated_price_max": price_max, "notice_organization_code": notice_organization_code, "demand_organization_code": demand_organization_code}
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
        "analyze_bid_organization_field_companies",
        {"bid_notice_id": canonical_id, "period_years": period_years},
        max_objects=300,
    )
    outcome = data.get("outcome") or {}
    response = {
        "bid_notice_id": canonical_id,
        "organization": outcome.get("organization"),
        "analysis_basis": outcome.get("analysis_basis") or {},
        "market_structure": outcome.get("market_structure") or {},
        "market_entry": outcome.get("market_entry") or {},
        "organization_field_companies": outcome.get("organization_field_companies") or [],
        "market_similar_companies": outcome.get("market_similar_companies") or [],
        "organization_other_companies": outcome.get("organization_other_companies") or [],
        "policy": outcome.get("policy") or {},
        "registry_version": data.get("registry", {}).get("version"),
    }
    if len(_organization_field_company_cache) >= 200:
        oldest_key = min(_organization_field_company_cache, key=lambda key: _organization_field_company_cache[key][0])
        _organization_field_company_cache.pop(oldest_key, None)
    _organization_field_company_cache[cache_key] = (monotonic(), response)
    return response


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
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=3650)
    base = await teoria_client.execute("get_bid_notice", {"notice_number": number, "notice_order": order}, max_objects=10)
    found = objects_of(base, "bid_notice")
    if not found: raise HTTPException(404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."})
    participation_task = teoria_client.execute("search_bid_participations", {"notice_number": number, "opening_at_from": start.isoformat(), "opening_at_to": now.isoformat(), "page": 1, "page_size": 100}, max_objects=300)
    award_task = teoria_client.execute("search_bid_awards", {"query": number, "opening_at_from": start.isoformat(), "opening_at_to": now.isoformat(), "page": 1, "page_size": 20}, max_objects=100)
    contract_task = teoria_client.execute("get_bid_notice_contracts", {"notice_number": number, "page": 1, "page_size": 20}, max_objects=60)
    participations, awards, contracts = await asyncio.gather(participation_task, award_task, contract_task)
    return {"participations": [opening_participation(obj) for obj in objects_of(participations, "bid_opening_participation")], "awards": [award(obj) for obj in objects_of(awards, "bid_award") if obj.get("properties", {}).get("notice_number") == number], "contracts": [contract(obj) for obj in objects_of(contracts, "contract")], "contract_pagination": contracts.get("pagination", {})}


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
            "find_similar_bid_notices",
            {
                "bid_notice_id": notice_id,
                "period_years": 5,
                "result_statuses": ["awarded", "contracted"],
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
    similar_policy = similar_outcome.get("policy", {})
    similar = [
        {
            "id": item.get("bid_notice_id"),
            "bid_notice_id": item.get("bid_notice_id"),
            "notice_number": str(item.get("bid_notice_id") or "").split(":", 1)[0],
            "notice_order": str(item.get("bid_notice_id") or ":").split(":", 1)[-1],
            "notice_name": item.get("notice_name"),
            "organization_code": item.get("organization_code"),
            "organization_name": item.get("organization_name"),
            "estimated_price": item.get("estimated_price"),
            "company_number": item.get("winning_company_number"),
            "company_name": item.get("winning_company_name"),
            "winning_amount": item.get("winning_amount"),
            "winning_rate": item.get("winning_rate"),
            "award_date": item.get("award_date"),
            "notice_published_date": item.get("notice_published_date"),
            "similarity_score": round((item.get("similarity_score") or 0) * 100),
            "similarity_level": item.get("similarity_level"),
            "similarity_reasons": [
                _SIMILARITY_REASON_LABELS.get(reason, reason)
                for reason in item.get("similarity_reasons", [])
            ],
            "matched_features": item.get("matched_features", {}),
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
    similar_notice_ids = [item.get("bid_notice_id") for item in similar if item.get("bid_notice_id")]
    if similar_notice_ids:
        try:
            relevant_data = await teoria_client.execute(
                "find_bid_relevant_companies",
                {"bid_notice_id": current["id"], "similar_bid_notice_ids": similar_notice_ids, "limit": 50},
                max_objects=200,
            )
            relevant_items = relevant_data.get("outcome", {}).get("items", [])
            company_items = []
            if relevant_items:
                similar_by_id = {item.get("bid_notice_id"): item for item in similar if item.get("bid_notice_id")}
                for item in relevant_items:
                    similar_history = item.get("similar_history", {})
                    relationship = item.get("organization_relationship", {})
                    region_status = item.get("region_eligibility", {}).get("status", item.get("region_status", "unknown"))
                    industry_eligibility = item.get("industry_license_eligibility", {})
                    industry_license_status = industry_eligibility.get("status", "unknown")
                    if region_status not in {"satisfied", "not_applicable"} or industry_license_status not in {"satisfied", "not_applicable"}:
                        continue
                    participation_ids = similar_history.get("matched_participation_bid_notice_ids", [])
                    award_ids = similar_history.get("matched_award_bid_notice_ids", [])
                    contract_ids = similar_history.get("matched_contract_bid_notice_ids", [])
                    activity_ids = list(dict.fromkeys([*participation_ids, *award_ids, *contract_ids]))
                    organization_similar_ids = {
                        bid_notice_id for bid_notice_id in activity_ids
                        if similar_by_id.get(bid_notice_id, {}).get("organization_code") == current.get("organization_code")
                    }
                    company_items.append({
                        "company_number": item.get("company_number"),
                        "company_name": item.get("company_name"),
                        "participation_count": similar_history.get("participation_count", 0),
                        "award_count": similar_history.get("award_count", 0),
                        "contract_count": similar_history.get("contract_count", 0),
                        "total_amount": similar_history.get("award_amount") or 0,
                        "latest_award_date": similar_history.get("latest_activity_date"),
                        "organization_participation_count": relationship.get("participation_count", 0),
                        "organization_award_count": relationship.get("award_count", 0),
                        "organization_contract_count": relationship.get("contract_count", 0),
                        "organization_contract_amount": relationship.get("contract_amount"),
                        "organization_latest_activity_date": relationship.get("latest_activity_date"),
                        "organization_similar_participation_count": len(organization_similar_ids.intersection(participation_ids)),
                        "organization_similar_award_count": len(organization_similar_ids.intersection(award_ids)),
                        "organization_similar_contract_count": len(organization_similar_ids.intersection(contract_ids)),
                        "region_status": region_status,
                        "industry_license_status": industry_license_status,
                        "required_industries": industry_eligibility.get("required_industries", []),
                        "required_licenses": industry_eligibility.get("required_licenses", []),
                        "matched_industries": industry_eligibility.get("matched_industries", []),
                        "matched_licenses": industry_eligibility.get("matched_licenses", []),
                        "industry_license_reference_date": industry_eligibility.get("reference_date"),
                        "signals": item.get("signals", []),
                        "notice_ids": activity_ids,
                        "activities": _company_activity_items(similar_history, relationship, similar_by_id),
                    })
        except HTTPException:
            company_items = []
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
        "query_basis": similar_policy.get("similarity_profile", "bid_similarity_v1"),
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
