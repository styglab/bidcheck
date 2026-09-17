from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from app.integrations.teoria import teoria_client
from app.services.teoria_adapter import award, objects_of

router = APIRouter()


@router.get("/recent-awards")
async def recent_awards():
    now = datetime.now(timezone.utc)
    data = await teoria_client.execute(
        "search_bid_awards",
        {"opening_at_from": (now - timedelta(days=90)).isoformat(), "opening_at_to": now.isoformat(), "sort": "award_desc", "page": 1, "page_size": 5},
        max_objects=30,
    )
    return {"items": [award(obj) for obj in objects_of(data, "bid_award")], "registry_version": data.get("registry", {}).get("version")}
