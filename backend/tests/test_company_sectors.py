from datetime import UTC, datetime

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.integrations.teoria import teoria_client
from app.main import app


def contract_object(number, amount, field="FIELD", name="공식 분야"):
    return {
        "type": "contract",
        "id": number,
        "properties": {
            "unified_contract_number": number,
            "current_contract_amount": amount,
            "total_amount": "99999999999999",
            "procurement_classification_number": field,
            "procurement_classification_name": name,
            "contractors": [
                {
                    "business_registration_number": "1234567890",
                    "company_name": "실적 업체",
                    "share_percent": 40,
                }
            ],
        },
    }


def test_sector_discovery_uses_official_fields_and_runtime_supplier_statistics(monkeypatch):
    calls = []
    year = datetime.now(UTC).year - 1

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs))
        if capability == "search_public_procurement_contracts":
            return {
                "objects": [
                    contract_object("C1", "1000"),
                    contract_object("C2", "9000"),
                    contract_object("C3", "999999", field=None, name=None),
                ]
            }
        return {
            "outcome": {
                "company": {"business_registration_number": "1234567890"},
                "summary": {
                    "contract_event_count": 7,
                    "total_attributed_contract_amount": 321,
                    "amount_completeness": "partial",
                    "organization_count": 2,
                },
                "organization_relationships": [
                    {"organization_code": "ORG", "organization_name": "거래기관"}
                ],
            }
        }

    monkeypatch.setattr(teoria_client, "execute", execute)
    client = TestClient(app)
    response = client.get("/api/v1/home/company-sectors")
    assert response.status_code == 200
    body = response.json()
    assert body["year"] == year
    assert [item["work_type"] for item in body["sectors"]] == ["goods", "service", "construction"]
    for sector in body["sectors"]:
        assert len(sector["fields"]) == 1
        field = sector["fields"][0]
        assert field["representative_contract_amount"] == 9000
        assert field["companies"][0]["total_attributed_contract_amount"] == 321
        assert field["companies"][0]["contract_event_count"] == 7
        assert field["companies"][0]["amount_completeness"] == "partial"
    profiles = [
        inputs
        for capability, inputs in calls
        if capability == "analyze_company_procurement_profile"
    ]
    assert len(profiles) == 3
    assert all(
        item["field_code"] == "FIELD"
        and item["period_from_year"] == year
        and item["period_to_year"] == year
        for item in profiles
    )
    client.get("/api/v1/home/company-sectors")
    assert len(calls) == 9


def test_partial_snapshot_preserves_failure_flags_and_is_reused(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(capability)
        if inputs["work_type"] == "service":
            raise HTTPException(502, detail="private upstream detail")
        return {"objects": []}

    monkeypatch.setattr(teoria_client, "execute", execute)
    client = TestClient(app)
    body = client.get("/api/v1/home/company-sectors").json()
    assert body["partial"] is True
    assert body["sectors"][1]["status"] == "unavailable"
    assert body["sectors"][0]["status"] == "available"
    assert body["sectors"][0]["fields"] == []
    client.get("/api/v1/home/company-sectors")
    assert len(calls) == 3


def test_supplier_failure_is_not_a_normal_empty_result(monkeypatch):
    async def execute(capability, inputs, **options):
        if capability == "search_public_procurement_contracts":
            return {"objects": [contract_object("C", "0")]}
        raise HTTPException(504, detail="upstream detail")

    monkeypatch.setattr(teoria_client, "execute", execute)
    body = TestClient(app).get("/api/v1/home/company-sectors").json()
    assert body["partial"] is True
    assert all(sector["fields"][0]["status"] == "unavailable" for sector in body["sectors"])
    assert body["sectors"][0]["fields"][0]["representative_contract_amount"] == 0


def test_all_sector_failures_return_sanitized_error(monkeypatch):
    async def execute(capability, inputs, **options):
        raise HTTPException(502, detail="private upstream detail")

    monkeypatch.setattr(teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/home/company-sectors")
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "company_sectors_unavailable"
    assert "private" not in response.text


def test_goods_use_official_supplier_fields_and_requery_field_specific_totals(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs))
        if capability == "search_public_procurement_contracts":
            return {
                "objects": [contract_object("G", "10000", None, None)]
                if inputs["work_type"] == "goods"
                else []
            }
        filtered = "field_code" in inputs
        return {
            "outcome": {
                "company": {"business_registration_number": "1234567890"},
                "summary": {
                    "contract_event_count": 2,
                    "total_attributed_contract_amount": 77 if filtered else 999,
                    "amount_completeness": "complete",
                },
                "field_distribution": [
                    {
                        "field_code": "GOODS",
                        "field_name": "공식 물품명",
                        "attributed_contract_amount": 77,
                    }
                ],
            }
        }

    monkeypatch.setattr(teoria_client, "execute", execute)
    body = TestClient(app).get("/api/v1/home/company-sectors").json()
    field = body["sectors"][0]["fields"][0]
    assert field["selection_basis"] == "supplier_official_field"
    assert field["field_name"] == "공식 물품명"
    assert field["representative_contract_amount"] is None
    assert field["companies"][0]["total_attributed_contract_amount"] == 77
    assert "candidate_companies" not in field
    assert (
        len(
            [
                inputs
                for capability, inputs in calls
                if capability == "analyze_company_procurement_profile"
            ]
        )
        == 2
    )
