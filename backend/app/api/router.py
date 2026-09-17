from fastapi import APIRouter

from app.api.v1.bids import router as bids_router
from app.api.v1.checks import router as checks_router
from app.api.v1.teoria_assessments import router as assessments_router
from app.api.v1.companies import router as companies_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.home import router as home_router

api_router = APIRouter()
api_router.include_router(bids_router, prefix="/bids", tags=["bids"])
api_router.include_router(checks_router, prefix="/checks", tags=["checks"])
api_router.include_router(assessments_router, prefix="/assessments", tags=["assessments"])
api_router.include_router(companies_router, prefix="/companies", tags=["companies"])
api_router.include_router(organizations_router, prefix="/organizations", tags=["organizations"])
api_router.include_router(home_router, prefix="/home", tags=["home"])
