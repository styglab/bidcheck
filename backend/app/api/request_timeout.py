import asyncio

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings


class RequestTimeoutMiddleware:
    """Bound the whole API request, including orchestration and retry delays."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/api/v1/"):
            await self.app(scope, receive, send)
            return
        started = False

        async def track_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        deadline = asyncio.timeout(settings.api_timeout_seconds)
        try:
            async with deadline:
                await self.app(scope, receive, track_send)
        except TimeoutError:
            if not deadline.expired():
                raise
            if started:
                # A response already on the wire cannot be replaced with another status.
                raise
            response = JSONResponse(
                {
                    "detail": {
                        "code": "request_timeout",
                        "message": "데이터 조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
                    }
                },
                status_code=504,
            )
            await response(scope, receive, send)
