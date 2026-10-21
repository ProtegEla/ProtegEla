"""
Serviço de regras de negócio do módulo Auth.

Responsabilidades futuras (a serem implementadas pelo responsável do módulo):
- Registro de usuário com validação de unicidade de e-mail (RF01) e senha forte (RN08).
- Autenticação e validação de hash de senha (RF02).
- Emissão e renovação de tokens JWT (Access e Refresh).
- Fluxo de recuperação de senha via e-mail (RF16).
"""

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppException
from src.core.security import compute_lookup_hash, encrypt_sensitive_field, hash_password, validate_password_strength
from src.modules.users.models import EmergencyContact, User


class EmailAlreadyRegisteredException(AppException):
    def __init__(self):
        super().__init__(message="Este e-mail já está cadastrado.", code="EMAIL_ALREADY_REGISTERED", status_code=status.HTTP_409_CONFLICT)


async def register_user(session: AsyncSession, username: str, email: str, password: str, emergency_contacts: list[dict]) -> User:
    """Cadastra uma usuária com seus contatos de emergência"""

    validate_password_strength(password)

    email_lookup = compute_lookup_hash(email)
    if await session.scalar(select(User.id).where(User.email_lookup == email_lookup)) is not None:
        raise EmailAlreadyRegisteredException()
    
    user = User(username=username, email_encrypted=encrypt_sensitive_field(email), email_lookup=email_lookup, password_hash=hash_password(password))
    for contact in emergency_contacts:
        user.emergency_contacts.append(EmergencyContact(name=contact["name"], phone_encrypted=encrypt_sensitive_field(contact["phone"]), is_primary=contact["is_primary"]))
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise EmailAlreadyRegisteredException()
    return user