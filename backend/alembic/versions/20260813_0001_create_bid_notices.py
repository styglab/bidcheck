"""create bid notices"""
from alembic import op
import sqlalchemy as sa

revision = "20260813_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bid_notices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("notice_number", sa.String(100), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("organization", sa.String(200), nullable=False),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("required_license", sa.String(200), nullable=True),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_bid_notices_notice_number", "bid_notices", ["notice_number"], unique=True)
    op.create_index("ix_bid_notices_deadline_at", "bid_notices", ["deadline_at"])


def downgrade() -> None:
    op.drop_table("bid_notices")

