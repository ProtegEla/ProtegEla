"""Regras de negócio do módulo de emergência."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.users.service import get_primary_emergency_phone

POLICE_PHONE = "190"


async def resolve_call_target(session: AsyncSession, user_id: UUID) -> str:
    """Seleciona o contato principal da conta ou a Polícia Militar."""
    phone = await get_primary_emergency_phone(session, user_id)
    return phone if phone is not None else POLICE_PHONE


def list_useful_numbers() -> list[dict[str, str]]:
    """Retorna os números públicos de segurança e emergência."""

    return [
        {
            "name": "Central de Atendimento à Mulher",
            "phone": "180",
            "description": "Orientação e denúncias de violência contra a mulher.",
        },
        {
            "name": "Polícia Militar",
            "phone": "190",
            "description": "Atendimento policial em situações de perigo imediato.",
        },
        {
            "name": "SAMU",
            "phone": "192",
            "description": "Atendimento médico de urgência e emergência.",
        },
        {
            "name": "Corpo de Bombeiros",
            "phone": "193",
            "description": "Atendimento a incêndios, acidentes e resgates.",
        },
        {
            "name": "Disque Direitos Humanos",
            "phone": "100",
            "description": "Orientação e denúncias de violações de direitos humanos.",
        },
    ]
