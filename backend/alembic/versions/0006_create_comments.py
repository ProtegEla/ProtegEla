"""Comentários e respostas do RF08."""

import sqlalchemy as sa
from alembic import op

revision = "0006_create_comments"
down_revision = "0005_report_user_foreign_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("text", sa.String(1000), nullable=True),
        sa.Column(
            "is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["report_id"], ["reports.id"], name="fk_comments_report"
        ),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], name="fk_comments_author"),
        sa.UniqueConstraint("id", "report_id", name="uq_comments_id_report"),
        sa.ForeignKeyConstraint(
            ["parent_id", "report_id"],
            ["comments.id", "comments.report_id"],
            name="fk_comments_parent_report",
        ),
        sa.CheckConstraint(
            "parent_id IS NULL OR parent_id <> id", name="ck_comments_not_self"
        ),
        sa.CheckConstraint(
            "(is_deleted AND text IS NULL AND author_id IS NULL) OR "
            "(NOT is_deleted AND text IS NOT NULL AND author_id IS NOT NULL "
            "AND char_length(trim(text)) > 0)",
            name="ck_comments_content",
        ),
    )
    op.create_index("ix_comments_author_id", "comments", ["author_id"])
    op.create_index(
        "ix_comments_report_created", "comments", ["report_id", "created_at", "id"]
    )


def downgrade() -> None:
    op.drop_index("ix_comments_report_created", table_name="comments")
    op.drop_index("ix_comments_author_id", table_name="comments")
    op.drop_table("comments")
