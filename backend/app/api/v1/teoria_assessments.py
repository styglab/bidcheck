from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.integrations.teoria import teoria_client
from app.services.teoria_adapter import objects_of

router = APIRouter()


class AssessmentRequest(BaseModel):
    business_registration_number: str = Field(pattern=r"^[0-9]{10}$")
    notice_id: str
    reference_date: str | None = None
    participation_mode: str | None = None


@router.post("")
async def assess(payload: AssessmentRequest):
    inputs = {"business_registration_number": payload.business_registration_number, "bid_notice_id": payload.notice_id}
    if payload.reference_date: inputs["reference_date"] = payload.reference_date
    if payload.participation_mode: inputs["participation_mode"] = payload.participation_mode
    data = await teoria_client.execute("assess_company_bid_eligibility", inputs, max_objects=1000, provenance=True)
    overall = objects_of(data, "bid_eligibility_assessment")
    return {"assessment": overall[0].get("properties", {}) if overall else None, "requirement_assessments": [{"id": x.get("id"), **x.get("properties", {})} for x in objects_of(data, "requirement_assessment")], "evidence": [{"id": x.get("id"), **x.get("properties", {})} for x in objects_of(data, "evidence")], "registry_version": data.get("registry", {}).get("version")}
