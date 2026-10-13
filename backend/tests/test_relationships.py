from datetime import UTC, datetime

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.integrations.teoria import teoria_client
from app.main import app


def seed(code):
    return {
        "type": "bid_award",
        "id": f"award-{code}",
        "properties": {
            "demand_organization_code": code,
            "demand_organization_name": f"기관 {code}",
        },
    }


def relationship(number="1234567890", amount=0):
    return {
        "company_number": number,
        "company_name": "거래업체",
        "contract_event_count": 2,
        "total_attributed_contract_amount": amount,
        "amount_completeness": "complete",
        "supplier_entry": {"entry_status": "first_observed", "target_year": 2026},
    }


def test_discovery_uses_runtime_aggregates_and_bounds_unique_institutions(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs))
        if capability == "search_organization_supplier_entries":
            return {
                "outcome": {
                    "items": [
                        {
                            "company_number": "8888888888",
                            "company_name": "신규 업체",
                            "entry_status": "first_observed",
                            "target_year_contract_count": 1,
                            "target_year_attributed_contract_amount": 0,
                        }
                    ]
                }
            }
        if capability == "search_bid_awards":
            return {
                "objects": [
                    {"type": "company", "properties": {}},
                    seed("A"),
                    seed("A"),
                    seed("B"),
                    seed("C"),
                    seed("D"),
                    seed("E"),
                ]
            }
        return {
            "outcome": {
                "organization": {"name": "확인된 기관"},
                "company_relationships": [relationship(), relationship("9999999999", None)],
            }
        }

    monkeypatch.setattr(teoria_client, "execute", execute)
    client = TestClient(app)
    result = client.get("/api/v1/home/relationships?period_years=3&work_type=service")
    assert result.status_code == 200
    body = result.json()
    assert body["analysis_basis"]["organization_count"] == 5
    assert len(calls) == 11
    assert {
        inputs["organization_code"]
        for capability, inputs in calls
        if capability == "analyze_organization_procurement_profile"
    } == {"A", "B", "C", "D", "E"}
    assert all(inputs["work_type"] == "service" for _, inputs in calls)
    assert calls[1][1]["period_from_year"] == datetime.now(UTC).year - 2
    assert calls[1][1]["sort"] == "contract_amount_desc"
    assert body["items"][0]["total_attributed_contract_amount"] == 0
    assert body["items"][-1]["total_attributed_contract_amount"] is None
    assert body["items"][0]["supplier_entry"]["entry_status"] == "first_observed"
    assert body["items"][0]["organization_name"] == "확인된 기관"
    assert body["new_relationships"][0]["company_number"] == "8888888888"
    assert body["new_relationships"][0]["target_year_attributed_contract_amount"] == 0
    client.get("/api/v1/home/relationships?period_years=3&work_type=service")
    assert len(calls) == 11


def test_partial_snapshot_preserves_failure_and_truncation_while_reused(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(capability)
        if capability == "search_bid_awards":
            return {"objects": [seed("A"), seed("B")], "truncated": True}
        if inputs["organization_code"] == "B":
            raise HTTPException(504, detail="internal error")
        return {"outcome": {"company_relationships": [relationship()]}}

    monkeypatch.setattr(teoria_client, "execute", execute)
    client = TestClient(app)
    body = client.get("/api/v1/home/relationships").json()
    assert body["partial"] is True
    assert body["truncated"] is True
    assert body["failed_organization_count"] == 1
    assert body["analysis_basis"]["organization_count"] == 1
    assert len(body["items"]) == 1
    client.get("/api/v1/home/relationships")
    assert len(calls) == 4


def test_failure_is_not_presented_as_empty_or_exposed(monkeypatch):
    async def execute(capability, inputs, **options):
        if capability == "search_bid_awards":
            return {"objects": [seed("A")]}
        raise HTTPException(502, detail="private upstream detail")

    monkeypatch.setattr(teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/home/relationships")
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "relationship_unavailable"
    assert "private" not in response.text


def test_empty_seeds_do_not_trigger_profile_queries(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(capability)
        return {"objects": []}

    monkeypatch.setattr(teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/home/relationships")
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert calls == ["search_bid_awards"]


def test_relationship_filters_are_validated():
    client = TestClient(app)
    for query in (
        "period_years=0",
        "period_years=6",
        "work_type=unsupported",
        "organization_limit=0",
        "organization_limit=25",
    ):
        assert client.get(f"/api/v1/home/relationships?{query}").status_code == 422


def test_carousel_preserves_runtime_totals_and_can_discover_more_than_three(monkeypatch):
    calls = []
    structure = {
        "contracted_company_count": 40,
        "total_company_attributed_contract_amount": 987654,
        "concentration_computable": False,
    }

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs))
        if capability == "search_bid_awards":
            return {"objects": [seed(f"{i:02}") for i in range(20)]}
        if capability == "search_organization_supplier_entries":
            return {"outcome": {"items": []}}
        return {
            "outcome": {
                "company_relationships": [
                    relationship(str(i), i if i else None) for i in range(30)
                ],
                "company_structure": structure,
                "data_completeness": {"status": "partial"},
            }
        }

    monkeypatch.setattr(teoria_client, "execute", execute)
    client = TestClient(app)
    body = client.get("/api/v1/home/relationships").json()
    assert len(body["organizations"]) == 12
    assert len(body["organizations"][0]["relationships"]) == 30
    assert body["organizations"][0]["company_structure"] == structure
    assert body["organizations"][0]["relationships"][0]["total_attributed_contract_amount"] is None
    assert body["partial"] is True
    expanded = client.get("/api/v1/home/relationships?organization_limit=24").json()
    assert len(expanded["organizations"]) == 20
    assert expanded["analysis_basis"]["organization_limit"] == 24
    assert len([c for c in calls if c[0] == "analyze_organization_procurement_profile"]) == 20


def test_lightweight_carousel_list_does_not_wait_for_other_profiles(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(capability)
        assert capability == "search_bid_awards"
        return {"objects": [seed(str(i)) for i in range(15)]}

    monkeypatch.setattr(teoria_client, "execute", execute)
    body = TestClient(app).get("/api/v1/home/relationships?include_profiles=false").json()
    assert len(body["organizations"]) == 12
    assert body["profiles_included"] is False
    assert body["organizations"][0]["relationships"] == []
    assert calls == ["search_bid_awards"]
