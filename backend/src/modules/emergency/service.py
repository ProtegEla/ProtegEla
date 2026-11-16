"""Regras de negócio do módulo de emergência."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.users.service import get_primary_emergency_phone

POLICE_PHONE = "190"


async def resolve_call_target(session: AsyncSession, user_id: UUID) -> str:
    """Seleciona o contato principal da conta ou a Polícia Militar."""
    phone = await get_primary_emergency_phone(session, user_id)
    return phone if phone is not None else POLICE_PHONE
