import asyncio
from datetime import timedelta
from uuid import uuid4

import pytest
from conftest import new_user
from sqlalchemy import delete, func, select
from src.core.security import (
    create_access_token,
    create_refresh_token,
    encrypt_sensitive_field,
)
from src.modules.history.models import HistoryEntry
from src.modules.history.schemas import SearchCreate
from src.modules.history.service import HistoryService, purge_expired
from src.modules.users.models import User

SEARCH = "/api/v1/users/me/search-history"
ROUTES = "/api/v1/users/me/route-history"
SUMMARY = {
    "origin_label": " Localização atual ",
    "destination_label": " Paulista ",
    "stop_labels": [" Praça "],
    "distance_m": 1000,
    "duration_s": 700,
}


@pytest.fixture
async def history_users(test_db):
    owner, other = new_user(), new_user()
    async with test_db() as session:
        session.add_all([owner, other])
        await session.commit()
    return owner, other


def headers(user):
    return {"Authorization": "Bearer " + create_access_token(str(user.id))}


@pytest.mark.anyio
@pytest.mark.parametrize(
    "path,payload", [(SEARCH, {"label": " Paulista "}), (ROUTES, SUMMARY)]
)
async def test_history_roundtrip_is_private_and_encrypted(
    async_client, test_db, history_users, path, payload
):
    owner, other = history_users
    response = await async_client.post(path, json=payload, headers=headers(owner))
    assert response.status_code == 201
    assert response.headers["cache-control"] == "no-store"
    record = response.json()["data"]
    assert "user_id" not in record
    assert record["created_at"].endswith("Z")
    if path == SEARCH:
        assert record["label"] == "Paulista"
    else:
        assert record["origin_label"] == "Localização atual"
        assert record["stop_labels"] == ["Praça"]
    async with test_db() as session:
        stored = (await session.scalars(select(HistoryEntry))).one()
        assert "Paulista" not in stored.payload_encrypted
        assert stored.payload_encrypted.startswith("gAAAA")
    own = await async_client.get(path, headers=headers(owner))
    assert own.json()["data"] == [record]
    assert own.json()["meta"]["total_records"] == 1
    assert own.headers["cache-control"] == "no-store"
    assert (await async_client.get(path, headers=headers(other))).json()["data"] == []
    assert (await async_client.delete(path, headers=headers(other))).status_code == 204
    assert (await async_client.get(path, headers=headers(owner))).json()["meta"][
        "total_records"
    ] == 1
    cleared = await async_client.delete(path, headers=headers(owner))
    assert cleared.status_code == 204 and cleared.content == b""
    assert cleared.headers["cache-control"] == "no-store"
    assert (await async_client.get(path, headers=headers(owner))).json()["data"] == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("get", SEARCH, None),
        ("post", SEARCH, {"label": "A"}),
        ("delete", SEARCH, None),
        ("get", ROUTES, None),
        ("post", ROUTES, SUMMARY),
        ("delete", ROUTES, None),
    ],
)
async def test_history_requires_authentication(async_client, method, path, payload):
    response = await async_client.request(
        method, path, **({"json": payload} if payload else {})
    )
    assert response.status_code == 401


@pytest.mark.anyio
async def test_missing_account_and_refresh_token_are_rejected(
    async_client, test_db, history_users
):
    owner, _ = history_users
    for token in [
        create_access_token(str(uuid4())),
        create_refresh_token(str(owner.id)),
    ]:
        response = await async_client.get(
            SEARCH, headers={"Authorization": "Bearer " + token}
        )
        assert response.status_code == 401


@pytest.mark.anyio
async def test_limits_ordering_expiration_and_list_independence(
    async_client, test_db, history_users
):
    owner, _other = history_users
    async with test_db() as session:
        now = await session.scalar(select(func.clock_timestamp()))
        encrypted = encrypt_sensitive_field('{"label":"Antiga"}')
        entries = [
            HistoryEntry(
                user_id=owner.id,
                kind="search",
                payload_encrypted=encrypted,
                created_at=now - timedelta(seconds=i),
            )
            for i in range(101)
        ]
        expired = HistoryEntry(
            user_id=owner.id,
            kind="search",
            payload_encrypted=encrypted,
            created_at=now - timedelta(days=30),
        )
        session.add_all([*entries, expired])
        await session.commit()
    created = await async_client.post(
        SEARCH, json={"label": "Nova"}, headers=headers(owner)
    )
    assert created.status_code == 201
    page = await async_client.get(
        SEARCH, params={"page_size": 1}, headers=headers(owner)
    )
    assert page.json()["meta"]["total_records"] == 100
    assert page.json()["data"][0]["label"] == "Nova"
    missing = await async_client.get(
        SEARCH, params={"page": 101, "page_size": 1}, headers=headers(owner)
    )
    assert (
        missing.json()["data"] == [] and missing.json()["meta"]["total_records"] == 100
    )
    await async_client.post(ROUTES, json=SUMMARY, headers=headers(owner))
    await async_client.delete(SEARCH, headers=headers(owner))
    assert (await async_client.get(ROUTES, headers=headers(owner))).json()["meta"][
        "total_records"
    ] == 1
    async with test_db() as session:
        assert await session.get(HistoryEntry, expired.id) is None
        await session.execute(delete(User).where(User.id == owner.id))
        await session.commit()
        assert await session.scalar(select(func.count()).select_from(HistoryEntry)) == 0


@pytest.mark.anyio
async def test_cleanup_physically_deletes_only_expired_data(test_db, history_users):
    owner, other = history_users
    async with test_db() as session:
        now = await session.scalar(select(func.clock_timestamp()))
        encrypted = encrypt_sensitive_field('{"label":"A"}')
        session.add_all(
            [
                HistoryEntry(
                    user_id=owner.id,
                    kind="search",
                    payload_encrypted=encrypted,
                    created_at=now - timedelta(days=31),
                ),
                HistoryEntry(
                    user_id=other.id,
                    kind="search",
                    payload_encrypted=encrypted,
                    created_at=now,
                ),
            ]
        )
        await session.commit()
        assert await purge_expired(session) == 1
        await session.commit()
        remaining = (await session.scalars(select(HistoryEntry))).one()
        assert remaining.user_id == other.id


@pytest.mark.anyio
async def test_concurrent_creations_respect_cap(test_db, history_users):
    owner, _ = history_users
    async with test_db() as session:
        now = await session.scalar(select(func.clock_timestamp()))
        encrypted = encrypt_sensitive_field('{"label":"A"}')
        session.add_all(
            [
                HistoryEntry(
                    user_id=owner.id,
                    kind="search",
                    payload_encrypted=encrypted,
                    created_at=now,
                )
                for _ in range(99)
            ]
        )
        await session.commit()

    async def create_one(index):
        async with test_db() as session:
            return await HistoryService(session).create(
                owner.id, SearchCreate(label=f"Nova {index}")
            )

    await asyncio.gather(*(create_one(i) for i in range(8)))
    async with test_db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(HistoryEntry)) == 100
        )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "payload",
    [
        {"label": " "},
        {"label": "a" * 301},
        {"label": "A", "user_id": str(uuid4())},
        {"label": "A", "latitude": -23.5},
    ],
)
async def test_history_rejects_invalid_or_unapproved_fields(
    async_client, history_users, payload
):
    owner, _ = history_users
    response = await async_client.post(SEARCH, json=payload, headers=headers(owner))
    assert response.status_code == 422


@pytest.mark.anyio
async def test_read_removes_expired_entries_and_orders_ties(
    async_client, test_db, history_users
):
    owner, _ = history_users
    async with test_db() as session:
        now = await session.scalar(select(func.clock_timestamp()))
        encrypted = encrypt_sensitive_field('{"label":"A"}')
        fresh = [
            HistoryEntry(
                id=uuid4(),
                user_id=owner.id,
                kind="search",
                payload_encrypted=encrypted,
                created_at=now,
            )
            for _ in range(3)
        ]
        expired = HistoryEntry(
            id=uuid4(),
            user_id=owner.id,
            kind="search",
            payload_encrypted=encrypted,
            created_at=now - timedelta(days=30),
        )
        session.add_all([*fresh, expired])
        await session.commit()
    page = await async_client.get(
        SEARCH, params={"page_size": 2}, headers=headers(owner)
    )
    assert page.status_code == 200
    assert [row["id"] for row in page.json()["data"]] == [
        str(row.id) for row in sorted(fresh, key=lambda row: row.id, reverse=True)[:2]
    ]
    assert page.json()["meta"]["total_records"] == 3
    async with test_db() as session:
        assert await session.get(HistoryEntry, expired.id) is None


@pytest.mark.anyio
@pytest.mark.parametrize("params", [{"page": 0}, {"page_size": 101}, {"page_size": 0}])
async def test_invalid_history_pagination(async_client, history_users, params):
    owner, _ = history_users
    response = await async_client.get(SEARCH, params=params, headers=headers(owner))
    assert response.status_code == 422


@pytest.mark.anyio
async def test_corrupted_ciphertext_returns_generic_error_without_data(
    async_client, test_db, history_users
):
    owner, _ = history_users
    async with test_db() as session:
        session.add(
            HistoryEntry(user_id=owner.id, kind="search", payload_encrypted="corrupt")
        )
        await session.commit()
    from httpx import ASGITransport, AsyncClient
    from src.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.get(SEARCH, headers=headers(owner))
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert "corrupt" not in response.text
