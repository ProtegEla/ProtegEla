import pytest
from httpx import AsyncClient
from src.core.security import decode_token
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from src.modules.auth.models import LoginAttempt
import asyncio
from src.core.exceptions import UnauthorizedException
from src.modules.auth.service import (
    RateLimitExceededException,
    login_with_rate_limit,
)

@pytest.mark.anyio
async def test_login_valido(async_client: AsyncClient, test_db):

    # Primeiro, cadastramos uma usuária.
    cadastro = {
        "username": "maria",
        "email": "maria@email.com",
        "password": "Senha@123",
        "emergency_contacts": [
            {
                "name": "Ana",
                "phone": "11987654321",
                "is_primary": True
            }
        ]
    }

    response = await async_client.post(
        "/api/v1/auth/register",
        json=cadastro
    )

    assert response.status_code == 201

    user_id = response.json()["id"]

    # Agora tentamos fazer login.
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": "maria@email.com",
            "password": "Senha@123"
        }
    )

    assert response.status_code == 200

    tokens = response.json()

    assert tokens["token_type"] == "bearer"
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    # Verificamos se o token pertence à usuária cadastrada.
    access = decode_token(tokens["access_token"])

    assert access["sub"] == user_id
    assert access["type"] == "access"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "email, password",
    [
        ("maria@email.com", "SenhaErrada@123"),
        ("inexistente@email.com", "Senha@123"),
    ],
    ids=["senha_incorreta", "email_inexistente"],
)
async def test_login_credenciais_invalidas(
    async_client: AsyncClient,
    test_db,
    email,
    password,
):
    # Cadastramos uma usuária para realizar os testes.
    cadastro = {
        "username": "maria",
        "email": "maria@email.com",
        "password": "Senha@123",
        "emergency_contacts": [
            {
                "name": "Ana",
                "phone": "11987654321",
                "is_primary": True
            }
        ]
    }

    response = await async_client.post(
        "/api/v1/auth/register",
        json=cadastro
    )

    assert response.status_code == 201

    # Tentamos fazer login com credenciais inválidas.
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert response.json()["error"]["message"] == "credenciais inválidas"

@pytest.mark.anyio
async def test_login_bloqueia_apos_cinco_tentativas(
    async_client: AsyncClient,
    test_db,
):
    credenciais = {
        "email": "inexistente@email.com",
        "password": "SenhaErrada@123",
    }

    # As primeiras cinco tentativas são rejeitadas.
    for _ in range(5):
        response = await async_client.post(
            "/api/v1/auth/login",
            json=credenciais,
        )

        assert response.status_code == 401

    # A sexta tentativa deve ser bloqueada.
    response = await async_client.post(
        "/api/v1/auth/login",
        json=credenciais,
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"

@pytest.mark.anyio
async def test_login_valido_zera_tentativas(
    async_client: AsyncClient,
    test_db,
):
    cadastro = {
        "username": "maria",
        "email": "maria@email.com",
        "password": "Senha@123",
        "emergency_contacts": [
            {
                "name": "Ana",
                "phone": "11987654321",
                "is_primary": True,
            }
        ],
    }

    response = await async_client.post(
        "/api/v1/auth/register",
        json=cadastro,
    )
    assert response.status_code == 201

    # Quatro tentativas com senha incorreta.
    for _ in range(4):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": "maria@email.com",
                "password": "SenhaErrada@123",
            },
        )
        assert response.status_code == 401

    # Login correto deve zerar o contador.
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": "maria@email.com",
            "password": "Senha@123",
        },
    )
    assert response.status_code == 200

    # Após o login válido, cinco novas tentativas são permitidas.
    for _ in range(5):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": "maria@email.com",
                "password": "SenhaErrada@123",
            },
        )
        assert response.status_code == 401

    # A sexta tentativa deve ser bloqueada.
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": "maria@email.com",
            "password": "SenhaErrada@123",
        },
    )
    assert response.status_code == 429

@pytest.mark.anyio
async def test_login_permite_tentativa_apos_bloqueio_expirar(
    async_client: AsyncClient,
    test_db,
):
    credenciais = {
        "email": "inexistente@email.com",
        "password": "SenhaErrada@123",
    }

    # Cinco tentativas inválidas.
    for _ in range(5):
        response = await async_client.post(
            "/api/v1/auth/login",
            json=credenciais,
        )

        assert response.status_code == 401

    # A sexta tentativa deve ser bloqueada.
    response = await async_client.post(
        "/api/v1/auth/login",
        json=credenciais,
    )

    assert response.status_code == 429

    # Simulamos a expiração do bloqueio no banco de testes.
    async with test_db() as session:
        attempt = await session.scalar(select(LoginAttempt))

        assert attempt is not None
        assert attempt.blocked_until is not None

        attempt.blocked_until = (
            datetime.now(timezone.utc) - timedelta(seconds=1)
        )

        await session.commit()

    # Após a expiração, uma nova tentativa deve ser permitida.
    response = await async_client.post(
        "/api/v1/auth/login",
        json=credenciais,
    )

    assert response.status_code == 401

@pytest.mark.anyio
async def test_login_tentativas_simultaneas(
    async_client: AsyncClient,
    test_db,
):
    credenciais = {
        "email": "inexistente@email.com",
        "password": "SenhaErrada@123",
    }

    # Registramos quatro tentativas inválidas.
    for _ in range(4):
        response = await async_client.post(
            "/api/v1/auth/login",
            json=credenciais,
        )
        assert response.status_code == 401

    # Enviamos duas tentativas simultaneamente.
    responses = await asyncio.gather(
        async_client.post("/api/v1/auth/login", json=credenciais),
        async_client.post("/api/v1/auth/login", json=credenciais),
    )

    status_codes = sorted(response.status_code for response in responses)

    # A quinta tentativa deve retornar 401.
    # A sexta deve encontrar o bloqueio ativo e retornar 429.
    assert status_codes == [401, 429]

@pytest.mark.anyio
async def test_rate_limit_independente_por_ip(test_db):

    async def tentar_login(ip):
        async with test_db() as session:
            return await login_with_rate_limit(
                session,
                email="inexistente@email.com",
                password="SenhaErrada@123",
                client_ip=ip,
            )

    # Cinco tentativas inválidas do primeiro IP.
    for _ in range(5):
        with pytest.raises(UnauthorizedException):
            await tentar_login("192.0.2.10")

    # O primeiro IP deve estar bloqueado.
    with pytest.raises(RateLimitExceededException):
        await tentar_login("192.0.2.10")

    # Um IP diferente ainda pode tentar fazer login.
    with pytest.raises(UnauthorizedException):
        await tentar_login("192.0.2.11")
