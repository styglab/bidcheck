"""Discover official fields and compare supplier statistics computed by Teoria."""

import asyncio
from datetime import UTC, datetime

from fastapi import HTTPException

from app.integrations.teoria import teoria_client
from app.services.cache import AsyncTTLCache
from app.services.procurement_cache import cached_runtime_read
from app.services.teoria_adapter import company_sector_profile, contract, objects_of

_sector_cache = AsyncTTLCache(max_entries=3, ttl=900)
WORK_TYPES = ("goods", "service", "construction")


async def discover_contract_companies(query: str, from_year: int, to_year: int) -> dict:
    """Select suppliers from a bounded contract search, without inventing attribution."""
    data = await teoria_client.execute(
        "search_public_procurement_contracts",
        {
            "query": query.strip(),
            "concluded_date_from": f"{from_year}-01-01",
            "concluded_date_to": min(f"{to_year}-12-31", datetime.now(UTC).date().isoformat()),
            "sort": "amount_desc",
            "page": 1,
            "page_size": 100,
        },
        max_objects=1000,
    )
    contracts = {}
    for obj in objects_of(data, "contract"):
        item = contract(obj)
        contracts.setdefault(item["id"], item)
    companies = {}
    unidentified = 0
    for item in contracts.values():
        identified = False
        for supplier in item.get("contractors") or []:
            number = str(supplier.get("business_registration_number") or "")
            number = number.replace("-", "")
            if len(number) != 10 or not number.isdigit():
                continue
            identified = True
            company = companies.setdefault(
                number,
                {
                    "business_registration_number": number,
                    "name": supplier.get("company_name") or "업체명 확인 필요",
                    "contracts": {},
                },
            )
            company["contracts"].setdefault(item["id"], item)
        if not identified:
            unidentified += 1
    items = []
    for company in companies.values():
        evidence = sorted(
            company["contracts"].values(),
            key=lambda item: (item["amount"] is not None, item["amount"] or 0),
            reverse=True,
        )
        items.append({**company, "contracts": evidence, "contract_count": len(evidence)})
    items.sort(key=lambda item: (-item["contract_count"], item["name"]))
    total = (data.get("pagination") or {}).get("total_items")
    return {
        "items": items,
        "sampled_contract_count": len(contracts),
        "matched_contract_count": total,
        "partial": bool(data.get("truncated"))
        or total is None
        or total > len(contracts)
        or unidentified > 0,
        "unidentified_contract_count": unidentified,
        "analysis_basis": {
            "period_from_year": from_year,
            "period_to_year": to_year,
            "query": query.strip(),
            "limit": 100,
            "amount_basis": "contract_total_not_supplier_attribution",
        },
        "registry_version": (data.get("registry") or {}).get("version"),
    }


async def discover_company_sectors(*, refresh: bool = False) -> dict:
    async def load():
        return await _build_discover_company_sectors()

    return await _sector_cache.get_or_load(datetime.now(UTC).year - 1, load, refresh=refresh)


async def _build_discover_company_sectors() -> dict:
    year = datetime.now(UTC).year - 1
    semaphore = asyncio.Semaphore(6)

    async def execute(capability, inputs, max_objects=500):
        async with semaphore:
            return await cached_runtime_read(capability, inputs, max_objects=max_objects)

    async def search(work_type, field_code=None, page_size=100):
        return await execute(
            "search_public_procurement_contracts",
            {
                "concluded_date_from": f"{year}-01-01",
                "concluded_date_to": f"{year}-12-31",
                "work_type": work_type,
                "sort": "amount_desc",
                "page": 1,
                "page_size": page_size,
                **({"field_code": field_code} if field_code else {}),
            },
            max_objects=1000,
        )

    async def company_profile(number, name, work_type, field_code):
        data = await execute(
            "analyze_company_procurement_profile",
            {
                "business_registration_number": number,
                "period_years": 1,
                "period_from_year": year,
                "period_to_year": year,
                "target_year": year,
                "work_type": work_type,
                **({"field_code": field_code} if field_code else {}),
                "page": 1,
                "page_size": 20,
            },
        )
        try:
            return company_sector_profile(data, number, name)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                502,
                detail={
                    "code": "teoria_invalid_response",
                    "message": "업체 실적 응답을 확인할 수 없습니다.",
                },
            ) from exc

    async def field_profile(work_type, field):
        result = (
            await search(work_type, field["field_code"], page_size=30)
            if not field.get("candidate_companies")
            else {"objects": []}
        )
        contracts = [contract(obj) for obj in objects_of(result, "contract")]
        contracts.sort(
            key=lambda item: (item["amount"] is not None, item["amount"] or 0), reverse=True
        )
        candidates = dict(field.get("candidate_companies") or [])
        for item in contracts:
            # Share is used only to select candidates, never to calculate contract amounts.
            contractors = sorted(
                item.get("contractors") or [],
                key=lambda supplier: (
                    supplier.get("share_percent") is not None,
                    supplier.get("share_percent") or 0,
                    supplier.get("business_registration_number") or "",
                ),
                reverse=True,
            )
            for supplier in contractors:
                number = supplier.get("business_registration_number")
                if isinstance(number, str) and len(number) == 10 and number.isdigit():
                    candidates.setdefault(
                        number, supplier.get("company_name") or "업체명 확인 필요"
                    )
        selected = list(candidates.items())[:3]
        profiles = await asyncio.gather(
            *(
                company_profile(number, name, work_type, field["field_code"])
                for number, name in selected
            ),
            return_exceptions=True,
        )
        companies = []
        failed_count = 0
        partial = bool(result.get("truncated"))
        for profile in profiles:
            if isinstance(profile, Exception):
                failed_count += 1
                continue
            partial |= profile.pop("partial")
            profile.pop("field_distribution", None)
            if profile["contract_event_count"] is None or profile["contract_event_count"] > 0:
                companies.append(profile)
        companies.sort(
            key=lambda item: (
                item["total_attributed_contract_amount"] is not None,
                item["total_attributed_contract_amount"] or 0,
            ),
            reverse=True,
        )
        return {
            **{
                key: value
                for key, value in field.items()
                if key not in {"candidate_companies", "observed_supplier_field_amount"}
            },
            "companies": companies,
            "status": "unavailable" if selected and failed_count == len(selected) else "available",
            "partial": partial or failed_count > 0,
            "sampled_contract_count": len(contracts),
        }

    async def goods_fields(contracts):
        candidates = {}
        for item in contracts:
            for supplier in item.get("contractors") or []:
                number = supplier.get("business_registration_number")
                if isinstance(number, str) and len(number) == 10 and number.isdigit():
                    candidates.setdefault(
                        number, supplier.get("company_name") or "업체명 확인 필요"
                    )
        results = await asyncio.gather(
            *(
                company_profile(number, name, "goods", None)
                for number, name in list(candidates.items())[:6]
            ),
            return_exceptions=True,
        )
        fields = {}
        partial = False
        for profile in results:
            if isinstance(profile, Exception):
                partial = True
                continue
            partial |= profile["partial"]
            for field in profile["field_distribution"]:
                code, name = field.get("field_code"), field.get("field_name")
                if not code or not name:
                    continue
                entry = fields.setdefault(
                    code,
                    {
                        "field_code": code,
                        "field_name": name,
                        "representative_contract_amount": None,
                        "selection_basis": "supplier_official_field",
                        "candidate_companies": [],
                        "observed_supplier_field_amount": None,
                    },
                )
                entry["candidate_companies"].append(
                    (profile["business_registration_number"], profile["name"])
                )
                value = field.get("attributed_contract_amount")
                if value is not None and (
                    entry["observed_supplier_field_amount"] is None
                    or value > entry["observed_supplier_field_amount"]
                ):
                    entry["observed_supplier_field_amount"] = value
        ordered = sorted(
            fields.values(),
            key=lambda field: (
                field["observed_supplier_field_amount"] is not None,
                field["observed_supplier_field_amount"] or 0,
            ),
            reverse=True,
        )
        selected = []
        names = set()
        for field in ordered:
            if field["field_name"] not in names:
                selected.append(field)
                names.add(field["field_name"])
        return selected[:2], partial

    async def sector(work_type):
        result = await search(work_type)
        contracts = [contract(obj) for obj in objects_of(result, "contract")]
        contracts.sort(
            key=lambda item: (item["amount"] is not None, item["amount"] or 0), reverse=True
        )
        fields = {}
        for item in contracts:
            code, name = item.get("field_code"), item.get("field_name")
            if not code or not name:
                continue
            fields.setdefault(
                code,
                {
                    "field_code": code,
                    "field_name": name,
                    "representative_contract_amount": item["amount"],
                },
            )
        selected_fields = list(fields.values())[:2]
        field_discovery_partial = False
        if work_type == "goods" and not selected_fields:
            selected_fields, field_discovery_partial = await goods_fields(contracts)
        profiles = await asyncio.gather(
            *(field_profile(work_type, field) for field in selected_fields),
            return_exceptions=True,
        )
        displayed = []
        partial = bool(result.get("truncated")) or field_discovery_partial
        for field, profile in zip(selected_fields, profiles, strict=True):
            if isinstance(profile, Exception):
                displayed.append(
                    {
                        **{
                            key: value
                            for key, value in field.items()
                            if key not in {"candidate_companies", "observed_supplier_field_amount"}
                        },
                        "companies": [],
                        "status": "unavailable",
                        "partial": True,
                    }
                )
                partial = True
            else:
                displayed.append(profile)
                partial |= profile["partial"]
        return {
            "work_type": work_type,
            "fields": displayed,
            "partial": partial,
            "status": "unavailable"
            if not selected_fields and field_discovery_partial
            else "available",
            "sampled_contract_count": len(contracts),
        }

    results = await asyncio.gather(
        *(asyncio.wait_for(sector(work), timeout=115) for work in WORK_TYPES),
        return_exceptions=True,
    )
    sectors = []
    for work, result in zip(WORK_TYPES, results, strict=True):
        sectors.append(
            {"work_type": work, "fields": [], "partial": True, "status": "unavailable"}
            if isinstance(result, Exception)
            else result
        )
    if all(item["status"] == "unavailable" for item in sectors):
        raise HTTPException(
            502,
            detail={
                "code": "company_sectors_unavailable",
                "message": "분야별 실적 업체를 불러오지 못했습니다.",
            },
        )
    response = {
        "year": year,
        "sectors": sectors,
        "partial": any(item["partial"] for item in sectors),
    }
    response["snapshot_updated_at"] = datetime.now(UTC).isoformat()
    return response
