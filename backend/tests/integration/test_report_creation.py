"""Criação transacional e limite RN06 em PostgreSQL/PostGIS real."""

import asyncio
import os
from collections.abc import AsyncIterator
from dataclasses import replace
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, event, func, select, update
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from src.core.database import get_db_session
from src.core.exceptions import AppException, EntityNotFoundException
from src.main import app
from src.modules.auth.dependencies import get_current_author
from src.modules.reports.models import (
    IncidentPeriod,
    Report,
    ReportCategory,
    ReportInteraction,
    ReportInteractionKind,
)
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
                    delete(ReportInteraction).where(
                        ReportInteraction.report_id.in_(
                            select(Report.id).where(Report.device_id == device_id)
                        )
                    )
                )
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
async def test_rf07_http_flow_with_real_service_and_database(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    current_user = report.author_id

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    async def override_user() -> UUID:
        return current_user

    app.dependency_overrides[get_db_session] = override_session
    url = f"/api/v1/reports/{report.id}"
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            # A consulta funciona sem identidade, mesmo antes de Users existir.
            initial = await client.get(url)
            assert initial.status_code == 200
            data = initial.json()["data"]
            assert data["confirmations_count"] == 0
            assert data["incident_time"] is None
            assert data["created_at"].endswith("Z")
            assert "author_id" not in data
            assert "device_id" not in data
            assert "is_hidden" not in data
            assert "abuse_reports_count" not in data
            for action in ("confirm", "report-abuse"):
                unauthorized = await client.post(f"{url}/{action}", json={})
                assert unauthorized.status_code == 401

            # Apenas a identidade é substituída; persistência e serviço são reais.
            app.dependency_overrides[get_current_author] = override_user
            for action in ("confirm", "report-abuse"):
                forbidden = await client.post(f"{url}/{action}", json={})
                assert forbidden.status_code == 403
                assert forbidden.json()["error"]["code"] == "FORBIDDEN"

            current_user = uuid4()
            first = await client.post(f"{url}/confirm", json={})
            repeated = await client.post(f"{url}/confirm", json={})
            assert first.status_code == repeated.status_code == 200
            assert (
                first.json()
                == repeated.json()
                == {"data": {"report_id": str(report.id), "confirmed": True}}
            )
            conflict = await client.post(f"{url}/report-abuse", json={})
            assert conflict.status_code == 409
            assert conflict.json()["error"]["code"] == "INTERACTION_CONFLICT"

            current_user = uuid4()
            second = await client.post(f"{url}/confirm", json={})
            assert second.status_code == 200
            details = await client.get(url)
            assert details.json()["data"]["confirmations_count"] == 2

            current_user = uuid4()
            abuse = await client.post(f"{url}/report-abuse", json={})
            assert abuse.status_code == 200
            assert abuse.json() == {
                "data": {"report_id": str(report.id), "abuse_registered": True}
            }
            assert (
                await client.post(f"{url}/report-abuse", json={})
            ).status_code == 404
            assert (await client.post(f"{url}/confirm", json={})).status_code == 404
            hidden = await client.get(url)
            missing = await client.get(f"/api/v1/reports/{uuid4()}")
            assert hidden.status_code == missing.status_code == 404
            assert (
                hidden.json()["error"]["message"] == missing.json()["error"]["message"]
            )
            current_user = report.author_id
            assert (await client.post(f"{url}/confirm", json={})).status_code == 404

            async with AsyncSession(engine) as session:
                saved = await session.get(Report, report.id)
                assert saved.is_hidden is True
                result = await session.execute(
                    select(ReportInteraction.kind, func.count(ReportInteraction.id))
                    .where(ReportInteraction.report_id == report.id)
                    .group_by(ReportInteraction.kind)
                )
                assert dict(result.all()) == {
                    ReportInteractionKind.CONFIRMATION: 2,
                    ReportInteractionKind.ABUSE: 1,
                }
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        app.dependency_overrides.pop(get_current_author, None)


async def seed_interactions(
    engine: AsyncEngine, report_id: UUID, confirmations: int, abuses: int = 0
) -> None:
    async with AsyncSession(engine) as session:
        for kind, count in (
            (ReportInteractionKind.CONFIRMATION, confirmations),
            (ReportInteractionKind.ABUSE, abuses),
        ):
            session.add_all(
                [
                    ReportInteraction(report_id=report_id, user_id=uuid4(), kind=kind)
                    for _ in range(count)
                ]
            )
        await session.commit()


async def register_interaction(
    engine: AsyncEngine, report_id: UUID, user_id: UUID, kind: ReportInteractionKind
) -> None:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        service = ReportService(session)
        operation = (
            service.confirm
            if kind == ReportInteractionKind.CONFIRMATION
            else service.report_abuse
        )
        await operation(report_id, user_id=user_id)


@pytest.mark.anyio
@pytest.mark.parametrize("kind", list(ReportInteractionKind))
async def test_repeated_interaction_keeps_original_id_and_timestamp(
    service_database: tuple[AsyncEngine, UUID], kind: ReportInteractionKind
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    await seed_interactions(engine, report.id, 10)
    user_id = uuid4()
    await register_interaction(engine, report.id, user_id, kind)
    original_time = datetime(2000, 1, 1, tzinfo=UTC)
    async with engine.begin() as connection:
        await connection.execute(
            update(ReportInteraction)
            .where(
                ReportInteraction.report_id == report.id,
                ReportInteraction.user_id == user_id,
            )
            .values(created_at=original_time)
        )
        original_id = await connection.scalar(
            select(ReportInteraction.id).where(
                ReportInteraction.report_id == report.id,
                ReportInteraction.user_id == user_id,
            )
        )
    await register_interaction(engine, report.id, user_id, kind)
    async with AsyncSession(engine) as session:
        saved = (
            await session.scalars(
                select(ReportInteraction).where(
                    ReportInteraction.report_id == report.id,
                    ReportInteraction.user_id == user_id,
                )
            )
        ).one()
        assert saved.id == original_id
        assert saved.created_at == original_time
        assert saved.kind is kind


@pytest.mark.anyio
@pytest.mark.parametrize("first", list(ReportInteractionKind))
async def test_opposite_interaction_preserves_original_record(
    service_database: tuple[AsyncEngine, UUID], first: ReportInteractionKind
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    await seed_interactions(engine, report.id, 10)
    user_id = uuid4()
    await register_interaction(engine, report.id, user_id, first)
    second = (
        ReportInteractionKind.ABUSE
        if first == ReportInteractionKind.CONFIRMATION
        else ReportInteractionKind.CONFIRMATION
    )
    with pytest.raises(AppException) as error:
        await register_interaction(engine, report.id, user_id, second)
    assert error.value.status_code == 409
    assert error.value.code == "INTERACTION_CONFLICT"
    async with engine.connect() as connection:
        saved_kind = await connection.scalar(
            select(ReportInteraction.kind).where(
                ReportInteraction.report_id == report.id,
                ReportInteraction.user_id == user_id,
            )
        )
        assert saved_kind is first


@pytest.mark.anyio
@pytest.mark.parametrize(
    "confirmations, abuses, hidden",
    [(0, 1, True), (3, 1, True), (10, 3, False), (10, 4, True)],
)
async def test_abuse_and_hiding_are_committed_together(
    service_database: tuple[AsyncEngine, UUID],
    confirmations: int,
    abuses: int,
    hidden: bool,
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    await seed_interactions(engine, report.id, confirmations, abuses - 1)
    await register_interaction(engine, report.id, uuid4(), ReportInteractionKind.ABUSE)
    async with AsyncSession(engine) as session:
        saved = await session.get(Report, report.id)
        assert saved.is_hidden is hidden
        count = await session.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id == report.id,
                ReportInteraction.kind == ReportInteractionKind.ABUSE,
            )
        )
        assert count == abuses


@pytest.mark.anyio
async def test_hidden_report_takes_precedence_over_repeat_and_author_permissions(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    user_id = uuid4()
    await register_interaction(engine, report.id, user_id, ReportInteractionKind.ABUSE)
    for actor in (user_id, report.author_id):
        for kind in ReportInteractionKind:
            with pytest.raises(EntityNotFoundException):
                await register_interaction(engine, report.id, actor, kind)
    async with AsyncSession(engine) as session:
        with pytest.raises(EntityNotFoundException):
            await ReportService(session).get_details(report.id)
        count = await session.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id == report.id
            )
        )
        assert count == 1


@pytest.mark.anyio
@pytest.mark.parametrize("kind", list(ReportInteractionKind))
async def test_repeated_concurrent_actions_are_idempotent(
    service_database: tuple[AsyncEngine, UUID], kind: ReportInteractionKind
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    await seed_interactions(engine, report.id, 10)
    user_id = uuid4()
    results = await asyncio.gather(
        *(register_interaction(engine, report.id, user_id, kind) for _ in range(6)),
        return_exceptions=True,
    )
    assert results == [None] * 6
    async with engine.connect() as connection:
        count = await connection.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id == report.id,
                ReportInteraction.user_id == user_id,
            )
        )
        assert count == 1


@pytest.mark.anyio
async def test_opposite_concurrent_actions_return_one_success_and_one_conflict(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    await seed_interactions(engine, report.id, 10)
    user_id = uuid4()
    results = await asyncio.gather(
        *(
            register_interaction(engine, report.id, user_id, kind)
            for kind in ReportInteractionKind
        ),
        return_exceptions=True,
    )
    assert results.count(None) == 1, results
    errors = [result for result in results if isinstance(result, AppException)]
    assert len(errors) == 1, results
    assert errors[0].code == "INTERACTION_CONFLICT"


@pytest.mark.anyio
async def test_concurrent_abuses_stop_when_report_becomes_hidden(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    await seed_interactions(engine, report.id, 10)
    results = await asyncio.gather(
        *(
            register_interaction(
                engine, report.id, uuid4(), ReportInteractionKind.ABUSE
            )
            for _ in range(8)
        ),
        return_exceptions=True,
    )
    assert results.count(None) == 4, results
    assert sum(isinstance(result, EntityNotFoundException) for result in results) == 4
    async with AsyncSession(engine) as session:
        saved = await session.get(Report, report.id)
        assert saved.is_hidden is True
        count = await session.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id == report.id,
                ReportInteraction.kind == ReportInteractionKind.ABUSE,
            )
        )
        assert count == 4


@pytest.mark.anyio
async def test_failure_to_hide_rolls_back_abuse_and_releases_lock(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)

    def fail_on_hide(
        connection: Connection,
        cursor: object,
        statement: str,
        parameters: object,
        context: object,
        executemany: bool,
    ) -> None:
        if statement.startswith("UPDATE reports SET is_hidden"):
            raise RuntimeError("simulated update failure")

    event.listen(engine.sync_engine, "before_cursor_execute", fail_on_hide)
    try:
        with pytest.raises(RuntimeError, match="simulated update failure"):
            await register_interaction(
                engine, report.id, uuid4(), ReportInteractionKind.ABUSE
            )
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", fail_on_hide)
    async with AsyncSession(engine) as session:
        saved = await session.get(Report, report.id)
        assert saved.is_hidden is False
        count = await session.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id == report.id
            )
        )
        assert count == 0
    await register_interaction(engine, report.id, uuid4(), ReportInteractionKind.ABUSE)


@pytest.mark.anyio
@pytest.mark.parametrize("anonymous", [True, False])
async def test_details_count_only_confirmations_of_requested_report(
    service_database: tuple[AsyncEngine, UUID], anonymous: bool
) -> None:
    engine, device_id = service_database
    async with AsyncSession(engine, expire_on_commit=False) as session:
        report = await ReportService(session, today=lambda: date(2026, 10, 26)).create(
            replace(
                incident_data(),
                is_anonymous=anonymous,
                incident_time=time(20, 30),
                address_reference="  perto da praça  ",
            ),
            author_id=uuid4(),
            device_id=device_id,
        )
    other = await create_incident(engine, device_id)
    async with AsyncSession(engine) as session:
        session.add_all(
            [
                ReportInteraction(
                    report_id=report.id,
                    user_id=uuid4(),
                    kind=ReportInteractionKind.CONFIRMATION,
                    created_at=datetime(2000, 1, 1, tzinfo=UTC),
                ),
                *[
                    ReportInteraction(
                        report_id=report.id,
                        user_id=uuid4(),
                        kind=ReportInteractionKind.CONFIRMATION,
                    )
                    for _ in range(3)
                ],
                ReportInteraction(
                    report_id=report.id,
                    user_id=uuid4(),
                    kind=ReportInteractionKind.ABUSE,
                ),
                ReportInteraction(
                    report_id=other.id,
                    user_id=uuid4(),
                    kind=ReportInteractionKind.CONFIRMATION,
                ),
            ]
        )
        await session.commit()

    async with AsyncSession(engine) as session:
        details = await ReportService(session).get_details(report.id)
        assert details.confirmations_count == 4
        assert details.id == report.id
        assert details.is_anonymous is anonymous
        assert details.incident_date == report.incident_date
        assert details.incident_time == time(20, 30)
        assert details.incident_period is report.incident_period
        assert details.category is report.category
        assert details.address_reference == "perto da praça"
        assert details.description == "descrição do incidente"
        assert details.created_at == report.created_at
        assert details.latitude == pytest.approx(-23.55052)
        assert details.longitude == pytest.approx(-46.633308)


@pytest.mark.anyio
async def test_details_without_confirmations_return_zero(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    async with AsyncSession(engine) as session:
        details = await ReportService(session).get_details(report.id)
        assert details.confirmations_count == 0
        assert details.incident_time is None


@pytest.mark.anyio
async def test_hidden_and_missing_report_have_same_not_found_error(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    async with engine.begin() as connection:
        await connection.execute(
            update(Report).where(Report.id == report.id).values(is_hidden=True)
        )
    errors = []
    async with AsyncSession(engine) as session:
        for report_id in (report.id, uuid4()):
            with pytest.raises(EntityNotFoundException) as error:
                await ReportService(session).get_details(report_id)
            errors.append(error.value)
    assert errors[0].message == errors[1].message
    assert all(error.status_code == 404 for error in errors)
    assert all(error.code == "NOT_FOUND" for error in errors)


@pytest.mark.anyio
async def test_database_serializes_opposite_interactions_from_same_user(
    service_database: tuple[AsyncEngine, UUID],
) -> None:
    engine, device_id = service_database
    report = await create_incident(engine, device_id)
    user_id = uuid4()

    async def insert_interaction(kind: ReportInteractionKind) -> ReportInteraction:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            interaction = ReportInteraction(
                report_id=report.id, user_id=user_id, kind=kind
            )
            session.add(interaction)
            await session.commit()
            return interaction

    results = await asyncio.gather(
        insert_interaction(ReportInteractionKind.CONFIRMATION),
        insert_interaction(ReportInteractionKind.ABUSE),
        return_exceptions=True,
    )
    assert (
        sum(isinstance(result, ReportInteraction) for result in results) == 1
    ), results
    assert sum(isinstance(result, IntegrityError) for result in results) == 1, results
    async with engine.connect() as connection:
        count = await connection.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id == report.id
            )
        )
    assert count == 1


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
