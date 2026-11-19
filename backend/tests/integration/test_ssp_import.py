"""Importação SSP com PostgreSQL/PostGIS reais."""

from sqlalchemy import func, select
from geoalchemy2.shape import to_shape
import pytest
from src.modules.risk_zones.models import SSPSafetyRecord
from src.modules.risk_zones.service import import_ssp
from tests.unit.test_ssp_parser import BOUNDARY, content, row

URL = "https://www.ssp.sp.gov.br/test-fixture.xlsx"


@pytest.mark.anyio
async def test_reimport_update_and_invalidation(test_db):
    async with test_db() as session:

        async def load(*rows):
            return await import_ssp(
                session,
                content(*rows),
                boundary=BOUNDARY,
                source_url=URL,
                source_period="2026",
            )

        await load(row(), row())
        record = await session.scalar(select(SSPSafetyRecord))
        original_id = record.id
        assert to_shape(record.location).x == -46.63
        await load(row())
        assert (
            await session.scalar(select(func.count()).select_from(SSPSafetyRecord)) == 1
        )
        await load(row(VERSAO="2", LATITUDE="-23.56"))
        await session.refresh(record)
        assert record.id == original_id and record.source_version == 2
        assert to_shape(record.location).y == -23.56
        result = await load(row())
        assert result["ignored_older"] == 1
        await session.refresh(record)
        assert record.source_version == 2
        await load(
            row(VERSAO="3", LOGRADOURO="VEDAÇÃO DA DIVULGAÇÃO DOS DADOS RELATIVOS")
        )
        await session.refresh(record)
        assert not record.is_active and record.location is None
        assert record.incident_date is None
        assert len(record.file_sha256) == len(record.source_key) == 64


@pytest.mark.anyio
async def test_invalid_load_does_not_partially_persist(test_db):
    async with test_db() as session:
        with pytest.raises(ValueError):
            await import_ssp(
                session,
                content(row(), row(NUM_BO="OTHER", VERSAO="bad")),
                boundary=BOUNDARY,
                source_url=URL,
                source_period="2026",
            )
        assert (
            await session.scalar(select(func.count()).select_from(SSPSafetyRecord)) == 0
        )


@pytest.mark.anyio
async def test_write_failure_rolls_back_entire_load(test_db, monkeypatch):
    async with test_db() as session:

        async def failing_commit():
            await session.flush()
            raise RuntimeError("fixture failure")

        monkeypatch.setattr(session, "commit", failing_commit)
        with pytest.raises(RuntimeError, match="fixture failure"):
            await import_ssp(
                session,
                content(row(), row(NUM_BO="SECOND")),
                boundary=BOUNDARY,
                source_url=URL,
                source_period="2026",
            )
    async with test_db() as session:
        assert (
            await session.scalar(select(func.count()).select_from(SSPSafetyRecord)) == 0
        )
