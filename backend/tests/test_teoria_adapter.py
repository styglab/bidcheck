import pytest

from app.services.teoria_adapter import contract, notice_activity, opening_participation


@pytest.mark.parametrize("total", [None, 100])
def test_zero_contract_amount_is_preserved(total):
    result = contract({"properties": {"current_contract_amount": 0, "total_amount": total}})
    assert result["amount"] == 0


@pytest.mark.parametrize(
    ("properties", "expected"),
    [
        ({"notice_number": "NOTICE"}, None),
        ({"notice_number": "NOTICE", "notice_order": "003"}, "NOTICE:003"),
        ({"notice_number": "NOTICE", "bid_notice_id": "NOTICE:005"}, "NOTICE:005"),
    ],
)
def test_contract_only_links_to_known_notice_order(properties, expected):
    assert contract({"properties": properties})["bid_notice_id"] == expected


def test_zero_bid_rate_is_preserved():
    assert (
        opening_participation({"properties": {"bid_rate": 0, "bid_rate_percent": 10}})["bid_rate"]
        == 0
    )


def test_activity_preserves_contract_pagination_and_partial_results():
    pagination = {"page": 1, "page_size": 20, "total_items": 30, "total_pages": 2}
    context = {"outcome": {"bid_notice": {"bid_notice_id": "NOTICE:003"}, "participants": []}}
    result = notice_activity(
        context, {}, {"pagination": pagination, "truncated": True}, "NOTICE:003"
    )
    assert result["contract_pagination"] == pagination
    assert result["truncated"] is True
    assert result["relationship_context"]["bid_notice"]["bid_notice_id"] == "NOTICE:003"


def test_assessment_evidence_uses_graph_ids_and_never_array_positions():
    from app.services.teoria_adapter import assessment_response

    data = {
        "objects": [
            {
                "type": "evidence",
                "id": "evidence-2",
                "properties": {"source_document": "둘째 문서"},
            },
            {
                "type": "requirement_assessment",
                "id": "assessment-2",
                "properties": {
                    "assessment_id": "overall",
                    "business_registration_number": "1234567890",
                    "requirement_id": "req-2",
                    "evidence_ids": ["evidence-1"],
                },
            },
            {
                "type": "bid_eligibility_assessment",
                "id": "overall",
                "properties": {
                    "bid_notice_id": "NOTICE:003",
                    "business_registration_number": "1234567890",
                    "reference_date": "2026-10-12",
                    "ruleset_version": "v1",
                },
            },
            {
                "type": "evidence",
                "id": "evidence-1",
                "properties": {"id": "wrong-property-id", "source_document": "첫째 문서"},
                "provenance": [{"kind": "source", "observed_at": "2026-10-12T01:00:00Z"}],
            },
            {
                "type": "requirement_assessment",
                "id": "assessment-1",
                "properties": {
                    "assessment_id": "overall",
                    "business_registration_number": "1234567890",
                    "requirement_id": "req-1",
                },
            },
            {"type": "evidence", "id": "unlinked", "properties": {}},
        ],
        "links": [
            {
                "type": "requirement_assessment_supported_by_evidence",
                "source": "assessment-1",
                "target": "evidence-1",
            },
            {
                "type": "requirement_assessment_supported_by_evidence",
                "source": "assessment-2",
                "target": "evidence-2",
            },
            {
                "type": "requirement_assessment_supported_by_evidence",
                "source": "assessment-1",
                "target": "evidence-1",
            },
            {
                "type": "requirement_assessment_supported_by_evidence",
                "source": "assessment-1",
                "target": "missing",
            },
        ],
        "registry": {"version": "registry-v1"},
    }
    response = assessment_response(data, "NOTICE:003", "1234567890")
    requirements = {item["id"]: item for item in response["requirement_assessments"]}
    assert requirements["assessment-1"]["evidence_ids"] == ["evidence-1"]
    assert requirements["assessment-2"]["evidence_ids"] == ["evidence-2"]
    evidence = {item["id"]: item for item in response["evidence"]}
    assert evidence["evidence-1"]["observed_at_values"] == ["2026-10-12T01:00:00Z"]
    assert "unlinked" not in evidence
    assert response["assessment"]["reference_date"] == "2026-10-12"
    assert response["registry_version"] == "registry-v1"


def test_assessment_without_graph_links_does_not_guess_evidence_associations():
    from app.services.teoria_adapter import assessment_response

    result = assessment_response(
        {
            "objects": [
                {
                    "type": "bid_eligibility_assessment",
                    "id": "overall",
                    "properties": {
                        "bid_notice_id": "NOTICE:003",
                        "business_registration_number": "1234567890",
                    },
                },
                {
                    "type": "requirement_assessment",
                    "id": "a1",
                    "properties": {
                        "assessment_id": "overall",
                        "business_registration_number": "1234567890",
                        "requirement_id": "req-1",
                        "evidence_ids": ["e1"],
                    },
                },
                {"type": "evidence", "id": "e1", "properties": {"requirement_id": "req-1"}},
            ]
        },
        "NOTICE:003",
        "1234567890",
    )
    assert result["requirement_assessments"][0]["evidence_ids"] == []
    assert result["evidence"] == []


def test_source_observation_time_is_not_replaced_by_assessment_execution_time():
    from app.services.teoria_adapter import assessment_response

    result = assessment_response(
        {
            "links": [
                {
                    "type": "requirement_assessment_supported_by_evidence",
                    "source": "a1",
                    "target": "e1",
                },
                {
                    "type": "requirement_assessment_supported_by_evidence",
                    "source": "a1",
                    "target": "e2",
                },
            ],
            "objects": [
                {
                    "type": "requirement_assessment",
                    "id": "a1",
                    "properties": {
                        "assessment_id": "overall",
                        "business_registration_number": "1234567890",
                    },
                },
                {
                    "type": "bid_eligibility_assessment",
                    "id": "overall",
                    "properties": {
                        "bid_notice_id": "NOTICE:003",
                        "business_registration_number": "1234567890",
                    },
                },
                {
                    "id": "e1",
                    "type": "evidence",
                    "properties": {"observed_at": "2026-10-01T00:00:00Z"},
                    "provenance": [{"kind": "execution", "observed_at": "2026-10-12T00:00:00Z"}],
                },
                {
                    "id": "e2",
                    "type": "evidence",
                    "properties": {},
                    "provenance": [{"kind": "execution", "observed_at": "2026-10-12T00:00:00Z"}],
                },
            ],
        },
        "NOTICE:003",
        "1234567890",
    )
    evidence = {item["id"]: item for item in result["evidence"]}
    assert evidence["e1"]["observed_at_values"] == ["2026-10-01T00:00:00Z"]
    assert evidence["e2"]["observed_at_values"] == []


@pytest.mark.parametrize(
    "scenario",
    [
        "wrong_notice",
        "wrong_company",
        "missing_company",
        "no_overall",
        "ambiguous_overall",
        "foreign_requirement",
        "wrong_requirement_company",
        "missing_requirement_owner",
        "conflicting_owner_link",
        "duplicate_requirement",
        "truncated",
    ],
)
def test_assessment_rejects_unverifiable_or_mixed_context(scenario):
    from copy import deepcopy

    from app.services.teoria_adapter import AssessmentResponseMismatch, assessment_response

    overall = {
        "type": "bid_eligibility_assessment",
        "id": "overall",
        "properties": {
            "assessment_id": "fingerprint",
            "bid_notice_id": "NOTICE:003",
            "business_registration_number": "1234567890",
            "outcome": "needs_review",
        },
    }
    requirement = {
        "type": "requirement_assessment",
        "id": "req-assessment",
        "properties": {
            "assessment_id": "overall",
            "business_registration_number": "1234567890",
            "requirement_id": "req-1",
            "outcome": "needs_review",
        },
    }
    data = {"objects": [overall, requirement], "links": []}
    if scenario == "wrong_notice":
        overall["properties"]["bid_notice_id"] = "OTHER:001"
    elif scenario == "wrong_company":
        overall["properties"]["business_registration_number"] = "0987654321"
    elif scenario == "missing_company":
        del overall["properties"]["business_registration_number"]
    elif scenario == "no_overall":
        data["objects"].remove(overall)
    elif scenario == "ambiguous_overall":
        data["objects"].append(deepcopy(overall))
    elif scenario == "foreign_requirement":
        requirement["properties"]["assessment_id"] = "other-overall"
    elif scenario == "wrong_requirement_company":
        requirement["properties"]["business_registration_number"] = "0987654321"
    elif scenario == "missing_requirement_owner":
        del requirement["properties"]["assessment_id"]
    elif scenario == "conflicting_owner_link":
        data["links"].append(
            {
                "type": "requirement_assessment_belongs_to_bid_eligibility_assessment",
                "source": "req-assessment",
                "target": "other-overall",
            }
        )
    elif scenario == "duplicate_requirement":
        data["objects"].append(deepcopy(requirement))
    else:
        data["truncated"] = True
    with pytest.raises(AssessmentResponseMismatch):
        assessment_response(data, "NOTICE:003", "1234567890")


def test_assessment_ownership_uses_runtime_object_id_not_property_fingerprint():
    from app.services.teoria_adapter import assessment_response

    result = assessment_response(
        {
            "objects": [
                {
                    "type": "bid_eligibility_assessment",
                    "id": "runtime:overall",
                    "properties": {
                        "assessment_id": "fingerprint",
                        "bid_notice_id": "NOTICE:003",
                        "business_registration_number": "1234567890",
                        "outcome": "needs_review",
                    },
                },
                {
                    "type": "requirement_assessment",
                    "id": "a1",
                    "properties": {
                        "assessment_id": "runtime:overall",
                        "business_registration_number": "1234567890",
                        "outcome": "needs_review",
                    },
                },
            ]
        },
        "NOTICE:003",
        "1234567890",
    )
    assert result["assessment"]["outcome"] == "needs_review"
    assert result["requirement_assessments"][0]["outcome"] == "needs_review"


@pytest.mark.parametrize("reverse", [False, True])
def test_notice_latest_link_never_depends_on_lineage_array_order(reverse):
    from app.services.teoria_adapter import notice

    lineage = [{"bid_notice_id": "NOTICE:003"}, {"bid_notice_id": "NOTICE:004"}]
    if reverse:
        lineage.reverse()
    properties = {"bid_notice_id": "NOTICE:003", "lineage_notices": lineage}
    assert notice({"properties": properties})["latest_bid_notice_id"] is None
    properties["latest_bid_notice_id"] = "NOTICE:004"
    assert notice({"properties": properties})["latest_bid_notice_id"] == "NOTICE:004"
    properties.pop("latest_bid_notice_id")
    properties["is_latest_in_lineage"] = True
    assert notice({"properties": properties})["latest_bid_notice_id"] == "NOTICE:003"


@pytest.mark.parametrize("reverse", [False, True])
def test_requirement_set_is_selected_by_notice_identity(reverse):
    from app.services.teoria_adapter import requirement_set_object

    items = [
        {
            "type": "bid_requirement_set",
            "id": "foreign",
            "properties": {"bid_notice_id": "OTHER:001"},
        },
        {
            "type": "bid_requirement_set",
            "id": "ours",
            "properties": {"bid_notice_id": "NOTICE:003"},
        },
    ]
    if reverse:
        items.reverse()
    assert requirement_set_object({"objects": items}, "NOTICE:003")["id"] == "ours"


@pytest.mark.parametrize(
    "items",
    [
        [
            {
                "type": "bid_requirement_set",
                "id": "foreign",
                "properties": {"bid_notice_id": "OTHER:001"},
            }
        ],
        [{"type": "bid_requirement_set", "id": "unknown", "properties": {}}],
        [
            {
                "type": "bid_requirement_set",
                "id": "one",
                "properties": {"bid_notice_id": "NOTICE:003"},
            },
            {
                "type": "bid_requirement_set",
                "id": "two",
                "properties": {"bid_notice_id": "NOTICE:003"},
            },
        ],
    ],
)
def test_requirement_set_rejects_unknown_or_ambiguous_owner(items):
    from app.services.teoria_adapter import RequirementSetMismatch, requirement_set_object

    with pytest.raises(RequirementSetMismatch):
        requirement_set_object({"objects": items}, "NOTICE:003")


def _batch_item(notice_id="NOTICE:003"):
    return {
        "bid_notice_id": notice_id,
        "status": "completed",
        "outcome": "needs_review",
        "satisfied_count": 0,
        "unsatisfied_count": 0,
        "needs_review_count": 1,
        "issues": [],
    }


def test_batch_assessment_orders_requested_notices_and_preserves_per_notice_errors():
    from app.services.teoria_adapter import batch_assessment_response

    data = {
        "outcome": {
            "items": [
                {
                    "bid_notice_id": "OTHER:001",
                    "status": "error",
                    "error_code": "bid_requirements_not_found",
                },
                _batch_item(),
            ]
        }
    }
    result = batch_assessment_response(
        data, ["NOTICE:003", "OTHER:001", "NOTICE:003"], "1234567890"
    )
    assert [item["bid_notice_id"] for item in result["items"]] == ["NOTICE:003", "OTHER:001"]
    assert result["items"][0]["outcome"] == "needs_review"
    assert result["items"][1]["error_code"] == "bid_requirements_not_found"


@pytest.mark.parametrize(
    "scenario",
    [
        "foreign",
        "duplicate",
        "missing",
        "invalid_status",
        "invalid_outcome",
        "negative_count",
        "boolean_count",
        "string_count",
        "missing_count",
        "invalid_issue",
        "wrong_company",
        "invalid_key_outcome",
        "missing_error_code",
        "not_an_array",
        "truncated",
    ],
)
def test_batch_assessment_rejects_invalid_summary_and_scope(scenario):
    from app.services.teoria_adapter import AssessmentResponseMismatch, batch_assessment_response

    item = _batch_item()
    data = {"outcome": {"items": [item]}}
    if scenario == "foreign":
        item["bid_notice_id"] = "OTHER:001"
    elif scenario == "duplicate":
        data["outcome"]["items"].append(item.copy())
    elif scenario == "missing":
        data["outcome"]["items"] = []
    elif scenario == "invalid_status":
        item["status"] = "pending"
    elif scenario == "invalid_outcome":
        item["outcome"] = "eligible"
    elif scenario in {"negative_count", "boolean_count", "string_count"}:
        item["needs_review_count"] = {
            "negative_count": -1,
            "boolean_count": True,
            "string_count": "1",
        }[scenario]
    elif scenario == "missing_count":
        del item["needs_review_count"]
    elif scenario == "invalid_issue":
        item["issues"] = [{"outcome": "eligible"}]
    elif scenario == "wrong_company":
        item["business_registration_number"] = "0987654321"
    elif scenario == "invalid_key_outcome":
        item["key_outcomes"] = {"region": {"outcome": "eligible"}}
    elif scenario == "missing_error_code":
        item["status"] = "error"
    elif scenario == "not_an_array":
        data["outcome"]["items"] = {}
    else:
        data["truncated"] = True
    with pytest.raises(AssessmentResponseMismatch):
        batch_assessment_response(data, ["NOTICE:003"], "1234567890")


def test_requirement_set_uses_explicit_number_and_order_when_notice_id_is_absent():
    from app.services.teoria_adapter import requirement_set_object

    data = {
        "objects": [
            {
                "type": "bid_requirement_set",
                "id": "ours",
                "properties": {
                    "notice_number": "NOTICE",
                    "notice_order": "003",
                },
            }
        ]
    }
    assert requirement_set_object(data, "NOTICE:003")["id"] == "ours"


def test_requirement_set_never_overrides_a_conflicting_notice_id_with_number_and_order():
    from app.services.teoria_adapter import RequirementSetMismatch, requirement_set_object

    data = {
        "objects": [
            {
                "type": "bid_requirement_set",
                "id": "foreign",
                "properties": {
                    "bid_notice_id": "OTHER:001",
                    "notice_number": "NOTICE",
                    "notice_order": "003",
                },
            }
        ]
    }
    with pytest.raises(RequirementSetMismatch):
        requirement_set_object(data, "NOTICE:003")


def test_batch_counts_do_not_override_boolean_expression_outcome():
    from app.services.teoria_adapter import batch_assessment_response

    item = _batch_item()
    item.update(outcome="satisfied", satisfied_count=1, unsatisfied_count=1, needs_review_count=0)
    result = batch_assessment_response({"outcome": {"items": [item]}}, ["NOTICE:003"], "1234567890")
    assert result["items"][0]["outcome"] == "satisfied"
    assert result["items"][0]["unsatisfied_count"] == 1
