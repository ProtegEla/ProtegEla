from datetime import UTC, datetime, timedelta
from smtplib import SMTPException
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db_session
from src.main import app
from src.modules.auth import router as auth_router
from src.modules.auth.models import PasswordResetToken
from src.modules.users.models import User


@pytest.fixture
def session(monkeypatch):
    session = AsyncMock(spec=AsyncSession)

    async def override_session():
        yield session

    monkeypatch.setitem(app.dependency_overrides, get_db_session, override_session)
    return session


@pytest.mark.anyio
async def test_forgot_password_keeps_response_generic_on_smtp_failure(
    async_client, session, monkeypatch, caplog
):
    send_email = AsyncMock(side_effect=SMTPException("SMTP indisponível"))
    monkeypatch.setattr(auth_router, "send_password_reset_email", send_email)
    email = "recuperacao@example.com"
    endpoint = "/api/v1/auth/forgot-password"

    session.scalar.return_value = None
    unknown = await async_client.post(endpoint, json={"email": email})
    assert unknown.status_code == 200
    send_email.assert_not_awaited()
    session.commit.assert_not_awaited()

    user = User(id=uuid4())
    session.scalar.return_value = user
    failed_delivery = await async_client.post(endpoint, json={"email": email})

    assert failed_delivery.status_code == 200
    assert failed_delivery.json() == unknown.json()
    session.commit.assert_awaited_once()
    send_email.assert_awaited_once()
    assert send_email.await_args.kwargs["recipient"] == email
    assert "Falha no envio do e-mail de recuperação de senha." in caplog.text


@pytest.mark.anyio
async def test_reset_password_rejects_expired_token(async_client, session):
    session.scalar.return_value = PasswordResetToken(
        user_id=uuid4(),
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
        used=False,
    )

    response = await async_client.post(
        "/api/v1/auth/reset-password",
        json={"token": "token-expirado", "new_password": "NovaSenha@123"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Token inválido ou expirado."
    session.get.assert_not_awaited()
    session.commit.assert_not_awaited()


@pytest.mark.anyio
async def test_reset_roundtrip_invalidates_previous_tokens_and_old_password(
    async_client, test_db
):
    from sqlalchemy import select
    from src.core.security import compute_lookup_hash, verify_password
    from src.modules.auth.service import request_password_reset

    email = "reset-roundtrip@example.com"
    created = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "reset-fixture",
            "email": email,
            "password": "AntigaSenha@123",
            "emergency_contacts": [
                {"name": "Contato", "phone": "11987654321", "is_primary": True}
            ],
        },
    )
    assert created.status_code == 201
    async with test_db() as db:
        previous = await request_password_reset(db, email)
        current = await request_password_reset(db, email)
        stored = (await db.scalars(select(PasswordResetToken))).all()
        assert len(stored) == 1
        assert current != stored[0].token_hash

    endpoint = "/api/v1/auth/reset-password"
    invalidated = await async_client.post(
        endpoint,
        json={
            "token": previous,
            "new_password": "NovaSenha@123",
        },
    )
    assert invalidated.status_code == 401
    changed = await async_client.post(
        endpoint,
        json={
            "token": current,
            "new_password": "NovaSenha@123",
        },
    )
    assert changed.status_code == 200
    reused = await async_client.post(
        endpoint,
        json={
            "token": current,
            "new_password": "OutraSenha@123",
        },
    )
    assert reused.status_code == 401
    async with test_db() as db:
        user = await db.scalar(
            select(User).where(User.email_lookup == compute_lookup_hash(email))
        )
        assert verify_password("NovaSenha@123", user.password_hash)
        assert not verify_password("AntigaSenha@123", user.password_hash)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "body,code",
    [
        ({}, "VALIDATION_ERROR"),
        ({"token": "", "new_password": "NovaSenha@123"}, "VALIDATION_ERROR"),
        (
            {"token": "fixture", "new_password": "sem-complexidade"},
            "PASSWORD_MISSING_UPPERCASE",
        ),
    ],
)
async def test_invalid_reset_payload_does_not_write(async_client, session, body, code):
    response = await async_client.post("/api/v1/auth/reset-password", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code
    session.commit.assert_not_awaited()
