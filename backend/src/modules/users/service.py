"""Consultas de conta usadas pela autenticação."""

from uuid import UUID

from sqlalchemy import delete, func, literal, select, true, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import UnauthorizedException
from src.core.security import decrypt_sensitive_field, encrypt_sensitive_field
from src.modules.users.models import EmergencyContact, User


async def require_user(session: AsyncSession, user_id: UUID) -> None:
    """Rejeita identidades sem conta cadastrada."""
    if await session.scalar(select(User.id).where(User.id == user_id)) is None:
        raise UnauthorizedException()


async def get_primary_emergency_phone(
    session: AsyncSession, user_id: UUID
) -> str | None:
    """Retorna o telefone principal da conta, quando cadastrado."""
    encrypted_phone = await session.scalar(
        select(EmergencyContact.phone_encrypted).where(
            EmergencyContact.user_id == user_id,
            EmergencyContact.is_primary.is_(True),
        )
    )
    if encrypted_phone is None:
        return None
    return decrypt_sensitive_field(encrypted_phone)


async def list_emergency_contacts(
    session: AsyncSession, user_id: UUID
) -> list[dict]:
    """Lista os contatos de emergência da conta autenticada."""
    await require_user(session, user_id)
    rows = (
        await session.scalars(
            select(EmergencyContact)
            .where(EmergencyContact.user_id == user_id)
            .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.name.asc())
        )
    ).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "phone": decrypt_sensitive_field(row.phone_encrypted),
            "is_primary": row.is_primary,
        }
        for row in rows
    ]


async def replace_emergency_contacts(
    session: AsyncSession, user_id: UUID, contacts: list[dict]
) -> list[dict]:
    """Substitui os contatos de emergência da conta autenticada (até 3)."""
    await require_user(session, user_id)
    await session.execute(
        delete(EmergencyContact).where(EmergencyContact.user_id == user_id)
    )
    created: list[EmergencyContact] = []
    for item in contacts:
        contact = EmergencyContact(
            user_id=user_id,
            name=item["name"].strip(),
            phone_encrypted=encrypt_sensitive_field(item["phone"]),
            is_primary=bool(item["is_primary"]),
        )
        session.add(contact)
        created.append(contact)
    await session.commit()
    return [
        {
            "id": contact.id,
            "name": contact.name,
            "phone": decrypt_sensitive_field(contact.phone_encrypted),
            "is_primary": contact.is_primary,
        }
        for contact in created
    ]


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
