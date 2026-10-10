from fastapi.testclient import TestClient

from app.api.v1 import companies
from app.main import app


def test_company_activity_forwards_search_query(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs, options))
        return {
            "outcome": {
                "items": [],
                "pagination": {"page": 1, "page_size": 20, "total_items": 0, "total_pages": 0},
            },
            "registry": {"version": "2026.10.10.7"},
        }

    monkeypatch.setattr(companies.teoria_client, "execute", execute)

    response = TestClient(app).get(
        "/api/v1/companies/1168129581/activity"
        "?period_from_year=2022&period_to_year=2026&query=정보시스템&page=1&page_size=20"
    )

    assert response.status_code == 200
    assert calls[0][0] == "search_bid_participations"
    assert calls[0][1]["business_registration_number"] == "1168129581"
    assert calls[0][1]["query"] == "정보시스템"


def test_company_procurement_profile_forwards_organization_entry_filter(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs, options))
        return {
            "outcome": {
                "organization_relationships": [],
                "pagination": {"page": 1, "page_size": 10, "total_items": 46, "total_pages": 5},
                "organization_entry": {
                    "target_year": 2026,
                    "first_observed_organization_count": 46,
                },
            },
            "registry": {"version": "2026.10.10.9"},
        }

    monkeypatch.setattr(companies.teoria_client, "execute", execute)

    response = TestClient(app).get(
        "/api/v1/companies/1348108473/procurement-profile"
        "?period_from_year=2022&period_to_year=2026&target_year=2026"
        "&organization_entry_status=first_observed&page=1&page_size=10"
    )

    assert response.status_code == 200
    assert calls[0][0] == "analyze_company_procurement_profile"
    assert calls[0][1]["target_year"] == 2026
    assert calls[0][1]["organization_entry_status"] == "first_observed"
    assert response.json()["pagination"]["total_items"] == 46
