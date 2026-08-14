from fastapi import APIRouter

from app.api.v1.bids import router as bids_router
from app.api.v1.checks import router as checks_router
from app.api.v1.teoria_assessments import router as assessments_router
from app.api.v1.companies import router as companies_router

api_router = APIRouter()
api_router.include_router(bids_router, prefix="/bids", tags=["bids"])
api_router.include_router(checks_router, prefix="/checks", tags=["checks"])
api_router.include_router(assessments_router, prefix="/assessments", tags=["assessments"])
api_router.include_router(companies_router, prefix="/companies", tags=["companies"])
