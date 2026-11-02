"""create login_attempts

Revision ID: df09e334f526
Revises: 80a8d7a6d903

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identificadores da migração
revision: str = "df09e334f526"
down_revision: Union[str, None] = "80a8d7a6d903"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a tabela de tentativas de login."""

    op.create_table(
        "login_attempts",

        sa.Column(
            "client_key",
            sa.String(length=64),
            nullable=False,
        ),

        sa.Column(
            "failed_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),

        sa.Column(
            "window_started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),

        sa.Column(
            "blocked_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.PrimaryKeyConstraint("client_key"),
    )


def downgrade() -> None:
    """Remove a tabela de tentativas de login."""

    op.drop_table("login_attempts")