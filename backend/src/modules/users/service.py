"""Consultas de conta usadas pela autenticação."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import UnauthorizedException
from src.modules.users.models import User


async def require_user(session: AsyncSession, user_id: UUID) -> None:
    """Rejeita identidades sem conta cadastrada."""
    if await session.scalar(select(User.id).where(User.id == user_id)) is None:
        raise UnauthorizedException()
