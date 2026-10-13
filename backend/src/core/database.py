from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from src.core.config import settings

# Engine assíncrona do SQLAlchemy conectada ao PostgreSQL via asyncpg
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
)

# Fábrica de sessões assíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# Base declarativa para todos os modelos ORM da aplicação
Base = declarative_base()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Injeção de dependência FastAPI para obter sessão do banco de dados por requisição."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
