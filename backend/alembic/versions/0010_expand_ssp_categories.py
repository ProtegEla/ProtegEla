"""Expande categorias permitidas em ssp_safety_records para crimes de rua.

Revision ID: 0010_expand_ssp_categories
Revises: 0009_create_history
Create Date: 2026-11-26 18:20:00.000000
"""

from alembic import op

revision = "0010_expand_ssp_categories"
down_revision = "0009_create_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_ssp_category", "ssp_safety_records", type_="check")
    op.create_check_constraint(
        "ck_ssp_category",
        "ssp_safety_records",
        "category IN ('Furto', 'Roubo', 'Violência', 'Assédio')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_ssp_category", "ssp_safety_records", type_="check")
    op.create_check_constraint(
        "ck_ssp_category",
        "ssp_safety_records",
        "category = 'Furto'",
    )
