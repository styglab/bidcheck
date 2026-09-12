import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any


def objects_of(data: dict[str, Any], object_type: str) -> list[dict[str, Any]]:
    return [obj for obj in data.get("objects", []) if obj.get("type") == object_type]


def money(value: Any) -> int | None:
    try: return int(Decimal(str(value)))
    except (InvalidOperation, TypeError, ValueError): return None


def notice(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {"id": p.get("bid_notice_id"), "notice_number": p.get("notice_number"), "notice_order": p.get("notice_order"), "name": p.get("notice_name"), "work_type": p.get("work_type"), "status": p.get("bid_status"), "organization": p.get("demand_organization_name") or p.get("notice_organization_name"), "notice_organization": p.get("notice_organization_name"), "published_at": p.get("notice_published_at"), "deadline_at": p.get("bid_deadline_at"), "opening_at": p.get("opening_at"), "bid_method": p.get("bid_method_name"), "contract_method": p.get("contract_method_name"), "estimated_price": money(p.get("estimated_price")), "allocated_budget": money(p.get("allocated_budget")), "detail_url": p.get("detail_url") or p.get("notice_url"), "extraction_completeness": p.get("extraction_completeness"), "requires_review": p.get("requires_review", False)}


def requirement(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {}); value = p.get("value_text")
    try: value = json.loads(value) if isinstance(value, str) else value
    except json.JSONDecodeError: value = {"text": value}
    observed = next((x.get("observed_at") for x in obj.get("provenance") or [] if x.get("observed_at")), None)
    return {"id": p.get("requirement_id") or obj.get("id"), "local_id": p.get("local_id"), "type": p.get("requirement_type", "custom"), "operator": p.get("operator"), "title": (value or {}).get("text") if isinstance(value, dict) else str(value or "참가요건"), "value": value, "original_text": p.get("original_text"), "proposition_text": p.get("proposition_text"), "mandatory": p.get("mandatory", True), "confidence": p.get("confidence"), "evidence_summary": p.get("evidence_summary"), "proof_summary": p.get("proof_summary"), "comparison_mode": p.get("comparison_mode"), "observed_at": observed}


def requirement_evidence(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {
        "id": p.get("evidence_id") or obj.get("id"),
        "requirement_id": p.get("requirement_id"),
        "source_type": p.get("source_type"),
        "document_id": p.get("document_id"),
        "source_document": p.get("source_document"),
        "source_page": p.get("source_page"),
        "source_clause": p.get("source_clause"),
        "source_excerpt": p.get("source_excerpt"),
        "source_url": p.get("source_url"),
    }


def participation_finding(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {
        "id": p.get("finding_id") or obj.get("id"),
        "category": p.get("category"),
        "title": p.get("title"),
        "description": p.get("description"),
        "deadline_text": p.get("deadline_text"),
        "failure_effect": p.get("failure_effect"),
        "importance": p.get("importance"),
        "review_status": p.get("review_status"),
        "competitive_effect": p.get("competitive_effect"),
        "legitimate_justification": p.get("legitimate_justification"),
        "evidence": [],
    }


def participation_finding_evidence(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {
        "id": p.get("evidence_id") or obj.get("id"),
        "finding_id": p.get("finding_id"),
        "source_document": p.get("source_document"),
        "source_page": p.get("source_page"),
        "source_clause": p.get("source_clause"),
        "source_excerpt": p.get("source_excerpt"),
        "source_url": p.get("source_url"),
    }


def split_notice_id(notice_id: str) -> tuple[str, str]:
    parts = notice_id.rsplit(":", 1)
    if len(parts) != 2 or not all(parts): raise ValueError("invalid notice id")
    return parts[0], parts[1]


def default_period(days: int = 14) -> tuple[str, str]:
    now = datetime.now(timezone.utc); start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat(), now.isoformat()
