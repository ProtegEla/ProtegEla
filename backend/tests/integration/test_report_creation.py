"""Criação transacional e limite RN06 em PostgreSQL/PostGIS real."""

import asyncio
import os
from collections.abc import AsyncIterator
from datetime import date, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select, update
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from src.core.database import get_db_session
from src.core.exceptions import AppException
from src.main import app
from src.modules.auth.dependencies import get_current_author
from src.modules.reports.models import IncidentPeriod, Report, ReportCategory
from src.modules.reports.service import CreateReportData, ReportService


@pytest.fixture
async def service_database() -> AsyncIterator[tuple[AsyncEngine, UUID]]:
    database_url = os.environ.get("TEST_DATABASE_SYNC_URL")
    if not database_url:
        pytest.skip("Defina TEST_DATABASE_SYNC_URL para testar PostgreSQL/PostGIS")
    url = make_url(database_url)
    if not url.database or not url.database.endswith("_test"):
        pytest.fail("Os testes exigem um banco terminado em _test")
    engine = create_async_engine(url.set(drivername="postgresql+asyncpg"))
    device_id = uuid4()
    try:
        yield engine, device_id
    finally:
        try:
            async with engine.begin() as connection:
                await connection.execute(
                    delete(Report).where(Report.device_id == device_id)
                )
        finally:
            await engine.dispose()


def incident_data() -> CreateReportData:
    return CreateReportData(
        latitude=-23.55052,
        longitude=-46.633308,
        category=ReportCategory.FURTO,
        incident_date=date(2026, 10, 25),
        incident_period=IncidentPeriod.NOITE,
        is_anonymous=True,
        description="  descrição do incidente  ",
    )


async def create_incident(engine: AsyncEngine, device_id: UUID) -> Report:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        return await ReportService(session, today=lambda: date(2026, 10, 26)).create(
            incident_data(), author_id=uuid4(), device_id=device_id
        )


@pytest.mark.anyio
async def test_concurrent_creations_respect_limit_across_sessions(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    results = await asyncio.gather(
        *(create_incident(engine, device_id) for _ in range(8)),
        return_exceptions=True,
    )
    reports = [result for result in results if isinstance(result, Report)]
    errors = [result for result in results if isinstance(result, AppException)]
    assert len(reports) == 5, results
    assert len(errors) == 3, results
    assert all(error.code == "RATE_LIMIT_EXCEEDED" for error in errors)
    assert all(report.description == "descrição do incidente" for report in reports)
    assert all(report.created_at.utcoffset() is not None for report in reports)
    # Autoras diferentes continuam sujeitas ao limite do mesmo dispositivo.
    assert len({report.author_id for report in reports}) == 5
    async with engine.connect() as connection:
        count = await connection.scalar(
            select(func.count(Report.id)).where(Report.device_id == device_id)
        )
    assert count == 5


@pytest.mark.anyio
async def test_expired_reports_do_not_block_new_creation(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    for _ in range(5):
        await create_incident(engine, device_id)
    with pytest.raises(AppException) as error:
        await create_incident(engine, device_id)
    assert error.value.code == "RATE_LIMIT_EXCEEDED"

    async with engine.begin() as connection:
        await connection.execute(
            update(Report)
            .where(Report.device_id == device_id)
            .values(created_at=func.clock_timestamp() - timedelta(seconds=61))
        )
    report = await create_incident(engine, device_id)
    async with AsyncSession(engine) as session:
        saved = await session.get(Report, report.id)
        assert saved is not None
        assert saved.device_id == device_id
        assert saved.is_anonymous is True


@pytest.mark.anyio
async def test_http_creation_persists_and_returns_validation_and_limit_errors(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    author_id = uuid4()

    async def override_author() -> UUID:
        return author_id

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_current_author] = override_author
    app.dependency_overrides[get_db_session] = override_session
    payload = {
        "location": {
            "latitude": -23.55052,
            "longitude": -46.633308,
            "address_reference": "  próximo à praça  ",
        },
        "category": "Furto",
        "description": "  descrição do incidente  ",
        "incident_date": "2000-01-01",
        "incident_period": "noite",
        "is_anonymous": True,
    }
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            headers = {"X-Device-Id": str(device_id)}
            for changes in (
                {"incident_date": "9999-01-01"},
                {"incident_time": "10:00"},
            ):
                invalid = await client.post(
                    "/api/v1/reports", json={**payload, **changes}, headers=headers
                )
                assert invalid.status_code == 422
                assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"

            response = await client.post(
                "/api/v1/reports", json=payload, headers=headers
            )
            assert response.status_code == 201
            data = response.json()["data"]
            assert "author_id" not in data
            assert "device_id" not in data
            assert data["incident_time"] is None
            assert data["description"] == "descrição do incidente"
            assert data["location"]["address_reference"] == "próximo à praça"
            assert data["created_at"].endswith("Z")

            async with AsyncSession(engine) as session:
                saved = await session.get(Report, UUID(data["id"]))
                assert saved is not None
                assert saved.author_id == author_id
                assert saved.device_id == device_id
                assert saved.is_anonymous is True

            for _ in range(4):
                accepted = await client.post(
                    "/api/v1/reports", json=payload, headers=headers
                )
                assert accepted.status_code == 201
            limited = await client.post(
                "/api/v1/reports", json=payload, headers=headers
            )
            assert limited.status_code == 429
            assert limited.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    finally:
        app.dependency_overrides.pop(get_current_author, None)
        app.dependency_overrides.pop(get_db_session, None)
