"""Registros importados SSP, sem autoria comunitária."""

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision = "0007_ssp_safety_records"
down_revision = "0006_create_comments"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ssp_safety_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("source_key", sa.String(64), nullable=False, unique=True),
        sa.Column("source_version", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(30), nullable=False, server_default="Furto"),
        sa.CheckConstraint("category = 'Furto'", name="ck_ssp_category"),
        sa.Column("location", Geometry("POINT", srid=4326)),
        sa.Column("incident_date", sa.Date()),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("source_url", sa.String(2048), nullable=False),
        sa.Column("source_period", sa.String(50), nullable=False),
        sa.Column("file_sha256", sa.String(64), nullable=False),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("source_version >= 1", name="ck_ssp_version"),
        sa.CheckConstraint(
            "NOT is_active OR (location IS NOT NULL AND incident_date IS NOT NULL)",
            name="ck_ssp_active_content",
        ),
    )


def downgrade():
    op.drop_table("ssp_safety_records")
