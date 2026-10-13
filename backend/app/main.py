import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.request_timeout import RequestTimeoutMiddleware
from app.api.router import api_router
from app.services import company_discovery_service, procurement_cache, relationship_service
from app.services.discovery_refresh import refresh_discovery_snapshots


@asynccontextmanager
async def lifespan(app: FastAPI):
    refresh = asyncio.create_task(refresh_discovery_snapshots())
    try:
        yield
    finally:
        refresh.cancel()
        await asyncio.gather(refresh, return_exceptions=True)
        await company_discovery_service._sector_cache.close()
        await relationship_service._relationship_cache.close()
        await procurement_cache._runtime_read_cache.close()


app = FastAPI(lifespan=lifespan, title="Bid Check API", version="0.1.0")
app.include_router(api_router, prefix="/api/v1")
app.add_middleware(RequestTimeoutMiddleware)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
