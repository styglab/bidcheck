from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class BidNotice(Base):
    __tablename__ = "bid_notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    notice_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    organization: Mapped[str] = mapped_column(String(200))
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    required_license: Mapped[str | None] = mapped_column(String(200), nullable=True)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

