"""Interações únicas por usuária/relato e estado de ocultação (RF07/RN06).

A chave estrangeira de user_id depende da integração com usuárias.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0003_report_interactions"
down_revision: str | None = "0002_report_device_id"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "reports",
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "report_interactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "confirmation",
                "abuse",
                name="report_interaction_kind",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["report_id"], ["reports.id"], name="fk_report_interactions_report_id"
        ),
        sa.UniqueConstraint(
            "report_id", "user_id", name="uq_report_interactions_report_user"
        ),
    )
    op.create_index(
        "ix_report_interactions_report_kind",
        "report_interactions",
        ["report_id", "kind"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_report_interactions_report_kind", table_name="report_interactions"
    )
    op.drop_table("report_interactions")
    op.drop_column("reports", "is_hidden")
