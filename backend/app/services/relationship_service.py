"""Discover trading relationships without recalculating Teoria contract statistics."""

import asyncio
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

from app.services.cache import AsyncTTLCache
from app.services.procurement_cache import cached_runtime_read
from app.services.teoria_adapter import award, objects_of, runtime_outcome

_relationship_cache = AsyncTTLCache(max_entries=24, ttl=900)


async def discover_relationships(
    period_years: int,
    work_type: str | None,
    *,
    organization_limit: int = 12,
    include_profiles: bool = True,
    refresh: bool = False,
) -> dict:
    async def load():
        return await _build_discover_relationships(
            period_years, work_type, organization_limit, include_profiles
        )

    return await _relationship_cache.get_or_load(
        (datetime.now(UTC).date(), period_years, work_type, organization_limit, include_profiles),
        load,
        refresh=refresh,
    )


async def _build_discover_relationships(
    period_years: int, work_type: str | None, organization_limit: int, include_profiles: bool
) -> dict:
    now = datetime.now(UTC)

    # Recent awards identify a bounded set of institutions, not a market-wide ranking.
    seeds = await cached_runtime_read(
        "search_bid_awards",
        {
            "opening_at_from": (now - timedelta(days=90)).isoformat(),
            "opening_at_to": now.isoformat(),
            "sort": "award_desc",
            "page": 1,
            "page_size": 100,
            **({"work_type": work_type} if work_type else {}),
        },
        max_objects=1000,
    )
    organizations = {}
    awards = [award(obj) for obj in objects_of(seeds, "bid_award")]
    awards.sort(key=lambda item: str(item["id"]))
    awards.sort(key=lambda item: item["award_date"] or item["opening_at"] or "", reverse=True)
    for item in awards:
        if item["organization_code"]:
            organizations.setdefault(item["organization_code"], item["organization_name"])
    selected = list(organizations.items())[:organization_limit]
    from_year = now.year - period_years + 1

    if not include_profiles:
        return {
            "organizations": [
                {
                    "organization_code": code,
                    "organization_name": name,
                    "relationships": [],
                    "truncated": False,
                }
                for code, name in selected
            ],
            "items": [],
            "new_relationships": [],
            "profiles_included": False,
            "analysis_basis": {
                "from_year": from_year,
                "to_year": now.year,
                "work_type": work_type,
                "seed_award_count": len(awards),
                "organization_count": len(selected),
                "organization_limit": organization_limit,
                "relationships_per_organization": 30,
            },
            "partial": bool(seeds.get("truncated")),
            "truncated": bool(seeds.get("truncated")),
            "failed_organization_count": 0,
            "failed_new_relationship_count": 0,
            "snapshot_updated_at": datetime.now(UTC).isoformat(),
        }

    semaphore = asyncio.Semaphore(4)

    async def bounded_read(capability, inputs, **options):
        async with semaphore:
            return await cached_runtime_read(capability, inputs, **options)

    async def profile(code: str):
        data = await bounded_read(
            "analyze_organization_procurement_profile",
            {
                "organization_code": code,
                "period_years": period_years,
                "period_from_year": from_year,
                "period_to_year": now.year,
                "sort": "contract_amount_desc",
                "page": 1,
                "page_size": 30,
                **({"work_type": work_type} if work_type else {}),
            },
            max_objects=500,
        )
        outcome = runtime_outcome(data)
        if not isinstance(outcome.get("company_relationships"), list):
            raise HTTPException(
                502,
                detail={
                    "code": "teoria_invalid_response",
                    "message": "거래 관계 응답을 확인할 수 없습니다.",
                },
            )
        return outcome

    results = await asyncio.gather(*(profile(code) for code, _ in selected), return_exceptions=True)
    items = []
    successful_organizations = []
    institution_summaries = []
    failed_count = 0
    truncated = bool(seeds.get("truncated"))
    incomplete = False
    versions = set()
    for (code, name), result in zip(selected, results, strict=True):
        if isinstance(result, Exception):
            failed_count += 1
            continue
        successful_organizations.append(
            (code, (result.get("organization") or {}).get("name") or name)
        )
        truncated |= bool(result.get("truncated"))
        incomplete |= (result.get("data_completeness") or {}).get("status") not in {
            None,
            "complete",
        }
        if result.get("registry_version"):
            versions.add(result["registry_version"])
        institution_relationships = []
        for relationship in result["company_relationships"]:
            if not isinstance(relationship, dict):
                incomplete = True
                continue
            count = relationship.get("contract_event_count")
            if not relationship.get("company_number") or type(count) is not int or count <= 0:
                continue
            institution_relationships.append(
                {
                    **relationship,
                    "organization_code": code,
                    "organization_name": (result.get("organization") or {}).get("name") or name,
                }
            )
        items.extend(institution_relationships)
        institution_summaries.append(
            {
                "organization_code": code,
                "organization_name": (result.get("organization") or {}).get("name") or name,
                "relationships": institution_relationships,
                "company_structure": result.get("company_structure"),
                "data_completeness": result.get("data_completeness"),
                "truncated": bool(result.get("truncated")),
            }
        )
    if selected and failed_count == len(selected):
        raise HTTPException(
            502,
            detail={
                "code": "relationship_unavailable",
                "message": "거래 관계를 불러오지 못했습니다.",
            },
        )

    async def new_suppliers(code):
        data = await bounded_read(
            "search_organization_supplier_entries",
            {
                "organization_code": code,
                "target_year": now.year,
                "entry_status": "first_observed",
                "sort": "contract_amount_desc",
                "page": 1,
                "page_size": 3,
                **({"work_type": work_type} if work_type else {}),
            },
            max_objects=200,
        )
        outcome = runtime_outcome(data)
        if not isinstance(outcome.get("items"), list):
            raise HTTPException(502, detail={"code": "teoria_invalid_response"})
        return outcome

    new_results = await asyncio.gather(
        *(new_suppliers(code) for code, _ in successful_organizations),
        return_exceptions=True,
    )
    new_relationships = []
    failed_new_count = 0
    for (code, name), result in zip(successful_organizations, new_results, strict=True):
        if isinstance(result, Exception):
            failed_new_count += 1
            continue
        truncated |= bool(result.get("truncated"))
        for supplier in result["items"]:
            if supplier.get("company_number") and supplier.get("entry_status") == "first_observed":
                new_relationships.append(
                    {
                        **supplier,
                        "organization_code": code,
                        "organization_name": name,
                        "target_year": now.year,
                    }
                )
    new_relationships.sort(
        key=lambda item: (
            item.get("target_year_attributed_contract_amount") is not None,
            item.get("target_year_attributed_contract_amount") or 0,
        ),
        reverse=True,
    )

    # Keep unknown amounts unknown; only sort the returned relationship summaries.
    items.sort(
        key=lambda item: (
            item.get("total_attributed_contract_amount") is not None,
            item.get("total_attributed_contract_amount") or 0,
        ),
        reverse=True,
    )
    response = {
        "items": items,
        "organizations": institution_summaries,
        "new_relationships": new_relationships,
        "analysis_basis": {
            "from_year": from_year,
            "to_year": now.year,
            "work_type": work_type,
            "seed_award_count": len(objects_of(seeds, "bid_award")),
            "organization_count": len(selected) - failed_count,
            "organization_limit": organization_limit,
            "relationships_per_organization": 30,
        },
        "partial": truncated or incomplete or failed_count > 0 or failed_new_count > 0,
        "truncated": truncated,
        "failed_organization_count": failed_count,
        "failed_new_relationship_count": failed_new_count,
        "registry_versions": sorted(versions),
    }
    response["snapshot_updated_at"] = datetime.now(UTC).isoformat()
    return response
