from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query

from app.services.field_explorer_service import field_context, search_fields
from app.services.procurement_cache import cached_runtime_read
from app.services.teoria_adapter import notice, notice_object, objects_of, split_notice_id

router = APIRouter()


@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(min_length=2, max_length=200),
    limit: int = Query(20, ge=1, le=20),
    cursor: str | None = Query(None, max_length=500),
):
    data = await cached_runtime_read(
        "autocomplete_procurement_entities",
        {"query": q, "limit": limit, **({"cursor": cursor} if cursor else {})},
        max_objects=25,
    )
    return data.get("outcome") or {}


@router.get("/network")
async def network(
    root_type: str = Query(pattern="^(organization|company|field)$"),
    root_id: str = Query(min_length=1, max_length=50),
    field_code: str = Query(min_length=1, max_length=20),
    from_year: int = Query(ge=2000),
    to_year: int = Query(ge=2000),
    work_type: str | None = Query(
        None, pattern="^(goods|service|construction|foreign|other|unknown)$"
    ),
    first_hop_limit: int = Query(10, ge=1, le=100),
    second_hop_limit: int = Query(20, ge=1, le=200),
):
    validate_period(from_year, to_year)
    data = await cached_runtime_read(
        "get_procurement_network",
        {
            "root_type": root_type,
            "root_id": root_id,
            "field_code": field_code,
            "period_from_year": from_year,
            "period_to_year": to_year,
            "depth": 2,
            "first_hop_limit": first_hop_limit,
            "second_hop_limit": second_hop_limit,
            **({"work_type": work_type} if work_type else {}),
        },
        max_objects=500,
    )
    return data.get("outcome") or {}


@router.get("/field-market")
async def field_market(
    field_code: str = Query(min_length=1, max_length=20),
    from_year: int = Query(ge=2000),
    to_year: int = Query(ge=2000),
    work_type: str | None = Query(
        None, pattern="^(goods|service|construction|foreign|other|unknown)$"
    ),
):
    validate_period(from_year, to_year)
    data = await cached_runtime_read(
        "analyze_procurement_field_market",
        {
            "field_code": field_code,
            "period_from_year": from_year,
            "period_to_year": to_year,
            **({"work_type": work_type} if work_type else {}),
        },
        max_objects=20,
    )
    return data.get("outcome") or {}


@router.get("/region-options")
async def region_options():
    data = await cached_runtime_read("get_procurement_region_filter_options", {}, max_objects=30)
    return data.get("outcome") or {}


def validate_period(from_year: int, to_year: int):
    if from_year > to_year or to_year > datetime.now(UTC).year or to_year - from_year > 4:
        raise HTTPException(
            422,
            detail={
                "code": "invalid_period",
                "message": "최근 5개년 이내의 조회 기간을 선택해 주세요.",
            },
        )


@router.get("/fields")
async def fields(
    q: str = Query(min_length=2, max_length=200),
    from_year: int = Query(ge=2000),
    to_year: int = Query(ge=2000),
    work_type: str | None = Query(
        None, pattern="^(goods|service|construction|foreign|other|unknown)$"
    ),
):
    validate_period(from_year, to_year)
    return await search_fields(q, from_year, to_year, work_type)


@router.get("/field-context")
async def market(
    from_year: int = Query(ge=2000),
    to_year: int = Query(ge=2000),
    field_code: str | None = Query(None, max_length=20),
    large_category: str | None = Query(None, max_length=200),
    middle_category: str | None = Query(None, max_length=200),
    work_type: str | None = Query(
        None, pattern="^(goods|service|construction|foreign|other|unknown)$"
    ),
    q: str | None = Query(None, max_length=200),
):
    validate_period(from_year, to_year)
    if not (field_code or large_category or middle_category or q):
        raise HTTPException(
            422, detail={"code": "field_required", "message": "분야 또는 품목을 선택해 주세요."}
        )
    return await field_context(
        from_year, to_year, field_code, large_category, middle_category, work_type, q
    )


@router.get("/notice-context/{notice_id}")
async def notice_context(notice_id: str):
    try:
        number, order = split_notice_id(notice_id)
    except ValueError as exc:
        raise HTTPException(
            422,
            detail={"code": "invalid_bid_notice_id", "message": "공고번호와 차수를 확인해 주세요."},
        ) from exc
    data = await cached_runtime_read(
        "get_bid_notice", {"notice_number": number, "notice_order": order}, max_objects=20
    )
    found = notice_object(data, notice_id)
    if not found:
        raise HTTPException(
            404, detail={"code": "bid_notice_not_found", "message": "공고를 찾을 수 없습니다."}
        )
    current = notice(found)
    if not any(current.get(key) for key in ("field_code", "large_category", "middle_category")):
        try:
            context = await cached_runtime_read(
                "analyze_bid_participation_context",
                {"bid_notice_id": notice_id, "period_years": 3},
                max_objects=500,
            )
        except HTTPException:
            # An unavailable analysis must not prevent institution exploration.
            context = {}
        basis = (context.get("outcome") or {}).get("analysis_basis") or {}
        official_field = basis.get("field_filter") or {}
        if not context.get("truncated"):
            for key in ("field_code", "field_name", "large_category", "middle_category"):
                if official_field.get(key):
                    current[key] = official_field[key]
    org = next(
        (
            o.get("properties", {})
            for o in objects_of(data, "public_organization")
            if o.get("properties", {}).get("organization_code") == current.get("organization_code")
        ),
        {},
    )
    # Preserve only explicit upstream geography; never infer it from the institution name.
    return {
        "notice": current,
        "region_code": org.get("region_code"),
        "region_name": org.get("region_name"),
        "region_basis": "발주기관 소재지",
        "region_supported": False,
        "truncated": bool(data.get("truncated")),
    }
