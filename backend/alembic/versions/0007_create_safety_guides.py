"""Orientações de segurança do RF11, com conteúdo inicial."""

from uuid import UUID

import sqlalchemy as sa

from alembic import op

revision = "0007_create_safety_guides"
down_revision = "0006_create_comments"
branch_labels = None
depends_on = None

GUIDES = [
    {
        "id": UUID("6f1d2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a01"),
        "slug": "o-que-e-assedio",
        "title": "O que é assédio?",
        "summary": "Entenda o que caracteriza o assédio.",
        "content": "O assédio é a exposição da vítima a situações de desconforto, humilhação, constrangimento ou intimidação.",
        "position": 1,
    },
    {
        "id": UUID("6f1d2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a02"),
        "slug": "fui-furtada",
        "title": "O que fazer se fui furtada?",
        "summary": "Registre o boletim de ocorrência e bloqueie seus cartões.",
        "content": "Faça um Boletim de Ocorrência online pelo site da Polícia Civil de São Paulo. Além disso, caso bens como cartões tenham sido levados, não se esqueça de bloqueá-los.",
        "position": 2,
    },
    {
        "id": UUID("6f1d2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a03"),
        "slug": "alguem-esta-me-seguindo",
        "title": "O que fazer se uma pessoa estiver me seguindo?",
        "summary": "Procure um local movimentado e peça ajuda.",
        "content": "Entre em um comércio ou estabelecimento com movimento e informe a alguém da equipe que está sendo perseguida. Ligue para a polícia se necessário.",
        "position": 3,
    },
]


def upgrade() -> None:
    safety_guides = op.create_table(
        "safety_guides",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.bulk_insert(safety_guides, GUIDES)


def downgrade() -> None:
    op.drop_table("safety_guides")