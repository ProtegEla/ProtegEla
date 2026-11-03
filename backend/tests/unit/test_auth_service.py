import pytest
from src.core.security import hash_password, decode_token
from src.core.exceptions import UnauthorizedException
from src.modules.auth.service import authenticate_credentials, login_user
from types import SimpleNamespace
from unittest.mock import AsyncMock
import uuid

def test_login_senha_correta():
    password_hash = hash_password("senha1234")

    tokens = authenticate_credentials(
        "usuarioTeste",
        "senha1234",
        password_hash,
    )

    access = decode_token(tokens["access_token"])
    refresh = decode_token(tokens["refresh_token"])

    assert tokens["token_type"] == "bearer"
    assert access["sub"] == "usuarioTeste"
    assert access["type"] == "access"
    assert refresh["type"] == "refresh"


def test_login_senha_incorreta():
    password_hash = hash_password("senha1234")

    with pytest.raises(
        UnauthorizedException,
        match="credenciais inválidas",
    ):
        authenticate_credentials(
            "usuario-teste",
            "senhaFalsa",
            password_hash,
        )

@pytest.mark.asyncio
async def test_login_user_sucesso():
    user = SimpleNamespace(
        id=uuid.uuid4(),
        password_hash=hash_password("Senha123!")
    )

    session = AsyncMock()
    session.scalar.return_value = user

    tokens = await login_user(
        session,
        "teste@email.com",
        "Senha123!"
    )

    access = decode_token(tokens["access_token"])

    assert access["sub"] == str(user.id)
    assert tokens["token_type"] == "bearer"
    session.scalar.assert_awaited_once()

@pytest.mark.asyncio
async def test_login_user_email_inexistente():
    session = AsyncMock()
    session.scalar.return_value = None

    with pytest.raises(
        UnauthorizedException,
        match="credenciais inválidas"
    ):
        await login_user(
            session,
            "inexistente@email.com",
            "Senha123!"
        )

@pytest.mark.asyncio
async def test_login_user_senha_incorreta():
    user = SimpleNamespace(
        id=uuid.uuid4(),
        password_hash=hash_password("Senha123!")
    )

    session = AsyncMock()
    session.scalar.return_value = user

    with pytest.raises(
        UnauthorizedException,
        match="credenciais inválidas"
    ):
        await login_user(
            session,
            "teste@email.com",
            "SenhaErrada"
        )