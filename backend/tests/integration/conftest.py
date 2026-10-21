import os
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.core.database import Base, get_db_session
from src.main import app
import src.modules.users.models  

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://protegela_user:protegela_secret_dev_pass@localhost:5432/protegela_test_db",
)

@pytest.fixture
async def test_db():
    """Banco de teste zerado a cada teste; a API passa a usá-lo no lugar do protegela_db."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def _get_test_session():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db_session] = _get_test_session
    yield TestSession
    app.dependency_overrides.clear()
    await engine.dispose()