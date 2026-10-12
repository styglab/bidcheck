from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field

NoticeId = Annotated[str, Field(pattern=r"^[^:\s]+:[^:\s]+$")]


class AssessmentRequest(BaseModel):
    business_registration_number: str = Field(pattern=r"^[0-9]{10}$")
    notice_id: NoticeId
    reference_date: date | None = None
    participation_mode: str | None = None


class BatchAssessmentRequest(BaseModel):
    business_registration_number: str = Field(pattern=r"^[0-9]{10}$")
    bid_notice_ids: list[NoticeId] = Field(min_length=1, max_length=100)
    reference_date: date | None = None
    participation_mode: str = "single"


AssessmentOutcome = Literal["satisfied", "unsatisfied", "needs_review"]
AssessmentCount = Annotated[int, Field(strict=True, ge=0)]


class AssessmentPreviewIssue(BaseModel):
    requirement_id: str | None = None
    outcome: AssessmentOutcome
    summary: str | None = None


class AssessmentKeyOutcome(BaseModel):
    applicability: Literal["applicable", "not_applicable", "unknown"]
    outcome: AssessmentOutcome | None
    satisfied_count: AssessmentCount
    unsatisfied_count: AssessmentCount
    needs_review_count: AssessmentCount
    requirement_ids: list[str]


class CompletedAssessmentPreview(BaseModel):
    bid_notice_id: NoticeId
    status: Literal["completed"]
    outcome: AssessmentOutcome
    satisfied_count: AssessmentCount
    unsatisfied_count: AssessmentCount
    needs_review_count: AssessmentCount
    key_outcomes: dict[str, AssessmentKeyOutcome] | None = None
    issues: list[AssessmentPreviewIssue] = Field(default_factory=list, max_length=2)


class FailedAssessmentPreview(BaseModel):
    bid_notice_id: NoticeId
    status: Literal["error"]
    error_code: str = Field(min_length=1)


BatchAssessmentPreview = Annotated[
    CompletedAssessmentPreview | FailedAssessmentPreview, Field(discriminator="status")
]
