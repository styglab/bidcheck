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
            "work_type": "service",
            "notice_organization_name": "테스트 기관",
            "notice_published_at": published_at,
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


def test_notice_detail_attaches_document_evidence_to_requirement(monkeypatch):
    async def execute(capability, inputs, **options):
        if capability == "get_bid_notice":
            return {"objects": [_notice("NOTICE:000", "open", "2026-09-01T00:00:00+00:00")]}
        if capability == "get_bid_requirements":
            return {
            "objects": [
                {"id": "req-1", "type": "bid_requirement", "properties": {"requirement_id": "req-1", "value_text": '{"text":"면허"}'}},
                {"id": "ev-1", "type": "bid_requirement_evidence", "properties": {"evidence_id": "ev-1", "requirement_id": "req-1", "source_type": "document", "source_document": "공고문.hwpx", "source_page": 3, "source_clause": "입찰참가자격", "source_excerpt": "입찰참가자는 ...", "source_url": "https://example.com/notice"}},
            ]
            }
        return {"registry": {"version": "2026.09.12.4"}, "objects": []}

    monkeypatch.setattr(bids.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/bids/NOTICE:000")

    assert response.status_code == 200
    evidence = response.json()["requirements"][0]["evidence"][0]
    assert evidence["source_document"] == "공고문.hwpx"
    assert evidence["source_page"] == 3


def test_notice_detail_attaches_evidence_to_participation_finding(monkeypatch):
    async def execute(capability, inputs, **options):
        if capability == "get_bid_notice":
            return {"objects": [_notice("NOTICE:000", "open", "2026-09-01T00:00:00+00:00")]}
        if capability == "get_bid_requirements":
            return {"objects": []}
        return {
            "registry": {"version": "2026.09.12.4"},
            "objects": [
                {"id": "finding-object", "type": "bid_participation_finding", "properties": {"finding_id": "finding-1", "category": "participation_note", "title": "서류 제출", "review_status": "needs_review"}},
                {"id": "evidence-object", "type": "bid_participation_finding_evidence", "properties": {"evidence_id": "evidence-1", "finding_id": "finding-1", "source_document": "공고문.pdf", "source_page": 2, "source_excerpt": "서류를 제출해야 한다."}},
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
    assert calls[0][0] == "assess_company_bid_eligibilities"
    assert calls[0][1]["bid_notice_ids"] == ["NOTICE:000"]
    assert calls[0][2]["max_objects"] == 100
