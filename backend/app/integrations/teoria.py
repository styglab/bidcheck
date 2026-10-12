import asyncio
from typing import Any, ClassVar

import httpx
from fastapi import HTTPException

from app.core.config import settings


class TeoriaClient:
    retry_delay_seconds: ClassVar[float] = 0.5
    retryable_statuses: ClassVar[set[int]] = {502, 504}
    required_complete: ClassVar[set[str]] = {
        "get_bid_requirements",
        "get_bid_participation_findings",
        "assess_company_bid_eligibility",
        "assess_company_bid_eligibilities",
    }
    error_messages: ClassVar[dict[str, str]] = {
        "unknown_capability": "요청한 데이터 조회 기능을 사용할 수 없습니다.",
        "bid_notice_not_found": "공고를 찾을 수 없습니다.",
        "bid_requirements_not_found": "참가요건이 아직 추출되지 않았습니다.",
        "invalid_capability_input": "조회 조건을 확인해 주세요.",
        "invalid_bid_notice_id": "공고 ID는 공고번호:차수 형식이어야 합니다.",
        "unauthorized": "외부 데이터 연결 인증을 확인할 수 없습니다.",
        "capability_timeout": "외부 데이터 조회 시간이 초과되었습니다.",
    }

    def __init__(self) -> None:
        self.base_url = settings.teoria_runtime_url.rstrip("/")

    @staticmethod
    def _invalid_response() -> HTTPException:
        return HTTPException(
            502,
            detail={
                "code": "teoria_invalid_response",
                "message": "외부 데이터 응답 형식을 확인할 수 없습니다.",
            },
        )

    def _decode(self, response: httpx.Response) -> dict[str, Any]:
        try:
            data = response.json()
        except ValueError as exc:
            raise self._invalid_response() from exc
        if not isinstance(data, dict):
            raise self._invalid_response()
        for field in ("objects", "links"):
            if field in data and (
                not isinstance(data[field], list)
                or any(not isinstance(item, dict) for item in data[field])
            ):
                raise self._invalid_response()
        for obj in data.get("objects", []):
            if "properties" in obj and not isinstance(obj["properties"], dict):
                raise self._invalid_response()
        for field in ("outcome", "registry", "pagination"):
            if field in data and not isinstance(data[field], dict):
                raise self._invalid_response()
        if "truncated" in data and not isinstance(data["truncated"], bool):
            raise self._invalid_response()
        return data

    async def execute(
        self,
        capability: str,
        inputs: dict[str, Any],
        *,
        max_objects: int = 500,
        provenance: bool = False,
    ) -> dict[str, Any]:
        if not settings.teoria_runtime_token:
            raise HTTPException(
                503,
                detail={
                    "code": "teoria_not_configured",
                    "message": "Teoria Runtime 연결이 설정되지 않았습니다.",
                },
            )
        payload = {
            "inputs": inputs,
            "options": {"max_objects": max_objects, "include_property_provenance": provenance},
        }
        headers = {"Authorization": f"Bearer {settings.teoria_runtime_token}"}
        deadline = asyncio.timeout(settings.teoria_timeout_seconds)
        try:
            async with deadline:
                return await self._execute(capability, payload, headers)
        except TimeoutError as exc:
            if not deadline.expired():
                raise
            raise HTTPException(
                504,
                detail={
                    "code": "teoria_timeout",
                    "message": "외부 데이터 조회 시간이 초과되었습니다.",
                },
            ) from exc

    async def _execute(self, capability: str, payload: dict, headers: dict) -> dict[str, Any]:
        async with httpx.AsyncClient(
            base_url=self.base_url, headers=headers, timeout=settings.teoria_timeout_seconds
        ) as client:
            for attempt in range(2):
                try:
                    response = await client.post(
                        f"/v1/capabilities/{capability}:execute", json=payload
                    )
                except httpx.TimeoutException as exc:
                    if attempt == 0:
                        await asyncio.sleep(self.retry_delay_seconds)
                        continue
                    raise HTTPException(
                        504,
                        detail={
                            "code": "teoria_timeout",
                            "message": "외부 데이터 조회 시간이 초과되었습니다.",
                        },
                    ) from exc
                except httpx.RequestError as exc:
                    raise HTTPException(
                        502,
                        detail={
                            "code": "teoria_connection_error",
                            "message": "외부 데이터 서비스에 연결하지 못했습니다.",
                        },
                    ) from exc
                if response.status_code in self.retryable_statuses and attempt == 0:
                    await asyncio.sleep(self.retry_delay_seconds)
                    continue
                if response.is_error:
                    try:
                        upstream = response.json()
                    except ValueError:
                        upstream = {}
                    detail = upstream.get("detail", upstream) if isinstance(upstream, dict) else {}
                    upstream_code = detail.get("code") if isinstance(detail, dict) else None
                    code = (
                        upstream_code
                        if isinstance(upstream_code, str) and upstream_code in self.error_messages
                        else "teoria_error"
                    )
                    message = self.error_messages.get(code, "Teoria Runtime 요청에 실패했습니다.")
                    mapped = (
                        response.status_code
                        if response.status_code in {401, 404, 409, 422, 502, 504}
                        else 502
                    )
                    raise HTTPException(mapped, detail={"code": code, "message": message})
                data = self._decode(response)
                if data.get("truncated") and capability in self.required_complete:
                    raise HTTPException(
                        502,
                        detail={
                            "code": "teoria_truncated",
                            "message": "요건 또는 근거 일부가 누락되어 결과를 표시할 수 없습니다.",
                        },
                    )
                return data
        raise HTTPException(
            502, detail={"code": "teoria_error", "message": "Teoria Runtime 요청에 실패했습니다."}
        )


teoria_client = TeoriaClient()
