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
