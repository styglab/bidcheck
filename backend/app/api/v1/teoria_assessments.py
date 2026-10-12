from fastapi import APIRouter, HTTPException

from app.integrations.teoria import teoria_client
from app.schemas.assessment import AssessmentRequest, BatchAssessmentRequest
from app.services.teoria_adapter import (
    AssessmentResponseMismatch,
    assessment_response,
    batch_assessment_response,
)

router = APIRouter()


@router.post("")
async def assess(payload: AssessmentRequest):
    inputs = {
        "business_registration_number": payload.business_registration_number,
        "bid_notice_id": payload.notice_id,
    }
    if payload.reference_date:
        inputs["reference_date"] = payload.reference_date.isoformat()
    if payload.participation_mode:
        inputs["participation_mode"] = payload.participation_mode
    data = await teoria_client.execute(
        "assess_company_bid_eligibility", inputs, max_objects=1000, provenance=True
    )
    try:
        return assessment_response(data, payload.notice_id, payload.business_registration_number)
    except AssessmentResponseMismatch:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "assessment_response_mismatch",
                "message": "평가 결과의 공고·회사·요건 소속을 확인할 수 없습니다. 다시 조회해 주세요.",
            },
        ) from None


@router.post("/batch")
async def assess_batch(payload: BatchAssessmentRequest):
    inputs = {
        "business_registration_number": payload.business_registration_number,
        "bid_notice_ids": list(dict.fromkeys(payload.bid_notice_ids)),
        "participation_mode": payload.participation_mode,
    }
    if payload.reference_date:
        inputs["reference_date"] = payload.reference_date.isoformat()
    data = await teoria_client.execute(
        "assess_company_bid_eligibilities",
        inputs,
        max_objects=100,
    )
    try:
        return batch_assessment_response(
            data, inputs["bid_notice_ids"], payload.business_registration_number
        )
    except AssessmentResponseMismatch:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "assessment_response_mismatch",
                "message": "일괄 평가 결과의 공고·판정 정보를 확인할 수 없습니다. 다시 조회해 주세요.",
            },
        ) from None
