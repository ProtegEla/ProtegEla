"""Cadastro e login reais autorizam relatos e interações, sem substituir identidade."""

from uuid import uuid4

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from src.core.security import create_access_token, create_refresh_token
from src.modules.reports.models import Report, ReportInteraction
from src.modules.users.models import User


async def register_and_login(client, email):
    registration = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "maria",
            "email": email,
            "password": "Senha@123",
            "emergency_contacts": [
                {"name": "Ana", "phone": "11987654321", "is_primary": True}
            ],
        },
    )
    assert registration.status_code == 201
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": "Senha@123",
        },
    )
    assert login.status_code == 200
    return registration.json()["id"], login.json()["access_token"]


@pytest.mark.anyio
async def test_registration_login_and_report_interactions(async_client, test_db):
    author, author_token = await register_and_login(async_client, "author@example.com")
    reader, reader_token = await register_and_login(async_client, "reader@example.com")
    _, other_token = await register_and_login(async_client, "other@example.com")
    payload = {
        "location": {"latitude": -23.55, "longitude": -46.63},
        "category": "Furto",
        "incident_date": "2000-01-01",
        "incident_period": "noite",
        "is_anonymous": True,
    }
    response = await async_client.post(
        "/api/v1/reports",
        json=payload,
        headers={
            "Authorization": f"Bearer {author_token}",
            "X-Device-Id": str(uuid4()),
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert "author_id" not in data
    report_id = data["id"]
    url = f"/api/v1/reports/{report_id}"
    async with test_db() as session:
        report = await session.scalar(select(Report))
        assert str(report.author_id) == author
    for action in ("confirm", "report-abuse"):
        forbidden = await async_client.post(
            f"{url}/{action}",
            json={},
            headers={
                "Authorization": f"Bearer {author_token}",
            },
        )
        assert forbidden.status_code == 403
    for _ in range(2):
        confirmed = await async_client.post(
            f"{url}/confirm",
            json={},
            headers={
                "Authorization": f"Bearer {reader_token}",
            },
        )
        assert confirmed.status_code == 200
    conflict = await async_client.post(
        f"{url}/report-abuse",
        json={},
        headers={
            "Authorization": f"Bearer {reader_token}",
        },
    )
    assert conflict.status_code == 409
    details = await async_client.get(url)
    assert details.json()["data"]["confirmations_count"] == 1
    assert "author_id" not in details.json()["data"]
    async with test_db() as session:
        interaction = await session.scalar(select(ReportInteraction))
        assert str(interaction.user_id) == reader
        # Neither authors nor interacting accounts may be deleted implicitly.
        for user_id in (report.author_id, interaction.user_id):
            with pytest.raises(IntegrityError):
                async with session.begin_nested():
                    await session.execute(delete(User).where(User.id == user_id))
    abused = await async_client.post(
        f"{url}/report-abuse",
        json={},
        headers={
            "Authorization": f"Bearer {other_token}",
        },
    )
    assert abused.status_code == 200
    assert (await async_client.get(url)).status_code == 404
    assert (
        await async_client.post(
            f"{url}/confirm",
            json={},
            headers={
                "Authorization": f"Bearer {reader_token}",
            },
        )
    ).status_code == 404


@pytest.mark.anyio
@pytest.mark.parametrize("token_factory", [create_access_token, create_refresh_token])
async def test_nonexistent_account_or_refresh_token_cannot_write(
    async_client,
    test_db,
    token_factory,
):
    token = token_factory(str(uuid4()))
    for suffix in ("confirm", "report-abuse"):
        response = await async_client.post(
            f"/api/v1/reports/{uuid4()}/{suffix}",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"
    creation = await async_client.post(
        "/api/v1/reports",
        json={
            "location": {"latitude": -23.55, "longitude": -46.63},
            "category": "Furto",
            "incident_date": "2000-01-01",
            "incident_period": "noite",
            "is_anonymous": True,
        },
        headers={"Authorization": f"Bearer {token}", "X-Device-Id": str(uuid4())},
    )
    assert creation.status_code == 401
    async with test_db() as session:
        assert await session.scalar(select(Report.id)) is None
        assert await session.scalar(select(ReportInteraction.id)) is None
