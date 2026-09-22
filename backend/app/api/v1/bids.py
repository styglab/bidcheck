import asyncio
import math
import re
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
    split_notice_id,
)

router = APIRouter()
_notice_search_cache: dict[tuple, tuple[float, dict]] = {}
_NOTICE_SEARCH_CACHE_TTL_SECONDS = 60

_TITLE_STOP_WORDS = {
    "사업", "용역", "구매", "공고", "입찰", "계약", "시스템", "구축", "운영", "유지", "관리",
    "제작", "설치", "개발", "년도", "년", "재공고", "긴급", "견적", "제출", "안내",
}


def _title_tokens(value: str | None) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[가-힣A-Za-z0-9]+", value or "")
        if len(token) >= 2 and token.lower() not in _TITLE_STOP_WORDS and not token.isdigit()
    }


def _title_ngrams(value: str | None) -> set[str]:
    normalized = re.sub(r"[^가-힣a-z0-9]", "", (value or "").lower())
    for word in _TITLE_STOP_WORDS:
        normalized = normalized.replace(word, "")
    return {normalized[index:index + 2] for index in range(max(0, len(normalized) - 1))}


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
        if exc.status_code == 409: requirements, requirement_state = [], "not_extracted"
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
        "requirement_state": requirement_state,
        "participation_findings": participation_findings,
        "registry_version": (
            finding_data.get("registry", {}).get("version")
            if "finding_data" in locals()
            else base.get("registry", {}).get("version")
        ),
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
    base = await teoria_client.execute("get_bid_notice", {"notice_number": number, "notice_order": order}, max_objects=10)
    found = objects_of(base, "bid_notice")
    if not found:
        raise HTTPException(404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."})
    current = notice(found[0])
    tokens = _title_tokens(current.get("name"))
    search_terms = sorted(tokens, key=len, reverse=True)[:3] or [current.get("name", "")[:30]]
    query = " · ".join(search_terms)
    now = datetime.now(timezone.utc)
    inputs = {
        "opening_at_from": (now - timedelta(days=1825)).isoformat(),
        "opening_at_to": now.isoformat(),
        "page": 1,
        "page_size": 100,
        "sort": "award_desc",
    }
    searches = await asyncio.gather(*(
        teoria_client.execute("search_bid_awards", {**inputs, "query": term}, max_objects=400)
        for term in search_terms
    ))
    candidates: dict[str, dict] = {}
    for data in searches:
        for obj in objects_of(data, "bid_award"):
            key = str(obj.get("id") or obj.get("properties", {}).get("award_id") or len(candidates))
            candidates[key] = obj
    similar = []
    for obj in candidates.values():
        item = award(obj)
        if item.get("notice_number") == number:
            continue
        other_tokens = _title_tokens(item.get("notice_name"))
        overlap = tokens & other_tokens
        current_grams = _title_ngrams(current.get("name"))
        other_grams = _title_ngrams(item.get("notice_name"))
        gram_score = len(current_grams & other_grams) / max(len(current_grams | other_grams), 1)
        if not overlap and gram_score < 0.35:
            continue
        item["similarity_reasons"] = sorted(overlap, key=len, reverse=True)[:4] or ["공고명 표현 유사"]
        token_score = len(overlap) / max(len(tokens), 1)
        item["similarity_score"] = round(max(token_score, gram_score) * 100)
        similar.append(item)
    similar.sort(key=lambda item: (item["similarity_score"], item.get("award_date") or ""), reverse=True)
    similar = similar[:12]
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
                        "activities": [
                            {
                                "bid_notice_id": bid_notice_id,
                                "notice_name": similar_by_id.get(bid_notice_id, {}).get("notice_name"),
                                "organization_code": similar_by_id.get(bid_notice_id, {}).get("organization_code"),
                                "organization_name": similar_by_id.get(bid_notice_id, {}).get("organization_name"),
                                "participated": bid_notice_id in participation_ids,
                                "awarded": bid_notice_id in award_ids,
                                "contracted": bid_notice_id in contract_ids,
                                "award_date": similar_by_id.get(bid_notice_id, {}).get("award_date"),
                                "winning_amount": similar_by_id.get(bid_notice_id, {}).get("winning_amount"),
                            }
                            for bid_notice_id in activity_ids
                        ],
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
    return {"query_basis": query, "signals": signals, "companies": company_items, "similar_notices": similar, "sample_size": len(similar), "period_years": 5}
