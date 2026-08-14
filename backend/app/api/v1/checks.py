from fastapi import APIRouter

from app.schemas.check import BidCheckRequest, BidCheckResponse
from app.services.bid_check_service import BidCheckService

router = APIRouter()


@router.post("", response_model=BidCheckResponse)
async def check_bid(payload: BidCheckRequest):
    return BidCheckService.check(payload)

