"""Consulta de conta obrigatória após a validação do token."""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from cryptography.fernet import InvalidToken
from sqlalchemy.dialects import postgresql

from src.core.exceptions import UnauthorizedException
from src.core.security import encrypt_sensitive_field
from src.modules.users.service import get_primary_emergency_phone, require_user


@pytest.mark.anyio
async def test_existing_account_is_accepted():
    user_id = uuid4()
    session = AsyncMock()
    session.scalar.return_value = user_id
    await require_user(session, user_id)
    statement = session.scalar.await_args.args[0]
    assert statement.compile().params == {"id_1": user_id}


@pytest.mark.anyio
async def test_missing_account_is_rejected():
    session = AsyncMock()
    session.scalar.return_value = None
    with pytest.raises(UnauthorizedException):
        await require_user(session, uuid4())


@pytest.mark.anyio
async def test_primary_emergency_phone_is_selected_and_decrypted():
    user_id = uuid4()
    session = AsyncMock()
    session.scalar.return_value = encrypt_sensitive_field("11987654321")

    assert await get_primary_emergency_phone(session, user_id) == "11987654321"

    statement = session.scalar.await_args.args[0]
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "emergency_contacts.user_id =" in sql
    assert "emergency_contacts.is_primary IS true" in sql
    assert statement.compile().params["user_id_1"] == user_id


@pytest.mark.anyio
async def test_missing_primary_emergency_phone_returns_none():
    session = AsyncMock()
    session.scalar.return_value = None
    assert await get_primary_emergency_phone(session, uuid4()) is None


@pytest.mark.anyio
async def test_invalid_encrypted_phone_is_not_treated_as_missing():
    session = AsyncMock()
    session.scalar.return_value = "invalid-encrypted-phone"
    with pytest.raises(InvalidToken):
        await get_primary_emergency_phone(session, uuid4())
