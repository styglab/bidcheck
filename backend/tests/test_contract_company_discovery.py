from fastapi.testclient import TestClient

from app.integrations.teoria import teoria_client
from app.main import app


def test_contract_candidates_preserve_evidence_and_do_not_attribute_whole_amount(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs))
        evidence = {
            "id": "C1",
            "type": "contract",
            "properties": {
                "unified_contract_number": "C1",
                "contract_name": "유지관리",
                "current_contract_amount": "0",
                "notice_number": "N1",
                "contractors": [
                    {
                        "business_registration_number": "123-45-67890",
                        "company_name": "A",
                        "share_percent": 40,
                    },
                    {"business_registration_number": "1234567890", "company_name": "A"},
                    {
                        "business_registration_number": "0987654321",
                        "company_name": "B",
                        "share_percent": None,
                    },
                ],
            },
        }
        return {
            "objects": [
                evidence,
                evidence,
                {
                    "id": "C2",
                    "type": "contract",
                    "properties": {"contract_name": "미확인", "contractors": []},
                },
            ],
            "pagination": {"total_items": 200},
            "truncated": False,
        }

    monkeypatch.setattr(teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/companies/contract-discovery?q=유지관리&period_years=3")
    assert response.status_code == 200
    body = response.json()
    assert calls[0][0] == "search_public_procurement_contracts"
    assert calls[0][1]["query"] == "유지관리"
    assert calls[0][1]["page_size"] == 100
    assert len(body["items"]) == 2
    for item in body["items"]:
        assert item["contract_count"] == 1
        assert item["contracts"][0]["amount"] == 0
        assert item["contracts"][0]["bid_notice_id"] is None
        assert "total_attributed_contract_amount" not in item
    assert body["partial"] is True
    assert body["sampled_contract_count"] == 2
    assert body["unidentified_contract_count"] == 1


def test_contract_search_validates_input_before_runtime(monkeypatch):
    async def execute(*args, **kwargs):
        raise AssertionError("Invalid input must not call Runtime")

    monkeypatch.setattr(teoria_client, "execute", execute)
    client = TestClient(app)
    assert client.get("/api/v1/companies/contract-discovery?q=%20%20").status_code == 422
    assert (
        client.get("/api/v1/companies/contract-discovery?q=유지관리&period_years=6").status_code
        == 422
    )


def test_missing_amount_and_runtime_truncation_remain_visible(monkeypatch):
    async def execute(*args, **kwargs):
        return {
            "objects": [
                {
                    "id": "C1",
                    "type": "contract",
                    "properties": {"contractors": [{"business_registration_number": "1234567890"}]},
                }
            ],
            "truncated": True,
        }

    monkeypatch.setattr(teoria_client, "execute", execute)
    body = TestClient(app).get("/api/v1/companies/contract-discovery?q=유지관리").json()
    assert body["partial"] is True
    assert body["items"][0]["contracts"][0]["amount"] is None
