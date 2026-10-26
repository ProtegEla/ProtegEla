from collections.abc import Iterator
from datetime import UTC, date, datetime, time
from unittest.mock import AsyncMock
from uuid import UUID, uuid1, uuid4

import pytest
from geoalchemy2.shape import from_shape
from httpx import AsyncClient
from shapely.geometry import Point
from src.core.security import create_access_token, create_refresh_token
from src.main import app
from src.modules.auth.dependencies import get_current_author
from src.modules.reports.models import IncidentPeriod, Report, ReportCategory
from src.modules.reports.router import get_report_service
from src.modules.reports.service import ReportService


@pytest.fixture
def payload() -> dict:
    return {
        "location": {"latitude": -23.55052, "longitude": -46.633308},
        "category": "Furto",
        "incident_date": "2000-01-01",
        "incident_period": "noite",
        "incident_time": "20:30",
        "is_anonymous": True,
    }


@pytest.fixture
def route_service() -> Iterator[AsyncMock]:
    service = AsyncMock(spec=ReportService)
    service.create.return_value = Report(
        id=uuid4(),
        author_id=uuid4(),
        device_id=uuid4(),
        location=from_shape(Point(-46.633308, -23.55052), srid=4326),
        category=ReportCategory.FURTO,
        incident_date=date(2000, 1, 1),
        incident_period=IncidentPeriod.NOITE,
        incident_time=time(20, 30),
        is_anonymous=True,
        created_at=datetime(2026, 10, 26, 17, tzinfo=UTC),
    )

    async def override_service() -> AsyncMock:
        return service

    app.dependency_overrides[get_report_service] = override_service
    try:
        yield service
    finally:
        app.dependency_overrides.pop(get_report_service, None)


@pytest.fixture
def author(route_service: AsyncMock) -> Iterator[UUID]:
    subject = uuid4()

    async def override_author() -> UUID:
        return subject

    app.dependency_overrides[get_current_author] = override_author
    try:
        yield subject
    finally:
        app.dependency_overrides.pop(get_current_author, None)


@pytest.mark.anyio
async def test_created_response_hides_internal_fields(
    async_client: AsyncClient, payload: dict, route_service: AsyncMock, author: UUID
) -> None:
    device_id = uuid4()
    response = await async_client.post(
        "/api/v1/reports", json=payload, headers={"X-Device-Id": str(device_id)}
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert set(data) == {
        "id",
        "location",
        "category",
        "description",
        "incident_date",
        "incident_period",
        "incident_time",
        "is_anonymous",
        "created_at",
    }
    assert data["location"] == {**payload["location"], "address_reference": None}
    assert data["description"] is None
    assert data["incident_time"] == "20:30"
    assert data["created_at"] == "2026-10-26T17:00:00Z"
    assert route_service.create.await_args.kwargs == {
        "author_id": author,
        "device_id": device_id,
    }


@pytest.mark.anyio
@pytest.mark.parametrize(
    "field, value",
    [
        ("category", "outro"),
        ("incident_period", "outro"),
        ("incident_date", "20000101"),
        ("incident_date", 946684800),
        ("incident_date", "2000-01-01T00:00:00Z"),
        ("incident_time", "20:30:00"),
        ("incident_time", "20:30Z"),
        ("incident_time", 1200),
        ("is_anonymous", "true"),
        ("description", "x" * 1001),
        ("author_id", str(uuid4())),
        ("device_id", str(uuid4())),
        ("is_hidden", False),
        ("confirmations_count", 0),
        ("location", {"latitude": 91, "longitude": 0}),
        ("location", {"latitude": True, "longitude": 0}),
        ("location", {"latitude": "-23.5", "longitude": 0}),
        ("location", {"latitude": 0, "longitude": 0, "extra": 1}),
    ],
)
async def test_invalid_payload_is_rejected_before_service(
    async_client: AsyncClient,
    payload: dict,
    route_service: AsyncMock,
    author: UUID,
    field: str,
    value: object,
) -> None:
    response = await async_client.post(
        "/api/v1/reports",
        json={**payload, field: value},
        headers={"X-Device-Id": str(uuid4())},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    route_service.create.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "field",
    ["location", "category", "incident_date", "incident_period", "is_anonymous"],
)
async def test_required_fields_cannot_be_omitted(
    async_client: AsyncClient,
    payload: dict,
    route_service: AsyncMock,
    author: UUID,
    field: str,
) -> None:
    payload.pop(field)
    response = await async_client.post(
        "/api/v1/reports", json=payload, headers={"X-Device-Id": str(uuid4())}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    route_service.create.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("device", [None, "invalid", str(uuid1())])
async def test_missing_or_invalid_device_is_rejected(
    async_client: AsyncClient,
    payload: dict,
    route_service: AsyncMock,
    author: UUID,
    device: str | None,
) -> None:
    response = await async_client.post(
        "/api/v1/reports",
        json=payload,
        headers={"X-Device-Id": device} if device is not None else {},
    )
    assert response.status_code == 422
    route_service.create.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "authorization",
    [
        None,
        "Basic abc",
        "Bearer invalid",
        "Bearer " + create_refresh_token(str(uuid4())),
    ],
)
async def test_unauthorized_requests_never_create_reports(
    async_client: AsyncClient,
    payload: dict,
    route_service: AsyncMock,
    authorization: str | None,
) -> None:
    headers = {"X-Device-Id": str(uuid4())}
    if authorization is not None:
        headers["Authorization"] = authorization
    response = await async_client.post("/api/v1/reports", json=payload, headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    route_service.create.assert_not_awaited()


@pytest.mark.anyio
async def test_valid_token_still_requires_account_lookup(
    async_client: AsyncClient, payload: dict, route_service: AsyncMock
) -> None:
    response = await async_client.post(
        "/api/v1/reports",
        json=payload,
        headers={
            "X-Device-Id": str(uuid4()),
            "Authorization": "Bearer " + create_access_token(str(uuid4())),
        },
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTHENTICATION_UNAVAILABLE"
    route_service.create.assert_not_awaited()
