import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app.integrations import teoria


@pytest.fixture
def runtime_transport(monkeypatch):
    real_client = httpx.AsyncClient
    # Stub configuration is test-only, never loaded from a real credential.
    monkeypatch.setattr(teoria.settings, "teoria_runtime_token", "test-placeholder")

    def install(handler):
        def client(**kwargs):
            return real_client(**kwargs, transport=httpx.MockTransport(handler))

        monkeypatch.setattr(teoria.httpx, "AsyncClient", client)

    return install


@pytest.mark.parametrize(
    "body",
    [
        [],
        {"objects": "wrong"},
        {"objects": [{"properties": []}]},
        {"registry": []},
        {"truncated": "false"},
    ],
)
def test_invalid_response_is_mapped_to_api_error(runtime_transport, body):
    runtime_transport(lambda request: httpx.Response(200, json=body))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(teoria.TeoriaClient().execute("get_bid_notice", {}))
    assert exc.value.status_code == 502
    assert exc.value.detail["code"] == "teoria_invalid_response"


def test_non_json_success_is_mapped_to_api_error(runtime_transport):
    runtime_transport(lambda request: httpx.Response(200, text="invalid json"))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(teoria.TeoriaClient().execute("get_bid_notice", {}))
    assert exc.value.detail["code"] == "teoria_invalid_response"


def test_connection_failure_does_not_expose_internal_exception(runtime_transport):
    def handler(request):
        raise httpx.ConnectError("internal connection details", request=request)

    runtime_transport(handler)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(teoria.TeoriaClient().execute("get_bid_notice", {}))
    assert exc.value.detail["code"] == "teoria_connection_error"
    assert "internal" not in str(exc.value.detail)


@pytest.mark.parametrize(
    "body",
    [
        ["invalid"],
        {"detail": {"code": "bid_requirements_not_found", "message": "internal details"}},
    ],
)
def test_upstream_error_messages_are_not_forwarded(runtime_transport, body):
    runtime_transport(lambda request: httpx.Response(409, json=body))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(teoria.TeoriaClient().execute("get_bid_requirements", {}))
    assert exc.value.status_code == 409
    assert "internal" not in str(exc.value.detail)


@pytest.mark.parametrize(
    "capability",
    [
        "get_bid_requirements",
        "get_bid_participation_findings",
        "assess_company_bid_eligibility",
        "assess_company_bid_eligibilities",
    ],
)
def test_incomplete_requirements_and_assessments_are_rejected(runtime_transport, capability):
    runtime_transport(lambda request: httpx.Response(200, json={"truncated": True}))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(teoria.TeoriaClient().execute(capability, {}))
    assert exc.value.detail["code"] == "teoria_truncated"


def test_retry_delay_is_included_in_total_capability_deadline(runtime_transport, monkeypatch):
    calls = []
    monkeypatch.setattr(teoria.settings, "teoria_timeout_seconds", 0.03)

    def handler(request):
        calls.append(request)
        return httpx.Response(502, json={})

    runtime_transport(handler)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(teoria.TeoriaClient().execute("get_bid_notice", {}))
    assert exc.value.detail["code"] == "teoria_timeout"
    assert len(calls) == 1


def test_retry_keeps_the_same_input_and_succeeds(runtime_transport, monkeypatch):
    import json

    calls = []
    monkeypatch.setattr(teoria.TeoriaClient, "retry_delay_seconds", 0.001)

    def handler(request):
        calls.append(json.loads(request.content))
        return httpx.Response(502 if len(calls) == 1 else 200, json={"objects": []})

    runtime_transport(handler)
    result = asyncio.run(
        teoria.TeoriaClient().execute(
            "get_bid_notice", {"notice_number": "NOTICE", "notice_order": "003"}
        )
    )
    assert result == {"objects": []}
    assert len(calls) == 2
    assert calls[0] == calls[1]


def test_slow_capability_is_cancelled_within_total_deadline(runtime_transport, monkeypatch):
    monkeypatch.setattr(teoria.settings, "teoria_timeout_seconds", 0.03)
    cancelled = []

    async def handler(request):
        try:
            await asyncio.sleep(1)
        finally:
            cancelled.append(True)
        return httpx.Response(200, json={})

    runtime_transport(handler)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(teoria.TeoriaClient().execute("get_bid_notice", {}))
    assert exc.value.status_code == 504
    assert cancelled == [True]
