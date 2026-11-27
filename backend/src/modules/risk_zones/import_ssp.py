"""Uso: python -m src.modules.risk_zones.import_ssp --help."""

import argparse
import asyncio
import json
from pathlib import Path
from shapely.geometry import shape
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from src.core.config import settings
from src.modules.risk_zones.service import import_ssp


def _build_admin_async_url() -> str:
    url = settings.DATABASE_SYNC_URL or settings.DATABASE_URL
    url = url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
    url = url.replace("postgresql://", "postgresql+asyncpg://")
    return url.replace("sslmode=", "ssl=")


async def run(args):
    boundary = json.loads(Path(args.boundary).read_text(encoding="utf-8"))
    if boundary.get("type") == "FeatureCollection":
        features = boundary.get("features") or []
        if not features:
            raise ValueError("FeatureCollection vazio.")
        boundary = features[0]["geometry"]
    elif boundary.get("type") == "Feature":
        boundary = boundary["geometry"]

    admin_engine = create_async_engine(
        _build_admin_async_url(),
        echo=False,
        hide_parameters=True,
        pool_pre_ping=True,
    )
    AdminSession = async_sessionmaker(
        bind=admin_engine, class_=AsyncSession, expire_on_commit=False
    )
    try:
        async with AdminSession() as session:
            counts = await import_ssp(
                session,
                Path(args.csv).read_bytes(),
                boundary=shape(boundary),
                source_url=args.source_url,
                source_period=args.period,
            )
        print(json.dumps(counts, sort_keys=True))
    finally:
        await admin_engine.dispose()


def main():
    parser = argparse.ArgumentParser(
        description="Importa CSV SSP normalizado, sem publicar no mapa."
    )
    parser.add_argument("csv")
    parser.add_argument(
        "--boundary", required=True, help="Polygon/MultiPolygon municipal GeoJSON WGS84"
    )
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--period", required=True)
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
