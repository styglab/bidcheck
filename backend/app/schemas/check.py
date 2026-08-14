from typing import Literal

from pydantic import BaseModel


Result = Literal["PASS", "FAIL", "UNKNOWN"]
Status = Literal["ELIGIBLE", "INELIGIBLE", "REVIEW_REQUIRED"]


class BidCheckRequest(BaseModel):
    required_region: str | None = None
    company_region: str | None = None
    required_license: str | None = None
    company_licenses: list[str] = []


class CheckItem(BaseModel):
    rule: str
    result: Result
    reason: str


class BidCheckResponse(BaseModel):
    status: Status
    checks: list[CheckItem]

