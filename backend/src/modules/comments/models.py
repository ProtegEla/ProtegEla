"""Comentários por relato, com respostas e remoção que preserva a discussão."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        UniqueConstraint("id", "report_id", name="uq_comments_id_report"),
        ForeignKeyConstraint(
            ["parent_id", "report_id"],
            ["comments.id", "comments.report_id"],
            name="fk_comments_parent_report",
        ),
        CheckConstraint(
            "parent_id IS NULL OR parent_id <> id", name="ck_comments_not_self"
        ),
        CheckConstraint(
            "(is_deleted AND text IS NULL AND author_id IS NULL) OR "
            "(NOT is_deleted AND text IS NOT NULL AND author_id IS NOT NULL "
            "AND char_length(trim(text)) > 0)",
            name="ck_comments_content",
        ),
        Index("ix_comments_report_created", "report_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    report_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("reports.id", name="fk_comments_report"),
        nullable=False,
    )
    author_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="fk_comments_author"),
        index=True,
    )
    parent_id: Mapped[UUID | None] = mapped_column(Uuid)
    text: Mapped[str | None] = mapped_column(String(1000))
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
