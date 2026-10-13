"""Bounded Runtime contract samples for field discovery, never a market census."""

import asyncio
from datetime import UTC, datetime

from fastapi import HTTPException

from app.services.procurement_cache import cached_runtime_read
from app.services.teoria_adapter import contract, objects_of


def contract_sample(data: dict) -> list[dict]:
    organizations = {
        obj["id"]: obj.get("properties", {}) for obj in objects_of(data, "public_organization")
    }
    owners = {
        link["target"]: organizations.get(link.get("source"), {})
        for link in data.get("links", [])
        if link.get("type") == "public_organization_awards_contract"
    }
    rows = {}
    for obj in objects_of(data, "contract"):
        row = contract(obj)
        org = owners.get(obj.get("id"), {})
        row.update(
            organization_code=org.get("organization_code"), organization_name=org.get("name")
        )
        if row.get("id"):
            rows[row["id"]] = row
    return list(rows.values())


async def search_fields(query: str, from_year: int, to_year: int, work_type: str | None) -> dict:
    data = await cached_runtime_read(
        "get_procurement_classification_catalog",
        {
            "query": query,
            "limit": 20,
            **({"work_type": work_type} if work_type else {}),
        },
        max_objects=20,
    )
    outcome = data.get("outcome") or {}
    items = outcome.get("items")
    if not isinstance(items, list):
        raise HTTPException(
            502,
            detail={
                "code": "teoria_invalid_response",
                "message": "분야 목록의 응답 형식을 확인할 수 없습니다.",
            },
        )
    return {
        "items": [item for item in items if isinstance(item, dict) and item.get("field_code")],
        "sampled": False,
        "truncated": bool(data.get("truncated")),
        "coverage": outcome.get("coverage"),
        "updated_at": outcome.get("updated_at"),
    }


async def field_context(
    from_year: int,
    to_year: int,
    field_code: str | None,
    large_category: str | None,
    middle_category: str | None,
    work_type: str | None,
    query: str | None,
) -> dict:
    inputs = {
        k: v
        for k, v in {
            "field_code": field_code,
            "large_category": large_category,
            "middle_category": middle_category,
            "work_type": work_type,
            "query": query,
        }.items()
        if v
    }

    async def annual(year):
        data = await cached_runtime_read(
            "search_public_procurement_contracts",
            {
                **inputs,
                "concluded_date_from": f"{year}-01-01",
                "concluded_date_to": min(f"{year}-12-31", datetime.now(UTC).date().isoformat()),
                "page": 1,
                "page_size": 100,
                "sort": "amount_desc",
            },
            max_objects=500,
        )
        rows = contract_sample(data)
        suppliers = {
            c.get("business_registration_number")
            for row in rows
            for c in row.get("contractors", [])
            if c.get("business_registration_number")
        }
        return rows, {
            "year": year,
            "contract_record_count": len(rows),
            "supplier_count": len(suppliers),
            "contract_amount": sum(r["amount"] for r in rows)
            if rows and all(r.get("amount") is not None for r in rows)
            else None,
            "total_records": (data.get("pagination") or {}).get("total_items"),
            "truncated": bool(data.get("truncated")),
        }

    results = await asyncio.gather(*(annual(y) for y in range(from_year, to_year + 1)))
    rows = {r["id"]: r for records, _ in results for r in records}
    orgs = {}
    for row in rows.values():
        code = row.get("organization_code")
        if not code:
            continue
        org = orgs.setdefault(
            code,
            {
                "id": code,
                "name": row.get("organization_name") or code,
                "type": "organization",
                "records": [],
            },
        )
        org["records"].append(row)
    major = sorted(
        orgs.values(), key=lambda o: sum(r.get("amount") or 0 for r in o["records"]), reverse=True
    )[:5]

    async def resolve_name(org):
        if org["name"] != org["id"]:
            return
        try:
            result = await cached_runtime_read(
                "search_public_organizations",
                {"organization_code": org["id"], "page": 1, "page_size": 1},
                max_objects=5,
            )
        except HTTPException:
            return
        for obj in objects_of(result, "public_organization"):
            props = obj.get("properties", {})
            if props.get("organization_code") == org["id"] and props.get("name"):
                org["name"] = props["name"]

    await asyncio.gather(*(resolve_name(org) for org in major))
    entities = {}
    links = []
    for org in major:
        entity = {k: org[k] for k in ("id", "name", "type")}
        entities["organization:" + org["id"]] = entity
        counts = {}
        for row in org["records"]:
            for c in row.get("contractors", []):
                number = c.get("business_registration_number")
                if not number or not number.isdigit() or len(number) != 10:
                    continue
                supplier = counts.setdefault(
                    number,
                    {
                        "type": "company",
                        "id": number,
                        "name": c.get("company_name") or number,
                        "count": 0,
                    },
                )
                supplier["count"] += 1
        for c in sorted(counts.values(), key=lambda c: -c["count"])[:3]:
            target = {k: c[k] for k in ("id", "name", "type")}
            entities["company:" + c["id"]] = target
            links.append(
                {
                    "source": entity,
                    "target": target,
                    "kind": "contract",
                    "relationship": {
                        "contract_event_count": c["count"],
                        "amount_completeness": "unknown",
                    },
                    "label": f"조회 계약 {c['count']}건",
                }
            )
    return {
        "entities": list(entities.values()),
        "links": links,
        "organizations": [
            {
                "type": "organization",
                "id": o["id"],
                "name": o["name"],
                "record_count": len(o["records"]),
            }
            for o in major
        ],
        "yearly_activity": [year for _, year in results],
        "sampled": True,
        "basis": "연도별 금액 상위 최대 100개 계약 검색 기록. 전체 시장 집계와 원계약 사건 집계가 아닙니다.",
        "region_supported": False,
    }
