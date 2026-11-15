"""Consultas de conta usadas pela autenticação."""

from uuid import UUID

from sqlalchemy import func, literal, select, true, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import UnauthorizedException
from src.modules.users.models import User


async def require_user(session: AsyncSession, user_id: UUID) -> None:
    """Rejeita identidades sem conta cadastrada."""
    if await session.scalar(select(User.id).where(User.id == user_id)) is None:
        raise UnauthorizedException()


async def list_activity(
    session: AsyncSession, user_id: UUID, *, page: int = 1, page_size: int = 20
) -> tuple[list[dict], int]:
    """Atividades próprias visíveis; página e contagem no mesmo snapshot."""
    from src.core.exceptions import BusinessRuleException
    from src.modules.comments.models import Comment
    from src.modules.reports.models import Report

    if (
        type(page) is not int
        or type(page_size) is not int
        or page < 1
        or not 1 <= page_size <= 100
    ):
        raise BusinessRuleException("Paginação inválida.", code="VALIDATION_ERROR")
    activity = union_all(
        select(
            literal("report").label("type"),
            Report.id,
            Report.id.label("report_id"),
            Report.description.label("text"),
            Report.created_at,
        ).where(Report.author_id == user_id, Report.is_hidden.is_(False)),
        select(
            literal("comment").label("type"),
            Comment.id,
            Comment.report_id,
            Comment.text,
            Comment.created_at,
        )
        .join(Report, Report.id == Comment.report_id)
        .where(
            Comment.author_id == user_id,
            Comment.is_deleted.is_(False),
            Report.is_hidden.is_(False),
        ),
    ).subquery()
    order = (activity.c.created_at.desc(), activity.c.id.desc(), activity.c.type)
    entries = (
        select(activity)
        .order_by(*order)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .subquery()
    )
    count = select(func.count().label("total")).select_from(activity).subquery()
    result = await session.execute(
        select(count.c.total, entries)
        .select_from(count.outerjoin(entries, true()))
        .order_by(entries.c.created_at.desc(), entries.c.id.desc(), entries.c.type)
    )
    rows = result.mappings().all()
    return [
        dict((column.key, row[column.key]) for column in entries.c)
        for row in rows
        if row["id"] is not None
    ], rows[0]["total"]
