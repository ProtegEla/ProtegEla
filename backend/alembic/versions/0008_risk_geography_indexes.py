"""Índices métricos para vizinhança RN03, sem alterar dados."""

from alembic import op
import sqlalchemy as sa

revision = "0008_risk_geography_indexes"
down_revision = "0007_ssp_safety_records"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_reports_visible_geography",
        "reports",
        [sa.text("(location::geography)")],
        postgresql_using="gist",
        postgresql_where=sa.text("NOT is_hidden"),
    )
    op.create_index(
        "ix_ssp_active_geography",
        "ssp_safety_records",
        [sa.text("(location::geography)")],
        postgresql_using="gist",
        postgresql_where=sa.text("is_active"),
    )


def downgrade():
    op.drop_index("ix_ssp_active_geography", table_name="ssp_safety_records")
    op.drop_index("ix_reports_visible_geography", table_name="reports")
