import asyncio
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings


class TeoriaClient:
    retryable_statuses = {502, 504}

    def __init__(self) -> None:
        self.base_url = settings.teoria_runtime_url.rstrip("/")

    async def execute(self, capability: str, inputs: dict[str, Any], *, max_objects: int = 500, provenance: bool = False) -> dict[str, Any]:
        if not settings.teoria_runtime_token:
            raise HTTPException(503, detail={"code": "teoria_not_configured", "message": "Teoria Runtime 연결이 설정되지 않았습니다."})
        payload = {"inputs": inputs, "options": {"max_objects": max_objects, "include_property_provenance": provenance}}
        headers = {"Authorization": f"Bearer {settings.teoria_runtime_token}"}
        async with httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=settings.teoria_timeout_seconds) as client:
            for attempt in range(2):
                try:
                    response = await client.post(f"/v1/capabilities/{capability}:execute", json=payload)
                except httpx.TimeoutException as exc:
                    if attempt == 0:
                        await asyncio.sleep(0.5)
                        continue
                    raise HTTPException(504, detail={"code": "teoria_timeout", "message": "외부 데이터 조회 시간이 초과되었습니다."}) from exc
                if response.status_code in self.retryable_statuses and attempt == 0:
                    await asyncio.sleep(0.5)
                    continue
                if response.is_error:
                    try: upstream = response.json()
                    except ValueError: upstream = {}
                    detail = upstream.get("detail", upstream)
                    code = detail.get("code", "teoria_error") if isinstance(detail, dict) else "teoria_error"
                    message = detail.get("message", "Teoria Runtime 요청에 실패했습니다.") if isinstance(detail, dict) else "Teoria Runtime 요청에 실패했습니다."
                    mapped = response.status_code if response.status_code in {401, 404, 409, 422, 502, 504} else 502
                    raise HTTPException(mapped, detail={"code": code, "message": message})
                data = response.json()
                if data.get("truncated") and capability in {"get_bid_requirements", "assess_company_bid_eligibility"}:
                    raise HTTPException(502, detail={"code": "teoria_truncated", "message": "요건 또는 근거 일부가 누락되어 결과를 표시할 수 없습니다."})
                return data
        raise HTTPException(502, detail={"code": "teoria_error", "message": "Teoria Runtime 요청에 실패했습니다."})


teoria_client = TeoriaClient()
