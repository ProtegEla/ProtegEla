"""Consulta de conta obrigatória após a validação do token."""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from src.core.exceptions import UnauthorizedException
from src.modules.users.service import require_user


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
