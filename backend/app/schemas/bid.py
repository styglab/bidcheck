from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BidCreate(BaseModel):
    notice_number: str
    title: str
    organization: str
    region: str | None = None
    required_license: str | None = None
    deadline_at: datetime


class BidRead(BidCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)

