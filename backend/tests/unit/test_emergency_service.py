from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.modules.emergency.service import POLICE_PHONE, resolve_call_target


@pytest.mark.anyio
async def test_returns_primary_contact_phone(monkeypatch):
    lookup = AsyncMock(return_value="11987654321")
    monkeypatch.setattr(
        "src.modules.emergency.service.get_primary_emergency_phone", lookup
    )
    session = AsyncMock()
    user_id = uuid4()

    assert await resolve_call_target(session, user_id) == "11987654321"
    lookup.assert_awaited_once_with(session, user_id)


@pytest.mark.anyio
async def test_returns_police_when_primary_contact_is_missing(monkeypatch):
    monkeypatch.setattr(
        "src.modules.emergency.service.get_primary_emergency_phone",
        AsyncMock(return_value=None),
    )
    assert await resolve_call_target(AsyncMock(), uuid4()) == POLICE_PHONE


@pytest.mark.anyio
async def test_lookup_failure_is_not_treated_as_missing(monkeypatch):
    lookup = AsyncMock(side_effect=RuntimeError("lookup failed"))
    monkeypatch.setattr(
        "src.modules.emergency.service.get_primary_emergency_phone", lookup
    )
    with pytest.raises(RuntimeError, match="lookup failed"):
        await resolve_call_target(AsyncMock(), uuid4())
