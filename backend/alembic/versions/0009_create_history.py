"""Histórico privado de resumos cifrados."""

import sqlalchemy as sa
from alembic import op

revision = "0009_create_history"
down_revision = "d54d18c82688"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "history_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(6), nullable=False),
        sa.Column("payload_encrypted", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.CheckConstraint("kind IN ('search', 'route')", name="ck_history_kind"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_history_owner_kind_created",
        "history_entries",
        ["user_id", "kind", "created_at", "id"],
    )
    op.create_index("ix_history_created", "history_entries", ["created_at"])


def downgrade():
    op.drop_index("ix_history_created", table_name="history_entries")
    op.drop_index("ix_history_owner_kind_created", table_name="history_entries")
    op.drop_table("history_entries")
