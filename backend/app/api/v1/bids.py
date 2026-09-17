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
    split_notice_id,
)

router = APIRouter()
_notice_search_cache: dict[tuple, tuple[float, dict]] = {}
_NOTICE_SEARCH_CACHE_TTL_SECONDS = 60


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
