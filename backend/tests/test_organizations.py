from fastapi.testclient import TestClient

from app.api.v1 import organizations
from app.main import app


def test_procurement_activity_requests_notice_groups_and_preserves_truncation(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append((capability, inputs, options))
        return {
            "outcome": {
                "items": [{"activity_group_id": "notice:R1:000", "contracts": [], "awards": []}],
                "stage_counts": {"all": 1, "contract": 1},
                "pagination": {"page": 1, "page_size": 20, "total_items": 1, "total_pages": 1},
            },
            "registry": {"version": "2026.10.10.3"},
            "truncated": True,
        }

    monkeypatch.setattr(organizations.teoria_client, "execute", execute)

    response = TestClient(app).get(
        "/api/v1/organizations/Z004905/procurement-activity"
        "?period_from_year=2022&period_to_year=2026&stage=contract&page=1&page_size=20"
    )

    assert response.status_code == 200
    assert calls[0][0] == "search_procurement_activity"
    assert calls[0][1]["view_mode"] == "notice_grouped"
    assert response.json()["items"][0]["activity_group_id"] == "notice:R1:000"
    assert response.json()["truncated"] is True
    assert response.json()["registry_version"] == "2026.10.10.3"


def test_procurement_activity_forwards_failed_and_cancelled_stages(monkeypatch):
    calls = []

    async def execute(capability, inputs, **options):
        calls.append(inputs)
        return {
            "outcome": {
                "items": [],
                "stage_counts": {"all": 0, "failed": 0, "cancelled": 0},
                "pagination": {"page": 1, "page_size": 20, "total_items": 0, "total_pages": 0},
            }
        }

    monkeypatch.setattr(organizations.teoria_client, "execute", execute)

    for stage in ("failed", "cancelled"):
        response = TestClient(app).get(
            "/api/v1/organizations/Z004905/procurement-activity"
            f"?period_from_year=2022&period_to_year=2026&stage={stage}&page=1&page_size=20"
        )
        assert response.status_code == 200

    assert [call["stage"] for call in calls] == ["failed", "cancelled"]


def test_organization_activity_preserves_truncation(monkeypatch):
    async def execute(capability, inputs, **options):
        return {"objects": [], "truncated": capability == "search_bid_awards"}

    monkeypatch.setattr(organizations.teoria_client, "execute", execute)
    response = TestClient(app).get("/api/v1/organizations/ORG/activity")
    assert response.status_code == 200
    assert response.json()["truncated"] is True
