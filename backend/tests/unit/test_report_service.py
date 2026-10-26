from dataclasses import replace
from datetime import UTC, date, datetime, time
from unittest.mock import AsyncMock, Mock
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from geoalchemy2.shape import to_shape
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.exceptions import AppException, BusinessRuleException
from src.modules.reports.models import IncidentPeriod, ReportCategory
from src.modules.reports.service import CreateReportData, ReportService


@pytest.fixture
def data() -> CreateReportData:
    return CreateReportData(
        latitude=-23.55052,
        longitude=-46.633308,
        category=ReportCategory.ASSEDIO,
        incident_date=date(2026, 10, 25),
        incident_period=IncidentPeriod.NOITE,
        is_anonymous=True,
    )


@pytest.fixture
def session() -> Mock:
    session = Mock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=0)
    return session


@pytest.mark.anyio
async def test_create_normalizes_text_and_preserves_author(
    session: Mock, data: CreateReportData
) -> None:
    author_id, device_id = uuid4(), uuid4()
    service = ReportService(session, today=lambda: date(2026, 10, 26))
    report = await service.create(
        replace(data, description="  relato  ", address_reference="  "),
        author_id=author_id,
        device_id=device_id,
    )
    assert report.author_id == author_id
    assert report.device_id == device_id
    assert report.is_anonymous is True
    assert report.description == "relato"
    assert report.address_reference is None
    assert report.incident_time is None
    point = to_shape(report.location)
    assert (point.x, point.y) == (data.longitude, data.latitude)
    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "changes, field",
    [
        ({"latitude": float("nan")}, "location.latitude"),
        ({"latitude": 91}, "location.latitude"),
        ({"latitude": 10**1000}, "location.latitude"),
        ({"longitude": float("inf")}, "location.longitude"),
        ({"longitude": -181}, "location.longitude"),
        ({"latitude": True}, "location.latitude"),
        ({"category": "outra"}, "category"),
        ({"incident_period": "outro"}, "incident_period"),
        ({"description": "x" * 1001}, "description"),
        ({"address_reference": "x" * 256}, "location.address_reference"),
        ({"incident_date": date(2026, 10, 27)}, "incident_date"),
        ({"incident_time": time(12)}, "incident_time"),
        ({"incident_time": time(20, 0, 1)}, "incident_time"),
        ({"incident_time": time(20, tzinfo=UTC)}, "incident_time"),
        ({"is_anonymous": "true"}, "is_anonymous"),
    ],
)
async def test_invalid_data_never_reaches_persistence(
    session: Mock, data: CreateReportData, changes: dict, field: str
) -> None:
    service = ReportService(session, today=lambda: date(2026, 10, 26))
    with pytest.raises(BusinessRuleException) as error:
        await service.create(
            replace(data, **changes), author_id=uuid4(), device_id=uuid4()
        )
    assert error.value.code == "VALIDATION_ERROR"
    assert error.value.details[0]["field"] == field
    session.execute.assert_not_called()
    session.add.assert_not_called()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "period, hour, minute",
    [
        (IncidentPeriod.MADRUGADA, 0, 0),
        (IncidentPeriod.MADRUGADA, 5, 59),
        (IncidentPeriod.MANHA, 6, 0),
        (IncidentPeriod.MANHA, 11, 59),
        (IncidentPeriod.TARDE, 12, 0),
        (IncidentPeriod.TARDE, 17, 59),
        (IncidentPeriod.NOITE, 18, 0),
        (IncidentPeriod.NOITE, 23, 59),
    ],
)
async def test_period_boundaries(
    session: Mock,
    data: CreateReportData,
    period: IncidentPeriod,
    hour: int,
    minute: int,
) -> None:
    service = ReportService(session, today=lambda: date(2026, 10, 26))
    report = await service.create(
        replace(data, incident_period=period, incident_time=time(hour, minute)),
        author_id=uuid4(),
        device_id=uuid4(),
    )
    assert report.incident_time == time(hour, minute)


@pytest.mark.anyio
async def test_text_limits_apply_after_trimming(
    session: Mock, data: CreateReportData
) -> None:
    service = ReportService(session, today=lambda: date(2026, 10, 26))
    report = await service.create(
        replace(data, description=" " + "x" * 1000 + " ", address_reference="x" * 255),
        author_id=uuid4(),
        device_id=uuid4(),
    )
    assert len(report.description) == 1000
    assert len(report.address_reference) == 255


@pytest.mark.anyio
async def test_future_date_uses_sao_paulo_calendar(
    session: Mock, data: CreateReportData
) -> None:
    instant = datetime(2026, 10, 26, 1, tzinfo=UTC)
    service = ReportService(
        session, today=lambda: instant.astimezone(ZoneInfo("America/Sao_Paulo")).date()
    )
    with pytest.raises(BusinessRuleException):
        await service.create(
            replace(data, incident_date=date(2026, 10, 26)),
            author_id=uuid4(),
            device_id=uuid4(),
        )


@pytest.mark.anyio
async def test_rate_limit_rolls_back_without_inserting(
    session: Mock, data: CreateReportData
) -> None:
    session.scalar.return_value = 5
    service = ReportService(session, today=lambda: date(2026, 10, 26))
    with pytest.raises(AppException) as error:
        await service.create(data, author_id=uuid4(), device_id=uuid4())
    assert error.value.code == "RATE_LIMIT_EXCEEDED"
    assert error.value.status_code == 429
    session.add.assert_not_called()
    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["execute", "flush", "refresh", "commit"])
async def test_persistence_failure_rolls_back(
    session: Mock, data: CreateReportData, operation: str
) -> None:
    getattr(session, operation).side_effect = RuntimeError("database failure")
    service = ReportService(session, today=lambda: date(2026, 10, 26))
    with pytest.raises(RuntimeError, match="database failure"):
        await service.create(data, author_id=uuid4(), device_id=uuid4())
    session.rollback.assert_awaited_once()
