"""Segurança e transições do fluxo de recuperação de senha."""

import hashlib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.exceptions import UnauthorizedException
from src.core.security import hash_password, verify_password
from src.modules.auth.models import PasswordResetToken
from src.modules.auth.service import request_password_reset, reset_password
from src.modules.users.models import User


@pytest.mark.anyio
async def test_unknown_email_does_not_create_reset_token():
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = None
    assert await request_password_reset(session, "unknown@example.com") is None
    session.add.assert_not_called()
    session.commit.assert_not_awaited()


@pytest.mark.anyio
async def test_request_stores_only_hash_and_limits_token_lifetime():
    session = AsyncMock(spec=AsyncSession)
    user = User(id=uuid4())
    session.scalar.return_value = user
    before = datetime.now(UTC)
    token = await request_password_reset(session, "fixture@example.com")
    after = datetime.now(UTC)
    stored = session.add.call_args.args[0]
    assert stored.user_id == user.id
    assert stored.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert stored.token_hash != token
    assert (
        before + timedelta(minutes=15)
        <= stored.expires_at
        <= after + timedelta(minutes=15)
    )
    session.commit.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("state", ["missing", "expired", "missing_user"])
async def test_invalid_reset_never_changes_password(state):
    session = AsyncMock(spec=AsyncSession)
    stored = PasswordResetToken(
        id=uuid4(),
        user_id=uuid4(),
        used=False,
        expires_at=datetime.now(UTC)
        + timedelta(minutes=-1 if state == "expired" else 1),
    )
    session.scalar.return_value = None if state == "missing" else stored
    session.get.return_value = None
    with pytest.raises(UnauthorizedException):
        await reset_password(session, "fixture-token", "NovaSenha@123")
    session.commit.assert_not_awaited()
    session.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_success_changes_hash_and_prevents_token_reuse():
    session = AsyncMock(spec=AsyncSession)
    user = User(id=uuid4(), password_hash=hash_password("AntigaSenha@123"))
    stored = PasswordResetToken(
        id=uuid4(),
        user_id=user.id,
        used=False,
        expires_at=datetime.now(UTC) + timedelta(minutes=1),
    )
    session.scalar.return_value = stored
    session.get.return_value = user
    await reset_password(session, "fixture-token", "NovaSenha@123")
    assert verify_password("NovaSenha@123", user.password_hash)
    assert not verify_password("AntigaSenha@123", user.password_hash)
    assert stored.used is True
    session.commit.assert_awaited_once()
    with pytest.raises(UnauthorizedException):
        await reset_password(session, "fixture-token", "OutraSenha@123")
    session.commit.assert_awaited_once()
