"""Identificador interno de dispositivo para o limite de criação (RN06)."""

import sqlalchemy as sa
from alembic import op

revision: str = "0002_report_device_id"
down_revision: str | None = "0001_create_reports"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("device_id", sa.Uuid(), nullable=True))
    op.create_index("ix_reports_device_created", "reports", ["device_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_reports_device_created", table_name="reports")
    op.drop_column("reports", "device_id")
