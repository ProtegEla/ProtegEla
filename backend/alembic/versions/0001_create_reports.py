"""Cria relatos individuais; vínculo com Users depende da integração futura.

Revision ID: 0001_create_reports
Revises: None

Requer PostGIS previamente habilitado pelo administrador do banco local.
Não cria uma tabela de usuárias substituta nem define política de exclusão.
"""

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0001_create_reports"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "Assédio",
                "Violência",
                "Furto",
                "Má iluminação",
                name="report_category",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "location",
            geoalchemy2.Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("address_reference", sa.String(255), nullable=True),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("incident_date", sa.Date(), nullable=False),
        sa.Column(
            "incident_period",
            sa.Enum(
                "madrugada",
                "manha",
                "tarde",
                "noite",
                name="incident_period",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("incident_time", sa.Time(timezone=False), nullable=True),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_author_id", "reports", ["author_id"])
    op.create_index(
        "idx_reports_location", "reports", ["location"], postgresql_using="gist"
    )


def downgrade() -> None:
    op.drop_index("idx_reports_location", table_name="reports")
    op.drop_index("ix_reports_author_id", table_name="reports")
    op.drop_table("reports")
