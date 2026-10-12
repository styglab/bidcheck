from fastapi.testclient import TestClient

from app.api.v1 import bids, teoria_assessments
from app.main import app


def _notice(notice_id: str, status: str, published_at: str, opening_at: str | None = None) -> dict:
    number, order = notice_id.split(":")
    return {
        "type": "bid_notice",
        "properties": {
            "bid_notice_id": notice_id,
            "notice_number": number,
            "notice_order": order,
            "notice_name": f"{status} 공고",
            "bid_status": status,
            "current_status": status,
            "work_type": "service",
            "notice_organization_name": "테스트 기관",
            "notice_published_at": published_at,
            "bid_begin_at": "2026-10-14T01:00:00Z",
            "opening_at": opening_at,
        },
    }


def test_search_requests_visible_statuses_in_one_call(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(inputs)
        items = [
            _notice("SCHEDULED:000", "scheduled", "2026-09-04T08:08:10+00:00"),
            _notice("OPEN:000", "open", "2026-09-03T08:08:10+00:00"),
            _notice("UNKNOWN:000", "unknown", "2026-09-02T08:08:10+00:00"),
        ]
        return {
            "objects": items,
            "pagination": {"page": 1, "page_size": 20, "total_items": 3, "total_pages": 1},
            "truncated": False,
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get("/api/v1/bids?page=1&page_size=20")

    assert response.status_code == 200
    payload = response.json()
    assert [item["status"] for item in payload["items"]] == ["scheduled", "open", "unknown"]
    assert payload["pagination"]["total_items"] == 3
    assert len(calls) == 1
    assert calls[0]["bid_statuses"] == ["scheduled", "open", "unknown"]
    assert calls[0]["notice_status"] == "active"


def test_search_does_not_recalculate_unknown_status(monkeypatch):
    async def execute(capability, inputs, **options):
        objects = [
            _notice(
                "EXPIRED:000",
                "unknown",
                "2026-09-01T00:00:00+00:00",
                "2026-09-02T00:00:00+00:00",
            )
        ]
        return {
            "objects": objects,
            "pagination": {
                "page": 1,
                "page_size": inputs["page_size"],
                "total_items": len(objects),
                "total_pages": 1 if objects else 0,
            },
            "truncated": False,
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get(
        "/api/v1/bids?published_to=2026-09-11T00:00:00%2B00:00&page=1&page_size=20"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == ["EXPIRED:000"]
    assert response.json()["pagination"]["total_items"] == 1


def test_notice_uses_current_status_and_preserves_status_evidence(monkeypatch):
    async def execute(capability, inputs, **options):
        item = _notice("FAILED:000", "closed", "2026-10-08T00:00:00+00:00")
        item["properties"].update(
            {
                "current_status": "failed",
                "current_status_label": "유찰",
                "notice_status": "active",
                "failure_reason": "단독응찰",
                "failure_at": "2026-10-08T09:00:00Z",
                "status_source": "pps_bid_result_api.list_failing_opening_results",
            }
        )
        return {
            "objects": [item],
            "pagination": {"page": 1, "page_size": 20, "total_items": 1, "total_pages": 1},
            "truncated": False,
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get("/api/v1/bids?include_history=true&page=1&page_size=20")

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["status"] == "failed"
    assert item["bid_status"] == "closed"
    assert item["notice_status"] == "active"
    assert item["failure_reason"] == "단독응찰"


def test_notice_exposes_bid_begin_at(monkeypatch):
    async def execute(capability, inputs, **options):
        return {
            "objects": [_notice("SCHEDULED:000", "scheduled", "2026-10-11T00:00:00Z")],
            "pagination": {"page": 1, "page_size": 20, "total_items": 1, "total_pages": 1},
            "truncated": False,
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get("/api/v1/bids?page=1&page_size=20")

    assert response.status_code == 200
    assert response.json()["items"][0]["bid_begin_at"] == "2026-10-14T01:00:00Z"


def test_related_projects_uses_current_filter_contract(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs))
        return {
            "outcome": {
                "items": [],
                "filter_counts": {"all": 0},
                "pagination": {"page": 1, "page_size": 5, "total_items": 0, "total_pages": 0},
            }
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get(
        "/api/v1/bids/NOTICE%3A000/related-projects"
        "?project_filter=similar_amount&filter_operator=and&page=1&page_size=5"
    )

    assert response.status_code == 200
    assert calls[0][0] == "search_bid_related_projects"
    assert calls[0][1]["project_filters"] == ["similar_amount"]
    assert calls[0][1]["filter_operator"] == "and"
    assert "project_filter" not in calls[0][1]


def test_search_accepts_other_work_type(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(inputs)
        return {
            "objects": [],
            "pagination": {"page": 1, "page_size": 20, "total_items": 0, "total_pages": 0},
            "truncated": False,
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get("/api/v1/bids?work_type=other&page=1&page_size=20")

    assert response.status_code == 200
    assert len(calls) == 1
    assert all(call["work_type"] == "other" for call in calls)


def test_search_forwards_hierarchical_field_filters(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(inputs)
        return {
            "objects": [],
            "pagination": {"page": 1, "page_size": 5, "total_items": 0, "total_pages": 0},
            "truncated": False,
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get(
        "/api/v1/bids?work_type=service&large_category=ICT%20%EC%84%9C%EB%B9%84%EC%8A%A4"
        "&middle_category=SW%20%EB%B0%8F%20%EC%8B%9C%EC%8A%A4%ED%85%9C%20%EA%B0%9C%EB%B0%9C"
        "&field_code=81111599&sort=published_desc&page=1&page_size=5"
    )

    assert response.status_code == 200
    assert calls[0]["work_type"] == "service"
    assert calls[0]["large_category"] == "ICT 서비스"
    assert calls[0]["middle_category"] == "SW 및 시스템 개발"
    assert calls[0]["field_code"] == "81111599"
    assert calls[0]["sort"] == "published_desc"


def test_notice_detail_attaches_document_evidence_to_requirement(monkeypatch):
    async def execute(capability, inputs, **options):
        if capability == "get_bid_notice":
            return {"objects": [_notice("NOTICE:000", "open", "2026-09-01T00:00:00+00:00")]}
        if capability == "get_bid_requirements":
            return {
                "objects": [
                    {
                        "id": "req-1",
                        "type": "bid_requirement",
                        "properties": {
                            "requirement_id": "req-1",
                            "value_text": '{"text":"면허"}',
                            "assessment_stage": "qualification_review",
                        },
                    },
                    {
                        "id": "ev-1",
                        "type": "bid_requirement_evidence",
                        "properties": {
                            "evidence_id": "ev-1",
                            "requirement_id": "req-1",
                            "source_type": "document",
                            "source_document": "공고문.hwpx",
                            "source_page": 3,
                            "source_clause": "입찰참가자격",
                            "source_excerpt": "입찰참가자는 ...",
                            "source_url": "https://example.com/notice",
                        },
                    },
                ]
            }
        return {"registry": {"version": "2026.09.12.4"}, "objects": []}

    monkeypatch.setattr(bids.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/bids/NOTICE:000")

    assert response.status_code == 200
    evidence = response.json()["requirements"][0]["evidence"][0]
    assert evidence["source_document"] == "공고문.hwpx"
    assert evidence["source_page"] == 3
    assert response.json()["requirements"][0]["assessment_stage"] == "qualification_review"


def test_notice_detail_attaches_evidence_to_participation_finding(monkeypatch):
    async def execute(capability, inputs, **options):
        if capability == "get_bid_notice":
            return {"objects": [_notice("NOTICE:000", "open", "2026-09-01T00:00:00+00:00")]}
        if capability == "get_bid_requirements":
            return {"objects": []}
        return {
            "registry": {"version": "2026.09.12.4"},
            "objects": [
                {
                    "id": "finding-object",
                    "type": "bid_participation_finding",
                    "properties": {
                        "finding_id": "finding-1",
                        "category": "participation_note",
                        "title": "서류 제출",
                        "review_status": "needs_review",
                    },
                },
                {
                    "id": "evidence-object",
                    "type": "bid_participation_finding_evidence",
                    "properties": {
                        "evidence_id": "evidence-1",
                        "finding_id": "finding-1",
                        "source_document": "공고문.pdf",
                        "source_page": 2,
                        "source_excerpt": "서류를 제출해야 한다.",
                    },
                },
            ],
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/bids/NOTICE:000")

    assert response.status_code == 200
    finding = response.json()["participation_findings"][0]
    assert finding["review_status"] == "needs_review"
    assert finding["evidence"][0]["source_page"] == 2
    assert response.json()["registry_version"] == "2026.09.12.4"


def test_batch_assessment_returns_outcome_items(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs, options))
        return {
            "outcome": {
                "items": [
                    {
                        "bid_notice_id": "NOTICE:000",
                        "status": "completed",
                        "outcome": "needs_review",
                        "satisfied_count": 2,
                        "unsatisfied_count": 0,
                        "needs_review_count": 1,
                        "key_outcomes": {
                            "industry_license": {
                                "applicability": "applicable",
                                "outcome": "satisfied",
                                "satisfied_count": 1,
                                "unsatisfied_count": 0,
                                "needs_review_count": 0,
                                "requirement_ids": ["requirement-1"],
                            }
                        },
                        "issues": [],
                    }
                ]
            },
            "registry": {"version": "test"},
        }

    monkeypatch.setattr(teoria_assessments.teoria_client, "execute", execute)

    response = TestClient(app).post(
        "/api/v1/assessments/batch",
        json={
            "business_registration_number": "1234567890",
            "bid_notice_ids": ["NOTICE:000", "NOTICE:000"],
            "participation_mode": "single",
        },
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["bid_notice_id"] == "NOTICE:000"
    assert response.json()["items"][0]["key_outcomes"]["industry_license"]["outcome"] == "satisfied"
    assert calls[0][0] == "assess_company_bid_eligibilities"
    assert calls[0][1]["bid_notice_ids"] == ["NOTICE:000"]
    assert calls[0][2]["max_objects"] == 100


def test_organization_field_companies_uses_current_participation_context(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs, options))
        return {
            "outcome": {
                "analysis_basis": {"organization_code": "ORG-1", "period_years": 5},
                "supplier_concentration": {"company_count": 2},
                "market_entry": {"new_supplier_company_count": 1},
                "top_suppliers": [{"company_number": "1234567890"}],
                "attention_suppliers": [{"company_number": "0987654321"}],
                "top_suppliers_basis": {"limit": 5},
            },
            "registry": {"version": "test"},
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get(
        "/api/v1/bids/NOTICE:000/organization-field-companies?period_years=5"
    )

    assert response.status_code == 200
    assert calls == [
        (
            "analyze_bid_participation_context",
            {"bid_notice_id": "NOTICE:000", "period_years": 5},
            {"max_objects": 300},
        )
    ]
    assert response.json()["organization_field_companies"][0]["company_number"] == "1234567890"
    assert response.json()["market_similar_companies"][0]["company_number"] == "0987654321"


def test_market_context_uses_related_projects_without_legacy_capabilities(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs, options))
        if capability == "get_bid_notice":
            return {"objects": [_notice("NOTICE:000", "open", "2026-09-01T00:00:00+00:00")]}
        assert capability == "search_bid_related_projects"
        return {
            "outcome": {
                "analysis_basis": {"period_years": 5},
                "items": [
                    {
                        "contract_event_id": "CONTRACT-1",
                        "bid_notice_id": "PAST:000",
                        "notice_name": "과거 사업",
                        "company_number": "1234567890",
                        "company_name": "테스트기업",
                        "contract_amount": 100000000,
                        "first_contract_date": "2025-03-01",
                        "matched_filters": ["similar_amount"],
                    }
                ],
            }
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)

    response = TestClient(app).get("/api/v1/bids/NOTICE:000/market-context")

    assert response.status_code == 200
    assert [call[0] for call in calls] == ["get_bid_notice", "search_bid_related_projects"]
    payload = response.json()
    assert payload["similar_notices"][0]["company_number"] == "1234567890"
    assert payload["companies"][0]["contract_count"] == 0
    assert payload["sample_size"] == 1


def test_notice_activity_keeps_relationship_context_and_partial_contracts(monkeypatch):
    calls = []
    pagination = {"page": 1, "page_size": 20, "total_items": 30, "total_pages": 2}

    async def execute(capability, inputs, **options):
        calls.append(capability)
        if capability == "get_bid_notice_relationship_context":
            return {"outcome": {"bid_notice": {"bid_notice_id": "NOTICE:003"}, "participants": []}}
        if capability == "get_bid_notice_contracts":
            return {"objects": [], "pagination": pagination, "truncated": True}
        return {"outcome": {"opening_events": []}}

    monkeypatch.setattr(bids.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/bids/NOTICE:003/activity")
    assert response.status_code == 200
    data = response.json()
    assert data["contract_pagination"] == pagination
    assert data["truncated"] is True
    assert data["relationship_context"]["bid_notice"]["bid_notice_id"] == "NOTICE:003"
    assert calls.count("get_bid_notice_relationship_context") == 1


def test_legacy_local_check_is_not_available():
    assert TestClient(app).post("/api/v1/checks", json={}).status_code == 404


def test_assessment_validates_notice_and_reference_date_without_upstream_calls(monkeypatch):
    async def execute(*args, **kwargs):
        raise AssertionError("invalid inputs must be rejected locally")

    monkeypatch.setattr(teoria_assessments.teoria_client, "execute", execute)
    client = TestClient(app)
    for body in [
        {"notice_id": "NOTICE"},
        {"notice_id": "NOTICE:003", "reference_date": "invalid"},
    ]:
        response = client.post(
            "/api/v1/assessments", json={"business_registration_number": "1234567890", **body}
        )
        assert response.status_code == 422


def test_notice_detail_selects_requested_notice_by_id_not_array_order(monkeypatch):
    async def execute(capability, inputs, **options):
        if capability == "get_bid_notice":
            return {
                "objects": [
                    _notice("NOTICE:000", "closed", "2026-10-01T00:00:00Z"),
                    _notice("NOTICE:003", "open", "2026-10-02T00:00:00Z"),
                ]
            }
        return {"objects": []}

    monkeypatch.setattr(bids.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/bids/NOTICE:003")
    assert response.status_code == 200
    assert response.json()["notice"]["id"] == "NOTICE:003"


def test_assessment_response_links_runtime_evidence_and_keeps_contract_metadata(monkeypatch):
    async def execute(capability, inputs, **options):
        assert capability == "assess_company_bid_eligibility"
        return {
            "objects": [
                {
                    "id": "e1",
                    "type": "evidence",
                    "properties": {
                        "evidence_kind": "structured_api",
                        "observed_value_text": "조회된 회사 값",
                        "valid_until": "2026-12-31",
                    },
                },
                {
                    "id": "a1",
                    "type": "requirement_assessment",
                    "properties": {
                        "requirement_id": "req-1",
                        "assessment_id": "overall",
                        "business_registration_number": "1234567890",
                        "evaluated_value_text": "회사 확인값",
                        "evaluator_version": "evaluator-v1",
                        "outcome": "needs_review",
                    },
                },
                {
                    "id": "overall",
                    "type": "bid_eligibility_assessment",
                    "properties": {
                        "bid_notice_id": "NOTICE:003",
                        "business_registration_number": "1234567890",
                        "ruleset_version": "rules-v1",
                        "reference_date": "2026-10-12",
                    },
                },
            ],
            "links": [
                {
                    "type": "requirement_assessment_supported_by_evidence",
                    "source": "a1",
                    "target": "e1",
                }
            ],
            "registry": {"version": "registry-v1"},
        }

    monkeypatch.setattr(teoria_assessments.teoria_client, "execute", execute)
    response = TestClient(app).post(
        "/api/v1/assessments",
        json={"notice_id": "NOTICE:003", "business_registration_number": "1234567890"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["requirement_assessments"][0]["evidence_ids"] == ["e1"]
    assert result["requirement_assessments"][0]["outcome"] == "needs_review"
    assert result["requirement_assessments"][0]["evaluator_version"] == "evaluator-v1"
    assert result["evidence"][0]["observed_value_text"] == "조회된 회사 값"
    assert result["assessment"]["ruleset_version"] == "rules-v1"


def test_assessment_context_mismatch_returns_safe_gateway_error(monkeypatch):
    async def execute(*args, **kwargs):
        return {
            "objects": [
                {
                    "type": "bid_eligibility_assessment",
                    "id": "foreign-assessment",
                    "properties": {
                        "bid_notice_id": "OTHER:001",
                        "business_registration_number": "0987654321",
                    },
                }
            ]
        }

    monkeypatch.setattr(teoria_assessments.teoria_client, "execute", execute)
    response = TestClient(app).post(
        "/api/v1/assessments",
        json={
            "notice_id": "NOTICE:003",
            "business_registration_number": "1234567890",
        },
    )
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "assessment_response_mismatch"
    assert "foreign-assessment" not in response.text
    assert "0987654321" not in response.text


def test_batch_context_mismatch_returns_safe_gateway_error(monkeypatch):
    async def execute(*args, **kwargs):
        return {
            "outcome": {
                "items": [
                    {
                        "bid_notice_id": "FOREIGN:001",
                        "status": "completed",
                        "outcome": "satisfied",
                        "satisfied_count": 1,
                        "unsatisfied_count": 0,
                        "needs_review_count": 0,
                    }
                ]
            }
        }

    monkeypatch.setattr(teoria_assessments.teoria_client, "execute", execute)
    response = TestClient(app).post(
        "/api/v1/assessments/batch",
        json={
            "bid_notice_ids": ["NOTICE:003"],
            "business_registration_number": "1234567890",
        },
    )
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "assessment_response_mismatch"
    assert "FOREIGN" not in response.text


def test_notice_requirement_set_selection_uses_requested_notice(monkeypatch):
    async def execute(capability, *args, **kwargs):
        if capability == "get_bid_notice":
            return {"objects": [_notice("NOTICE:003", "open", "2026-10-12T00:00:00Z")]}
        if capability == "get_bid_requirements":
            return {
                "objects": [
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
            }
        return {"objects": []}

    monkeypatch.setattr(bids.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/bids/NOTICE:003")
    assert response.status_code == 200
    assert response.json()["requirement_set"]["id"] == "ours"


def test_notice_ambiguous_requirement_set_returns_safe_gateway_error(monkeypatch):
    async def execute(capability, *args, **kwargs):
        if capability == "get_bid_notice":
            return {"objects": [_notice("NOTICE:003", "open", "2026-10-12T00:00:00Z")]}
        return {
            "objects": [
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
            ]
        }

    monkeypatch.setattr(bids.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/bids/NOTICE:003")
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "requirement_set_mismatch"
