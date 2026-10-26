from collections.abc import Iterator
from datetime import UTC, date, datetime, time
from unittest.mock import AsyncMock
from uuid import UUID, uuid1, uuid4

import pytest
from geoalchemy2.shape import from_shape
from httpx import AsyncClient
from shapely.geometry import Point
from src.core.exceptions import (
    AppException,
    EntityNotFoundException,
    ForbiddenException,
)
from src.core.security import create_access_token, create_refresh_token
from src.main import app
from src.modules.auth.dependencies import get_current_author
from src.modules.reports.models import IncidentPeriod, Report, ReportCategory
from src.modules.reports.router import get_report_service
from src.modules.reports.service import ReportDetails, ReportService


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
    service.get_details.return_value = ReportDetails(
        id=service.create.return_value.id,
        latitude=-23.55052,
        longitude=-46.633308,
        address_reference=None,
        category=ReportCategory.FURTO,
        description=None,
        incident_date=date(2000, 1, 1),
        incident_period=IncidentPeriod.NOITE,
        incident_time=time(20, 30),
        is_anonymous=True,
        created_at=datetime(2026, 10, 26, 17, tzinfo=UTC),
        confirmations_count=4,
    )
    service.confirm.return_value = None
    service.report_abuse.return_value = None

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


@pytest.mark.anyio
@pytest.mark.parametrize("authorization", [None, "Bearer invalid"])
async def test_details_are_public_and_only_expose_public_fields(
    async_client: AsyncClient, route_service: AsyncMock, authorization: str | None
) -> None:
    report_id = route_service.get_details.return_value.id
    response = await async_client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": authorization} if authorization else {},
    )
    assert response.status_code == 200
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
        "confirmations_count",
    }
    assert data["id"] == str(report_id)
    assert data["confirmations_count"] == 4
    assert data["description"] is None
    assert data["location"] == {
        "latitude": -23.55052,
        "longitude": -46.633308,
        "address_reference": None,
    }
    assert data["incident_time"] == "20:30"
    assert data["created_at"] == "2026-10-26T17:00:00Z"
    route_service.get_details.assert_awaited_once_with(report_id)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "suffix, method, success_field",
    [
        ("confirm", "confirm", "confirmed"),
        ("report-abuse", "report_abuse", "abuse_registered"),
    ],
)
async def test_interaction_success_uses_authenticated_identity(
    async_client: AsyncClient,
    route_service: AsyncMock,
    author: UUID,
    suffix: str,
    method: str,
    success_field: str,
) -> None:
    report_id = uuid4()
    response = await async_client.post(f"/api/v1/reports/{report_id}/{suffix}", json={})
    assert response.status_code == 200
    assert response.json() == {
        "data": {"report_id": str(report_id), success_field: True}
    }
    getattr(route_service, method).assert_awaited_once_with(report_id, user_id=author)


@pytest.mark.anyio
@pytest.mark.parametrize("suffix", ["", "/confirm", "/report-abuse"])
@pytest.mark.parametrize("identifier", ["invalid", str(uuid1())])
async def test_rf07_rejects_invalid_path_identifiers(
    async_client: AsyncClient,
    route_service: AsyncMock,
    author: UUID,
    suffix: str,
    identifier: str,
) -> None:
    url = f"/api/v1/reports/{identifier}{suffix}"
    response = (
        await async_client.post(url, json={}) if suffix else await async_client.get(url)
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    route_service.get_details.assert_not_awaited()
    route_service.confirm.assert_not_awaited()
    route_service.report_abuse.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("suffix", ["confirm", "report-abuse"])
@pytest.mark.parametrize(
    "body",
    [
        None,
        [],
        "text",
        {"user_id": str(uuid4())},
        {"kind": "abuse"},
        {"is_hidden": False},
    ],
)
async def test_interaction_rejects_nonempty_or_nonobject_body(
    async_client: AsyncClient,
    route_service: AsyncMock,
    author: UUID,
    suffix: str,
    body: object,
) -> None:
    response = await async_client.post(f"/api/v1/reports/{uuid4()}/{suffix}", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    route_service.confirm.assert_not_awaited()
    route_service.report_abuse.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("suffix", ["confirm", "report-abuse"])
@pytest.mark.parametrize(
    "authorization",
    [None, "Bearer invalid", "Bearer " + create_refresh_token(str(uuid4()))],
)
async def test_interactions_reject_unauthorized_requests(
    async_client: AsyncClient,
    route_service: AsyncMock,
    suffix: str,
    authorization: str | None,
) -> None:
    response = await async_client.post(
        f"/api/v1/reports/{uuid4()}/{suffix}",
        json={},
        headers={"Authorization": authorization} if authorization else {},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    route_service.confirm.assert_not_awaited()
    route_service.report_abuse.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("suffix", ["confirm", "report-abuse"])
async def test_interactions_remain_closed_until_account_lookup_exists(
    async_client: AsyncClient, route_service: AsyncMock, suffix: str
) -> None:
    response = await async_client.post(
        f"/api/v1/reports/{uuid4()}/{suffix}",
        json={},
        headers={"Authorization": "Bearer " + create_access_token(str(uuid4()))},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTHENTICATION_UNAVAILABLE"
    route_service.confirm.assert_not_awaited()
    route_service.report_abuse.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "suffix, method, error",
    [
        ("", "get_details", EntityNotFoundException("Relato não encontrado.")),
        ("/confirm", "confirm", EntityNotFoundException("Relato não encontrado.")),
        (
            "/report-abuse",
            "report_abuse",
            EntityNotFoundException("Relato não encontrado."),
        ),
        ("/confirm", "confirm", ForbiddenException()),
        ("/report-abuse", "report_abuse", ForbiddenException()),
        (
            "/confirm",
            "confirm",
            AppException("Conflito.", code="INTERACTION_CONFLICT", status_code=409),
        ),
        (
            "/report-abuse",
            "report_abuse",
            AppException("Conflito.", code="INTERACTION_CONFLICT", status_code=409),
        ),
    ],
)
async def test_rf07_service_errors_use_standard_envelope(
    async_client: AsyncClient,
    route_service: AsyncMock,
    author: UUID,
    suffix: str,
    method: str,
    error: AppException,
) -> None:
    getattr(route_service, method).side_effect = error
    url = f"/api/v1/reports/{uuid4()}{suffix}"
    response = (
        await async_client.post(url, json={}) if suffix else await async_client.get(url)
    )
    assert response.status_code == error.status_code
    data = response.json()["error"]
    assert data["code"] == error.code
    assert data["message"] == error.message
    assert data["status_code"] == error.status_code
