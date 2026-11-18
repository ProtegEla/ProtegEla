"""Uso: python -m src.modules.risk_zones.import_ssp --help."""

import argparse
import asyncio
import json
from pathlib import Path
from shapely.geometry import shape
from src.core.database import AsyncSessionLocal, engine
from src.modules.risk_zones.service import import_ssp


async def run(args):
    boundary = json.loads(Path(args.boundary).read_text(encoding="utf-8"))
    if boundary.get("type") == "Feature":
        boundary = boundary["geometry"]
    try:
        async with AsyncSessionLocal() as session:
            counts = await import_ssp(
                session,
                Path(args.csv).read_bytes(),
                boundary=shape(boundary),
                source_url=args.source_url,
                source_period=args.period,
            )
        print(json.dumps(counts, sort_keys=True))
    finally:
        await engine.dispose()


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
    # O comando não registra SQL com dados da carga, mesmo em ambiente DEBUG.
    engine.echo = False
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
