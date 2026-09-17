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
    expression = p.get("requirement_expression")
    try: expression = json.loads(expression) if isinstance(expression, str) else expression
    except json.JSONDecodeError: expression = None
    return {"id": p.get("bid_notice_id"), "notice_number": p.get("notice_number"), "notice_order": p.get("notice_order"), "name": p.get("notice_name"), "work_type": p.get("work_type"), "status": p.get("bid_status"), "organization": p.get("demand_organization_name") or p.get("notice_organization_name"), "organization_code": p.get("demand_organization_code") or p.get("notice_organization_code"), "notice_organization": p.get("notice_organization_name"), "notice_organization_code": p.get("notice_organization_code"), "published_at": p.get("notice_published_at"), "deadline_at": p.get("bid_deadline_at"), "opening_at": p.get("opening_at"), "bid_method": p.get("bid_method_name"), "contract_method": p.get("contract_method_name"), "estimated_price": money(p.get("estimated_price")), "allocated_budget": money(p.get("allocated_budget")), "detail_url": p.get("detail_url") or p.get("notice_url"), "extraction_completeness": p.get("extraction_completeness"), "requires_review": p.get("requires_review", False), "requirement_expression": expression}


def opening_participation(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {"id": p.get("participation_id") or obj.get("id"), "bid_notice_id": p.get("bid_notice_id"), "notice_number": p.get("notice_number"), "notice_order": p.get("notice_order"), "company_number": p.get("business_registration_number"), "company_name": p.get("participant_name"), "rank": p.get("opening_rank"), "bid_amount": money(p.get("bid_amount")), "bid_at": p.get("bid_at"), "result": p.get("opening_result_type_name"), "remark": p.get("remark")}


def award(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {"id": p.get("award_id") or obj.get("id"), "bid_notice_id": p.get("bid_notice_id"), "notice_number": p.get("notice_number"), "notice_order": p.get("notice_order"), "notice_name": p.get("notice_name"), "company_number": p.get("winner_business_registration_number"), "company_name": p.get("winner_name"), "winning_amount": money(p.get("winning_amount")), "winning_rate": p.get("winning_rate"), "participant_count": p.get("participant_count"), "opening_at": p.get("opening_at"), "award_date": p.get("final_award_date"), "organization_code": p.get("demand_organization_code"), "organization_name": p.get("demand_organization_name")}


def contract(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    number = p.get("notice_number")
    return {"id": p.get("unified_contract_number") or obj.get("id"), "name": p.get("contract_name"), "type": p.get("contract_type"), "notice_number": number, "bid_notice_id": f"{number}:000" if number else None, "amount": money(p.get("total_amount")), "concluded_date": p.get("concluded_date"), "contract_date": p.get("contract_date"), "period": p.get("contract_period_text"), "method": p.get("contract_method_name"), "detail_url": p.get("contract_detail_url")}


def requirement(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {}); value = p.get("value_text")
    try: value = json.loads(value) if isinstance(value, str) else value
    except json.JSONDecodeError: value = {"text": value}
    observed = next((x.get("observed_at") for x in obj.get("provenance") or [] if x.get("observed_at")), None)
    return {"id": p.get("requirement_id") or obj.get("id"), "local_id": p.get("local_id"), "type": p.get("requirement_type", "custom"), "operator": p.get("operator"), "title": (value or {}).get("text") if isinstance(value, dict) else str(value or "참가요건"), "value": value, "original_text": p.get("original_text"), "proposition_text": p.get("proposition_text"), "mandatory": p.get("mandatory", True), "confidence": p.get("confidence"), "evidence_summary": p.get("evidence_summary"), "proof_summary": p.get("proof_summary"), "comparison_mode": p.get("comparison_mode"), "observed_at": observed, "assessment_stage": p.get("assessment_stage"), "failure_effect": p.get("failure_effect"), "review_status": p.get("review_status")}


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
