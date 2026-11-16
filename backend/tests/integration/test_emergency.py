from datetime import UTC, datetime, timedelta

import pytest
from conftest import new_user
from httpx import ASGITransport, AsyncClient
from jose import jwt

from src.core.config import settings
from src.core.security import (
    create_access_token,
    create_refresh_token,
    encrypt_sensitive_field,
)
from src.main import app
from src.modules.users.models import EmergencyContact

URL = "/api/v1/emergency/call-target"


def authorization(user_id) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(str(user_id))}


@pytest.mark.anyio
async def test_returns_only_authenticated_users_primary_contact(async_client, test_db):
    owner, other = new_user(), new_user()
    async with test_db() as session:
        session.add_all([owner, other])
        await session.flush()
        session.add_all(
            [
                EmergencyContact(
                    user_id=owner.id,
                    name="Principal",
                    phone_encrypted=encrypt_sensitive_field("11987654321"),
                    is_primary=True,
                ),
                EmergencyContact(
                    user_id=owner.id,
                    name="Secundário",
                    phone_encrypted=encrypt_sensitive_field("11911112222"),
                    is_primary=False,
                ),
                EmergencyContact(
                    user_id=other.id,
                    name="Outro contato",
                    phone_encrypted=encrypt_sensitive_field("11999990000"),
                    is_primary=True,
                ),
            ]
        )
        await session.commit()

    response = await async_client.get(
        URL,
        headers=authorization(owner.id),
        params={"user_id": str(other.id)},
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"data": {"phone": "11987654321"}}


@pytest.mark.anyio
async def test_returns_police_when_user_has_no_primary_contact(async_client, test_db):
    user = new_user()
    async with test_db() as session:
        session.add(user)
        await session.commit()

    response = await async_client.get(URL, headers=authorization(user.id))

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"data": {"phone": "190"}}


@pytest.mark.anyio
async def test_rejects_missing_invalid_expired_and_refresh_tokens(
    async_client, test_db
):
    user = new_user()
    async with test_db() as session:
        session.add(user)
        await session.commit()
    expired = jwt.encode(
        {
            "sub": str(user.id),
            "type": "access",
            "exp": datetime.now(UTC) - timedelta(minutes=1),
        },
        settings.APP_SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    tokens = [None, "invalid", expired, create_refresh_token(str(user.id))]

    for token in tokens:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = await async_client.get(URL, headers=headers)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.anyio
async def test_decryption_failure_returns_internal_error(async_client, test_db):
    user = new_user()
    async with test_db() as session:
        session.add(user)
        await session.flush()
        session.add(
            EmergencyContact(
                user_id=user.id,
                name="Principal",
                phone_encrypted="invalid-encrypted-phone",
                is_primary=True,
            )
        )
        await session.commit()

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(URL, headers=authorization(user.id))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"
