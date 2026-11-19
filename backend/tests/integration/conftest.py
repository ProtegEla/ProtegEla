"""Bancos e dados de teste explícitos, isolados do banco de desenvolvimento."""

import os
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from src.core.database import Base, get_db_session
from src.main import app
from src.modules.users.models import User


def new_user(user_id=None) -> User:
    user_id = user_id or uuid4()
    return User(
        id=user_id,
        username="teste",
        email_encrypted="fixture",
        email_lookup=user_id.hex,
        password_hash="fixture",
    )


@pytest.fixture
async def test_db():
    database_url = os.getenv("TEST_DATABASE_URL") or os.getenv("TEST_DATABASE_SYNC_URL")
    if not database_url:
        pytest.skip("Defina TEST_DATABASE_URL para testar PostgreSQL/PostGIS")
    url = make_url(database_url)
    if not url.database or not url.database.endswith("_test"):
        pytest.fail("Os testes exigem um banco terminado em _test")
    schema = "test_" + uuid4().hex
    engine = create_async_engine(
        url.set(drivername="postgresql+asyncpg"),
        poolclass=NullPool,
        connect_args={"server_settings": {"search_path": f"{schema},public"}},
    )
    previous = app.dependency_overrides.copy()
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
            await conn.run_sync(
                lambda sync: Base.metadata.create_all(sync, checkfirst=False)
            )
        sessions = async_sessionmaker(engine, expire_on_commit=False)

        async def override_session():
            async with sessions() as session:
                yield session

        app.dependency_overrides[get_db_session] = override_session
        yield sessions
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        async with engine.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        await engine.dispose()
