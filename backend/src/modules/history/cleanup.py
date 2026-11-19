"""Execute diariamente: python -m src.modules.history.cleanup."""

import asyncio

from src.core.database import AsyncSessionLocal, engine
from src.modules.history.service import purge_expired


async def main():
    try:
        async with AsyncSessionLocal() as session, session.begin():
            count = await purge_expired(session)
        print(f"Registros expirados removidos: {count}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
