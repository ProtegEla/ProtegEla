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
from src.modules.users.models import EmergencyContact, User
from datetime import datetime, timedelta, timezone
from sqlalchemy.dialects.postgresql import insert
from src.modules.auth.models import LoginAttempt
from src.core.exceptions import AppException, UnauthorizedException
from src.core.security import (
    compute_lookup_hash,
    create_access_token,
    create_refresh_token,
    encrypt_sensitive_field,
    hash_password,
    validate_password_strength,
    verify_password,
)


class EmailAlreadyRegisteredException(AppException):
    def __init__(self):
        super().__init__(
            message="Este e-mail já está cadastrado.",
            code="EMAIL_ALREADY_REGISTERED",
            status_code=status.HTTP_409_CONFLICT,
        )

class RateLimitExceededException(AppException):
    def __init__(self):
        super().__init__(
            message="Muitas tentativas de login. Tente novamente mais tarde.",
            code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

async def register_user(
    session: AsyncSession,
    username: str,
    email: str,
    password: str,
    emergency_contacts: list[dict],
) -> User:
    """Cadastra uma usuária com seus contatos de emergência."""

    validate_password_strength(password)

    email_lookup = compute_lookup_hash(email)

    if await session.scalar(
        select(User.id).where(User.email_lookup == email_lookup)
    ) is not None:
        raise EmailAlreadyRegisteredException()

    user = User(
        username=username,
        email_encrypted=encrypt_sensitive_field(email),
        email_lookup=email_lookup,
        password_hash=hash_password(password),
    )

    for contact in emergency_contacts:
        user.emergency_contacts.append(
            EmergencyContact(
                name=contact["name"],
                phone_encrypted=encrypt_sensitive_field(contact["phone"]),
                is_primary=contact["is_primary"],
            )
        )

    session.add(user)

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise EmailAlreadyRegisteredException()

    return user


def authenticate_credentials(
    user_id: str,
    password: str,
    password_hash: str,
) -> dict[str, str]:
    """Verifica as credenciais e gera os tokens de autenticação."""

    if not verify_password(password, password_hash):
        raise UnauthorizedException("credenciais inválidas")

    return {
        "access_token": create_access_token(user_id),
        "refresh_token": create_refresh_token(user_id),
        "token_type": "bearer",
    }

async def login_user(
    session: AsyncSession,
    email: str,
    password: str,
) -> dict[str, str]:
    """Autentica uma usuária cadastrada."""

    email_lookup = compute_lookup_hash(email)

    user = await session.scalar(
        select(User).where(User.email_lookup == email_lookup)
    )

    if user is None:
        raise UnauthorizedException("credenciais inválidas")

    return authenticate_credentials(
        str(user.id),
        password,
        user.password_hash,
    )

MAX_FAILED_ATTEMPTS = 5
LOGIN_WINDOW = timedelta(minutes=10)


async def login_with_rate_limit(
    session: AsyncSession,
    email: str,
    password: str,
    client_ip: str,
) -> dict[str, str]:
    """Autentica a usuária aplicando o limite de tentativas por IP."""

    now = datetime.now(timezone.utc)

    # Não armazenamos o endereço IP diretamente.
    client_key = compute_lookup_hash(f"login_ip:{client_ip}")

    # Garante que existe um registro para o cliente.
    await session.execute(
        insert(LoginAttempt)
        .values(
            client_key=client_key,
            failed_attempts=0,
            window_started_at=now,
        )
        .on_conflict_do_nothing(
            index_elements=[LoginAttempt.client_key]
        )
    )

    # Bloqueia a linha durante a transação.
    attempt = await session.scalar(
        select(LoginAttempt)
        .where(LoginAttempt.client_key == client_key)
        .with_for_update()
    )

    # Atualiza o horário após adquirir o bloqueio da linha.
    now = datetime.now(timezone.utc)

    # Verifica se o cliente está bloqueado.
    if attempt.blocked_until and attempt.blocked_until > now:
        await session.rollback()
        raise RateLimitExceededException()

    # Reinicia a contagem quando a janela expira.
    if (
        now - attempt.window_started_at >= LOGIN_WINDOW
        or attempt.blocked_until is not None
    ):
        attempt.failed_attempts = 0
        attempt.window_started_at = now
        attempt.blocked_until = None

    try:
        tokens = await login_user(session, email, password)

    except UnauthorizedException:
        attempt.failed_attempts += 1

        if attempt.failed_attempts >= MAX_FAILED_ATTEMPTS:
            attempt.blocked_until = now + LOGIN_WINDOW

        # Salva a tentativa antes de retornar o erro.
        await session.commit()
        raise

    # Login válido: remove o histórico de tentativas.
    await session.delete(attempt)
    await session.commit()

    return tokens