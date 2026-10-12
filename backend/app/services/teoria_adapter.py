import json
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import TypeAdapter, ValidationError

from app.schemas.assessment import BatchAssessmentPreview


def objects_of(data: dict[str, Any], object_type: str) -> list[dict[str, Any]]:
    return [obj for obj in data.get("objects", []) if obj.get("type") == object_type]


def notice_object(data: dict[str, Any], notice_id: str) -> dict[str, Any] | None:
    number, order = split_notice_id(notice_id)
    for obj in objects_of(data, "bid_notice"):
        properties = obj.get("properties", {})
        if properties.get("bid_notice_id") == notice_id or (
            properties.get("notice_number") == number and properties.get("notice_order") == order
        ):
            return obj
    return None


def money(value: Any) -> int | None:
    try:
        return int(Decimal(str(value)))
    except (InvalidOperation, TypeError, ValueError, OverflowError):
        return None


def runtime_outcome(data: dict[str, Any]) -> dict[str, Any]:
    return {
        **(data.get("outcome") or {}),
        "truncated": bool(data.get("truncated")),
        "registry_version": data.get("registry", {}).get("version"),
    }


def first_present(*values: Any) -> Any:
    return next((value for value in values if value is not None), None)


def organization(obj: dict) -> dict:
    properties = obj.get("properties", {})
    return {
        "id": obj.get("id"),
        "organization_code": properties.get("organization_code"),
        "name": properties.get("name"),
        "jurisdiction_type": properties.get("jurisdiction_type"),
    }


def notice(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    expression = p.get("requirement_expression")
    try:
        expression = json.loads(expression) if isinstance(expression, str) else expression
    except json.JSONDecodeError:
        expression = None
    lineage_notices = p.get("lineage_notices") or []
    try:
        lineage_notices = (
            json.loads(lineage_notices) if isinstance(lineage_notices, str) else lineage_notices
        )
    except json.JSONDecodeError:
        lineage_notices = []
    latest_lineage_id = p.get("latest_bid_notice_id")
    if not latest_lineage_id and p.get("is_latest_in_lineage") is True:
        latest_lineage_id = p.get("bid_notice_id")
    current_status = p.get("current_status") or p.get("bid_status") or "unknown"
    return {
        "id": p.get("bid_notice_id"),
        "notice_number": p.get("notice_number"),
        "notice_order": p.get("notice_order"),
        "name": p.get("notice_name"),
        "work_type": p.get("work_type"),
        "field_code": p.get("field_code"),
        "field_name": p.get("field_name"),
        "large_category": p.get("large_category"),
        "middle_category": p.get("middle_category"),
        # `status` is the product-facing lifecycle status. Keep the two source
        # status fields separately so callers never have to reinterpret them.
        "status": current_status,
        "current_status": current_status,
        "current_status_label": p.get("current_status_label"),
        "bid_status": p.get("bid_status"),
        "notice_status": p.get("notice_status"),
        "status_confirmed_at": p.get("status_confirmed_at"),
        "status_source": p.get("status_source"),
        "failure_reason": p.get("failure_reason"),
        "failure_at": p.get("failure_at"),
        "cancellation_reason": p.get("cancellation_reason"),
        "cancellation_at": p.get("cancellation_at"),
        "organization": p.get("demand_organization_name") or p.get("notice_organization_name"),
        "organization_code": p.get("demand_organization_code") or p.get("notice_organization_code"),
        "notice_organization": p.get("notice_organization_name"),
        "notice_organization_code": p.get("notice_organization_code"),
        "published_at": p.get("notice_published_at"),
        "bid_begin_at": p.get("bid_begin_at"),
        "deadline_at": p.get("bid_deadline_at"),
        "opening_at": p.get("opening_at"),
        "bid_method": p.get("bid_method_name"),
        "contract_method": p.get("contract_method_name"),
        "estimated_price": money(p.get("estimated_price")),
        "allocated_budget": money(p.get("allocated_budget")),
        "detail_url": p.get("detail_url") or p.get("notice_url"),
        "notice_kind": p.get("notice_kind"),
        "notice_kind_name": p.get("notice_kind_name"),
        "is_re_notice": p.get("is_re_notice", False),
        "notice_lineage_id": p.get("notice_lineage_id"),
        "root_bid_notice_id": p.get("root_bid_notice_id"),
        "previous_bid_notice_id": p.get("previous_bid_notice_id"),
        "superseded_by_bid_notice_id": p.get("superseded_by_bid_notice_id"),
        "latest_bid_notice_id": latest_lineage_id,
        "is_latest_in_lineage": p.get("is_latest_in_lineage"),
        "lineage_status": p.get("lineage_status"),
        "lineage_confidence": p.get("lineage_confidence"),
        "lineage_count": p.get("lineage_count") or 1,
        "lineage_notices": lineage_notices,
        "extraction_completeness": p.get("extraction_completeness"),
        "requires_review": p.get("requires_review", False),
        "requirement_expression": expression,
    }


def opening_participation(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {
        "id": p.get("participation_id") or obj.get("id"),
        "bid_notice_id": p.get("bid_notice_id"),
        "notice_number": p.get("notice_number"),
        "notice_order": p.get("notice_order"),
        "company_number": p.get("business_registration_number"),
        "company_name": p.get("participant_name"),
        "rank": p.get("opening_rank"),
        "bid_amount": money(p.get("bid_amount")),
        "bid_rate": first_present(
            p.get("bid_rate"), p.get("bid_rate_percent"), p.get("bid_price_rate")
        ),
        "bid_at": p.get("bid_at"),
        "result": p.get("opening_result_type_name"),
        "remark": p.get("remark"),
    }


def award(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    return {
        "id": p.get("award_id") or obj.get("id"),
        "bid_notice_id": p.get("bid_notice_id"),
        "notice_number": p.get("notice_number"),
        "notice_order": p.get("notice_order"),
        "notice_name": p.get("notice_name"),
        "company_number": p.get("winner_business_registration_number"),
        "company_name": p.get("winner_name"),
        "winning_amount": money(p.get("winning_amount")),
        "winning_rate": p.get("winning_rate"),
        "participant_count": p.get("participant_count"),
        "opening_at": p.get("opening_at"),
        "award_date": p.get("final_award_date"),
        "organization_code": p.get("demand_organization_code"),
        "organization_name": p.get("demand_organization_name"),
    }


def contract(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    number = p.get("notice_number")
    contractors = p.get("contractors") or []
    order = p.get("notice_order")
    notice_id = p.get("bid_notice_id") or (
        f"{number}:{order}" if number and order is not None else None
    )
    return {
        "id": p.get("unified_contract_number") or obj.get("id"),
        "name": p.get("contract_name"),
        "type": p.get("contract_type"),
        "notice_number": number,
        "bid_notice_id": notice_id,
        "amount": first_present(
            money(p.get("current_contract_amount")), money(p.get("total_amount"))
        ),
        "concluded_date": p.get("concluded_date"),
        "contract_date": p.get("contract_date"),
        "period": p.get("contract_period_text"),
        "method": p.get("contract_method_name"),
        "detail_url": p.get("contract_detail_url"),
        "contract_number": p.get("confirmed_contract_number") or p.get("contract_reference_number"),
        "unified_contract_number": p.get("unified_contract_number"),
        "department_name": p.get("contracting_department_name"),
        "payment_method_name": p.get("payment_method_name"),
        "guarantee_deposit_rate": p.get("guarantee_deposit_rate"),
        "basis_law_name": p.get("basis_law_name"),
        "long_term_continuation_type": p.get("long_term_continuation_type"),
        "field_code": p.get("procurement_classification_number"),
        "field_name": p.get("procurement_classification_name"),
        "contractors": contractors,
        "lead_contractor": p.get("lead_contractor") or (contractors[0] if contractors else None),
        "contractor_count": p.get("contractor_count"),
        "contractor_completeness": p.get("contractor_completeness"),
    }


def requirement(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    value = p.get("value_text")
    try:
        value = json.loads(value) if isinstance(value, str) else value
    except json.JSONDecodeError:
        value = {"text": value}
    observed = next(
        (x.get("observed_at") for x in obj.get("provenance") or [] if x.get("observed_at")), None
    )
    value_title = None
    if isinstance(value, dict):
        value_title = value.get("text") or value.get("industry_name") or value.get("license_name")
    title = p.get("title") or value_title or (str(value) if value else "참가요건")
    return {
        "id": p.get("requirement_id") or obj.get("id"),
        "local_id": p.get("local_id"),
        "type": p.get("requirement_type", "custom"),
        "operator": p.get("operator"),
        "title": title,
        "value": value,
        "industry_code": p.get("industry_code")
        or (value.get("industry_code") if isinstance(value, dict) else None),
        "applicability": p.get("applicability"),
        "original_text": p.get("original_text"),
        "proposition_text": p.get("proposition_text"),
        "mandatory": p.get("mandatory", True),
        "confidence": p.get("confidence"),
        "evidence_summary": p.get("evidence_summary"),
        "proof_summary": p.get("proof_summary"),
        "comparison_mode": p.get("comparison_mode"),
        "observed_at": observed,
        "assessment_stage": p.get("assessment_stage"),
        "failure_effect": p.get("failure_effect"),
        "review_status": p.get("review_status"),
    }


def requirement_set(obj: dict[str, Any]) -> dict[str, Any]:
    p = obj.get("properties", {})
    categories = p.get("requirement_categories")
    expression = p.get("requirement_expression")
    try:
        categories = json.loads(categories) if isinstance(categories, str) else categories
    except json.JSONDecodeError:
        categories = {}
    try:
        expression = json.loads(expression) if isinstance(expression, str) else expression
    except json.JSONDecodeError:
        expression = None
    return {
        "id": p.get("requirement_set_id") or obj.get("id"),
        "requirement_expression": expression,
        "requirement_categories": categories or {},
        "region_requirement_status": p.get("region_requirement_status"),
        "industry_license_requirement_status": p.get("industry_license_requirement_status"),
        "requirement_extraction_status": p.get("requirement_extraction_status"),
        "requires_review": p.get("requires_review", False),
    }


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
    if len(parts) != 2 or not all(parts):
        raise ValueError("invalid notice id")
    return parts[0], parts[1]


def notice_activity(
    context: dict, participation_data: dict, contract_data: dict, notice_id: str
) -> dict:
    number, order = split_notice_id(notice_id)
    canonical_id = notice_id
    outcome = context.get("outcome") or {}

    participants = outcome.get("participants") or []
    participation_outcome = participation_data.get("outcome") or {}
    opening_events = participation_outcome.get("opening_events") or []
    participations = []
    awards = []
    contracted_participants = []
    for event_index, event in enumerate(opening_events):
        for participant_index, item in enumerate(event.get("participants") or []):
            company_number = item.get("business_registration_number")
            participations.append(
                {
                    "id": f"{canonical_id}:participation:{event.get('bid_classification_number') or event_index}:{event.get('rebid_number') or '000'}:{company_number or participant_index}",
                    "bid_notice_id": canonical_id,
                    "notice_number": number,
                    "notice_order": order,
                    "bid_classification_number": event.get("bid_classification_number"),
                    "rebid_number": event.get("rebid_number"),
                    "company_number": company_number,
                    "company_name": item.get("company_name"),
                    "rank": item.get("opening_rank"),
                    "bid_amount": item.get("bid_amount"),
                    "bid_rate": item.get("bid_rate"),
                    "result": item.get("result"),
                    "result_confirmed": item.get("result_confirmed"),
                }
            )
    for index, item in enumerate(participants):
        company_number = item.get("business_registration_number")
        company_name = item.get("company_name")
        current_award = item.get("current_award") or {}
        if current_award.get("awarded"):
            awards.append(
                {
                    "id": f"{canonical_id}:award:{company_number or index}",
                    "bid_notice_id": canonical_id,
                    "notice_number": number,
                    "notice_order": order,
                    "notice_name": outcome["bid_notice"].get("notice_name"),
                    "company_number": company_number,
                    "company_name": company_name,
                    "winning_amount": current_award.get("winning_amount"),
                    "winning_rate": current_award.get("winning_rate"),
                    "award_date": current_award.get("award_date"),
                    "organization_code": outcome["bid_notice"].get("organization_code"),
                    "organization_name": outcome["bid_notice"].get("organization_name"),
                }
            )
        current_contract = item.get("current_contract") or {}
        if current_contract.get("contracted"):
            contracted_participants.append((item, current_contract))

    contracts = [contract(obj) for obj in objects_of(contract_data, "contract")]
    if contracted_participants:
        representative = contracted_participants[0][1]
        contractors = [
            {
                "business_registration_number": item.get("business_registration_number"),
                "company_name": item.get("company_name"),
                "company_role": current.get("company_role"),
                "share_percent": current.get("share_percent"),
                "share_completeness": "complete"
                if current.get("share_percent") is not None
                else "unknown",
            }
            for item, current in contracted_participants
        ]
        lead = next(
            (
                item
                for item in contractors
                if item.get("company_role") in {"sole", "consortium_lead"}
            ),
            contractors[0],
        )
        relationship_contract = {
            "id": f"{canonical_id}:contract",
            "name": outcome["bid_notice"].get("notice_name"),
            "notice_number": number,
            "bid_notice_id": canonical_id,
            "amount": representative.get("contract_amount"),
            "concluded_date": representative.get("contract_date"),
            "contractors": contractors,
            "lead_contractor": lead,
            "contractor_count": len(contractors),
            "contractor_completeness": outcome.get("data_completeness", {}).get("status"),
        }
        if contracts:
            for contract_item in contracts:
                contract_item["contractors"] = contractors
                contract_item["lead_contractor"] = lead
                contract_item["contractor_count"] = len(contractors)
                contract_item["contractor_completeness"] = outcome.get("data_completeness", {}).get(
                    "status"
                )
        else:
            contracts.append(relationship_contract)

    return {
        "participations": participations,
        "opening_events": opening_events,
        "participation_summary": {
            "source_participant_count": sum(
                event.get("source_participant_count") or 0 for event in opening_events
            ),
            "stored_participant_count": sum(
                event.get("stored_participant_count") or 0 for event in opening_events
            ),
            "returned_participant_count": sum(
                event.get("returned_participant_count") or 0 for event in opening_events
            ),
            "retention_policy": next(
                (
                    event.get("retention_policy")
                    for event in opening_events
                    if event.get("retention_policy")
                ),
                None,
            ),
            "data_completeness": participation_outcome.get("data_completeness") or {},
        },
        "awards": awards,
        "contracts": contracts,
        "contract_pagination": contract_data.get("pagination")
        or {
            "page": 1,
            "page_size": len(contracts),
            "total_items": len(contracts),
            "total_pages": 1 if contracts else 0,
        },
        "truncated": any(
            data.get("truncated", False) for data in (context, participation_data, contract_data)
        ),
        "relationship_context": {
            **outcome,
            "registry_version": context.get("registry", {}).get("version"),
        },
        "registry_version": context.get("registry", {}).get("version"),
    }


class AssessmentResponseMismatch(ValueError):
    """Runtime assessment cannot be safely attributed to the requested context."""


def assessment_response(
    data: dict[str, Any], notice_id: str, business_number: str
) -> dict[str, Any]:
    """Validate assessment ownership before joining explicit Runtime graph edges."""
    overall_objects = objects_of(data, "bid_eligibility_assessment")
    if data.get("truncated") or len(overall_objects) != 1:
        raise AssessmentResponseMismatch()
    overall = overall_objects[0]
    properties = overall.get("properties", {})
    overall_id = overall.get("id")
    if (
        not isinstance(overall_id, str)
        or not overall_id
        or properties.get("bid_notice_id") != notice_id
        or properties.get("business_registration_number") != business_number
    ):
        raise AssessmentResponseMismatch()
    requirements = {}
    for obj in objects_of(data, "requirement_assessment"):
        object_id = obj.get("id")
        props = obj.get("properties", {})
        if (
            not isinstance(object_id, str)
            or not object_id
            or object_id in requirements
            or props.get("assessment_id") != overall_id
            or props.get("business_registration_number") != business_number
        ):
            raise AssessmentResponseMismatch()
        requirements[object_id] = {**props, "id": object_id, "evidence_ids": []}
    for link in data.get("links", []):
        if (
            link.get("type") == "requirement_assessment_belongs_to_bid_eligibility_assessment"
            and link.get("source") in requirements
            and link.get("target") != overall_id
        ):
            raise AssessmentResponseMismatch()
    evidence = {}
    for obj in objects_of(data, "evidence"):
        object_id = obj.get("id")
        if not isinstance(object_id, str):
            continue
        evidence[object_id] = {
            **obj.get("properties", {}),
            "id": object_id,
            "observed_at_values": (
                [obj["properties"]["observed_at"]]
                if isinstance(obj.get("properties", {}).get("observed_at"), str)
                else sorted(
                    {
                        item["observed_at"]
                        for item in (obj.get("provenance") or [])
                        if isinstance(item, dict)
                        and item.get("kind") == "source"
                        and isinstance(item.get("observed_at"), str)
                    }
                )
            ),
        }
    for link in data.get("links", []):
        if link.get("type") != "requirement_assessment_supported_by_evidence":
            continue
        source, target = link.get("source"), link.get("target")
        if not isinstance(source, str) or not isinstance(target, str):
            continue
        if source not in requirements or target not in evidence:
            continue
        requirement_id, evidence_id = source, target
        ids = requirements[requirement_id]["evidence_ids"]
        if evidence_id not in ids:
            ids.append(evidence_id)
    linked_evidence_ids = {
        evidence_id for req in requirements.values() for evidence_id in req["evidence_ids"]
    }
    return {
        "assessment": properties,
        "requirement_assessments": list(requirements.values()),
        "evidence": [
            item for evidence_id, item in evidence.items() if evidence_id in linked_evidence_ids
        ],
        "registry_version": data.get("registry", {}).get("version"),
    }


_batch_preview_adapter = TypeAdapter(list[BatchAssessmentPreview])


def batch_assessment_response(
    data: dict[str, Any], notice_ids: list[str], business_number: str
) -> dict[str, Any]:
    raw_items = (data.get("outcome") or {}).get("items")
    if data.get("truncated") or not isinstance(raw_items, list):
        raise AssessmentResponseMismatch()
    try:
        items = _batch_preview_adapter.validate_python(raw_items)
    except ValidationError:
        raise AssessmentResponseMismatch() from None
    requested = list(dict.fromkeys(notice_ids))
    by_id = {item.bid_notice_id: item for item in items}
    if len(by_id) != len(items) or set(by_id) != set(requested):
        raise AssessmentResponseMismatch()
    for raw in raw_items:
        if (
            "business_registration_number" in raw
            and raw["business_registration_number"] != business_number
        ):
            raise AssessmentResponseMismatch()
    return {
        "items": [by_id[notice_id].model_dump(exclude_none=True) for notice_id in requested],
        "registry_version": data.get("registry", {}).get("version"),
    }


class RequirementSetMismatch(ValueError):
    """Requirement set identity is absent, conflicting or ambiguous."""


def requirement_set_object(data: dict[str, Any], notice_id: str) -> dict[str, Any] | None:
    sets = objects_of(data, "bid_requirement_set")
    if not sets:
        return None
    number, order = split_notice_id(notice_id)
    matches = []
    for obj in sets:
        properties = obj.get("properties", {})
        if "bid_notice_id" in properties:
            belongs = properties["bid_notice_id"] == notice_id
        else:
            belongs = (
                properties.get("notice_number") == number
                and properties.get("notice_order") == order
            )
        if belongs:
            matches.append(obj)
    if len(matches) != 1:
        raise RequirementSetMismatch()
    return matches[0]
