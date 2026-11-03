"""Regras de comentários; identidade autenticada recebida separadamente do conteúdo."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import (
    BusinessRuleException,
    EntityNotFoundException,
    ForbiddenException,
)
from src.modules.comments.models import Comment
from src.modules.reports.service import ReportService
from src.modules.users.models import User


def normalize_text(value: str) -> str:
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 1000:
        raise BusinessRuleException(
            "O comentário deve conter de 1 a 1.000 caracteres.",
            code="VALIDATION_ERROR",
            details=[{"field": "text", "issue": "Texto vazio ou acima do limite."}],
        )
    return value.strip()


@dataclass(frozen=True, kw_only=True)
class CommentDetails:
    id: UUID
    report_id: UUID
    parent_id: UUID | None
    author: str | None
    text: str | None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class CommentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.reports = ReportService(session)

    def _projection(self) -> Select:
        return select(
            Comment.id,
            Comment.report_id,
            Comment.parent_id,
            User.username.label("author"),
            Comment.text,
            Comment.is_deleted,
            Comment.created_at,
            Comment.updated_at,
        ).outerjoin(User, User.id == Comment.author_id)

    async def _details(self, comment_id: UUID) -> CommentDetails:
        result = await self.session.execute(
            self._projection().where(Comment.id == comment_id)
        )
        return CommentDetails(**result.mappings().one())

    async def list(
        self, report_id: UUID, *, page: int = 1, page_size: int = 20
    ) -> tuple[list[CommentDetails], int]:
        if (
            type(page) is not int
            or type(page_size) is not int
            or page < 1
            or not 1 <= page_size <= 100
        ):
            raise BusinessRuleException("Paginação inválida.", code="VALIDATION_ERROR")
        await self.reports.require_visible(report_id, lock=True)
        # Contagem e página usam o mesmo snapshot, inclusive em páginas vazias.
        page_query = (
            self._projection()
            .where(Comment.report_id == report_id)
            .order_by(Comment.created_at, Comment.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
            .subquery()
        )
        count_query = (
            select(func.count(Comment.id).label("total"))
            .where(Comment.report_id == report_id)
            .subquery()
        )
        result = await self.session.execute(
            select(count_query.c.total, page_query)
            .select_from(count_query.outerjoin(page_query, true()))
            .order_by(page_query.c.created_at, page_query.c.id)
        )
        rows = result.mappings().all()
        return [
            CommentDetails(**{column.key: row[column.key] for column in page_query.c})
            for row in rows
            if row["id"] is not None
        ], rows[0]["total"]

    async def create(
        self,
        report_id: UUID,
        *,
        author_id: UUID,
        text: str,
        parent_id: UUID | None = None
    ) -> CommentDetails:
        text = normalize_text(text)
        try:
            await self.reports.require_visible(report_id, lock=True)
            if parent_id is not None:
                parent = await self.session.scalar(
                    select(Comment.id).where(
                        Comment.id == parent_id,
                        Comment.report_id == report_id,
                        Comment.is_deleted.is_(False),
                    )
                )
                if parent is None:
                    raise EntityNotFoundException("Comentário pai não encontrado.")
            comment = Comment(
                report_id=report_id, author_id=author_id, text=text, parent_id=parent_id
            )
            self.session.add(comment)
            await self.session.flush()
            details = await self._details(comment.id)
            await self.session.commit()
            return details
        except Exception:
            await self.session.rollback()
            raise

    async def _owned(
        self, report_id: UUID, comment_id: UUID, author_id: UUID
    ) -> Comment:
        await self.reports.require_visible(report_id, lock=True)
        comment = await self.session.scalar(
            select(Comment)
            .where(
                Comment.id == comment_id,
                Comment.report_id == report_id,
                Comment.is_deleted.is_(False),
            )
            .execution_options(populate_existing=True)
        )
        if comment is None:
            raise EntityNotFoundException("Comentário não encontrado.")
        if comment.author_id != author_id:
            raise ForbiddenException("Apenas a autora pode alterar o comentário.")
        return comment

    async def edit(
        self, report_id: UUID, comment_id: UUID, *, author_id: UUID, text: str
    ) -> CommentDetails:
        text = normalize_text(text)
        try:
            comment = await self._owned(report_id, comment_id, author_id)
            comment.text = text
            comment.updated_at = func.clock_timestamp()
            await self.session.flush()
            details = await self._details(comment.id)
            await self.session.commit()
            return details
        except Exception:
            await self.session.rollback()
            raise

    async def delete(
        self, report_id: UUID, comment_id: UUID, *, author_id: UUID
    ) -> None:
        try:
            comment = await self._owned(report_id, comment_id, author_id)
            comment.text = None
            comment.author_id = None
            comment.is_deleted = True
            comment.updated_at = func.clock_timestamp()
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
