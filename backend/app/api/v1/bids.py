from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

from app.integrations.teoria import teoria_client
from app.services.teoria_adapter import notice, objects_of, requirement, split_notice_id

router = APIRouter()


@router.get("")
async def search_notices(
    q: str | None = Query(None, max_length=200), published_from: datetime | None = None,
    published_to: datetime | None = None, deadline_from: datetime | None = None,
    deadline_to: datetime | None = None, contract_method: str | None = None,
    work_type: str | None = Query(None, pattern="^(goods|service|construction|foreign|other)$"),
    price_min: int | None = Query(None, ge=0), price_max: int | None = Query(None, ge=0),
    sort: str = Query("deadline_asc", pattern="^(deadline_asc|published_desc)$"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
):
    end = published_to or datetime.now(timezone.utc); start = published_from or end - timedelta(days=30)
    inputs = {"notice_published_at_from": start.isoformat(), "notice_published_at_to": end.isoformat(), "bid_status": "open", "sort": sort, "page": page, "page_size": page_size}
    optional = {"query": q, "work_type": work_type, "bid_deadline_at_from": deadline_from.isoformat() if deadline_from else None, "bid_deadline_at_to": deadline_to.isoformat() if deadline_to else None, "contract_method_name": contract_method, "estimated_price_min": price_min, "estimated_price_max": price_max}
    inputs.update({key: value for key, value in optional.items() if value not in (None, "")})
    data = await teoria_client.execute("search_bid_notices", inputs, max_objects=min(page_size * 5, 1000))
    items = [notice(obj) for obj in objects_of(data, "bid_notice")]
    pagination = data.get("pagination") or {"page": page, "page_size": page_size, "total_items": len(items), "total_pages": 1 if items else 0}
    return {"items": items, "pagination": pagination, "truncated": data.get("truncated", False), "registry_version": data.get("registry", {}).get("version")}


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
        requirement_state = "ready"
    except HTTPException as exc:
        if exc.status_code == 409: requirements, requirement_state = [], "not_extracted"
        else: raise
    return {"notice": notice(found[0]), "requirements": requirements, "requirement_state": requirement_state, "registry_version": base.get("registry", {}).get("version")}
