"""Vincula autoria e interações às contas existentes, sem exclusão em cascata."""

import sqlalchemy as sa
from alembic import op

revision = "0005_report_user_foreign_keys"
down_revision = "0004_merge_auth_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    for table, column in (("reports", "author_id"), ("report_interactions", "user_id")):
        orphan = connection.scalar(
            sa.text(
                f"SELECT EXISTS (SELECT 1 FROM {table} r "
                f"LEFT JOIN users u ON u.id = r.{column} WHERE u.id IS NULL)"
            )
        )
        if orphan:
            raise RuntimeError(
                f"Há referências sem conta em {table}.{column}; "
                "reconcilie os dados antes de reaplicar a migração."
            )
    op.create_foreign_key(
        "fk_reports_author_id", "reports", "users", ["author_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_report_interactions_user_id",
        "report_interactions",
        "users",
        ["user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_report_interactions_user_id", "report_interactions", type_="foreignkey"
    )
    op.drop_constraint("fk_reports_author_id", "reports", type_="foreignkey")
