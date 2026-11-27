"""Cadastro, login e validação de tokens de acesso."""

import math
from datetime import UTC, datetime, timedelta
from uuid import UUID

import hashlib
import secrets

from fastapi import status
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppException, UnauthorizedException
from src.core.security import (
    compute_lookup_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    encrypt_sensitive_field,
    hash_password,
    validate_password_strength,
    verify_password,
)
from src.modules.auth.models import LoginAttempt, PasswordResetToken
from src.modules.users.models import EmergencyContact, User


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

    if (
        await session.scalar(select(User.id).where(User.email_lookup == email_lookup))
        is not None
    ):
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

    user = await session.scalar(select(User).where(User.email_lookup == email_lookup))

    if user is None:
        raise UnauthorizedException("credenciais inválidas")

    return authenticate_credentials(
        str(user.id),
        password,
        user.password_hash,
    )


MAX_FAILED_ATTEMPTS = 5
LOGIN_WINDOW = timedelta(minutes=10)
PASSWORD_RESET_TOKEN_EXPIRE = timedelta(minutes=15)


async def login_with_rate_limit(
    session: AsyncSession,
    email: str,
    password: str,
    client_ip: str,
) -> dict[str, str]:
    """Autentica a usuária aplicando o limite de tentativas por IP."""

    now = datetime.now(UTC)

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
        .on_conflict_do_nothing(index_elements=[LoginAttempt.client_key])
    )

    # Bloqueia a linha durante a transação.
    attempt = await session.scalar(
        select(LoginAttempt)
        .where(LoginAttempt.client_key == client_key)
        .with_for_update()
    )

    # Atualiza o horário após adquirir o bloqueio da linha.
    now = datetime.now(UTC)

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


def validate_access_token_subject(token: str) -> UUID:
    """Valida credenciais; não substitui a consulta da conta pelo UUID retornado."""
    try:
        claims = decode_token(token)
        expires = claims.get("exp")
        if (
            claims.get("type") != "access"
            or type(expires) not in (int, float)
            or not math.isfinite(expires)
            or expires <= datetime.now(UTC).timestamp()
            or not isinstance(claims.get("sub"), str)
        ):
            raise UnauthorizedException()
        subject = UUID(claims["sub"])
        if subject.version != 4:
            raise UnauthorizedException()
        return subject
    except (ValueError, TypeError, OverflowError) as exc:
        raise UnauthorizedException("Token inválido ou expirado.") from exc

async def request_password_reset(
    session: AsyncSession,
    email: str,
) -> str | None:
    """
    Gera um token de recuperação de senha para uma usuária cadastrada.
    Retorna o token original para que ele possa ser enviado por e-mail.
    Retorna None caso o e-mail não esteja cadastrado.
    """

    email_lookup = compute_lookup_hash(email)

    user = await session.scalar(
        select(User).where(User.email_lookup == email_lookup)
    )

    if user is None:
        return None

    # Invalida tokens anteriores ainda não utilizados.
    await session.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id
        )
    )

    # Gera um token aleatório e criptograficamente seguro.
    token = secrets.token_urlsafe(32)

    # Armazena somente o hash do token no banco.
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + PASSWORD_RESET_TOKEN_EXPIRE,
    )

    session.add(reset_token)
    await session.commit()

    return token

async def reset_password(
    session: AsyncSession,
    token: str,
    new_password: str,
) -> None:
    """
    Valida o token de recuperação e atualiza a senha da usuária.
    """

    validate_password_strength(new_password)

    # Calcula o hash do token recebido.
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Busca e bloqueia o registro durante a operação.
    reset_token = await session.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_hash)
        .with_for_update()
    )

    if reset_token is None:
        raise UnauthorizedException("Token inválido ou expirado.")

    now = datetime.now(UTC)

    # Verifica se o token já foi utilizado ou expirou.
    if reset_token.used or reset_token.expires_at <= now:
        raise UnauthorizedException("Token inválido ou expirado.")

    # Busca a usuária associada ao token.
    user = await session.get(User, reset_token.user_id)

    if user is None:
        raise UnauthorizedException("Token inválido ou expirado.")

    # Atualiza a senha utilizando o mesmo mecanismo do cadastro.
    user.password_hash = hash_password(new_password)

    # Invalida o token utilizado.
    reset_token.used = True

    # Invalida também qualquer outro token de recuperação da usuária.
    await session.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != reset_token.id,
        )
    )

    await session.commit()


async def change_password(
    session: AsyncSession,
    user_id: UUID,
    current_password: str,
    new_password: str,
) -> None:
    """Altera a senha da usuária autenticada após confirmar a senha atual."""

    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None or not verify_password(current_password, user.password_hash):
        raise UnauthorizedException(message="Senha atual incorreta.")

    validate_password_strength(new_password)
    user.password_hash = hash_password(new_password)
    await session.commit()
