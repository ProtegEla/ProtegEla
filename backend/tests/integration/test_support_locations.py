from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from src.main import app
from src.modules.support_locations.router import get_support_location_service
from src.modules.support_locations.schemas import SupportLocationWithDistance
from src.modules.support_locations.service import SupportLocationService


@pytest.fixture
def route_service():
    service = AsyncMock(spec=SupportLocationService)
    service.find_nearest_police_stations.return_value = [
        SupportLocationWithDistance(
            id="node/123",
            name="Delegacia Central",
            latitude=-23.55,
            longitude=-46.63,
            distance_m=420,
        )
    ]

    async def override_service():
        return service

    previous_override = app.dependency_overrides.get(get_support_location_service)
    app.dependency_overrides[get_support_location_service] = override_service
    try:
        yield service
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_support_location_service, None)
        else:
            app.dependency_overrides[get_support_location_service] = previous_override


@pytest.mark.anyio
async def test_nearby_endpoint_returns_support_locations(
    async_client: AsyncClient,
    route_service: AsyncMock,
) -> None:
    response = await async_client.get(
        "/api/v1/support-locations/nearby",
        params={"latitude": -23.55, "longitude": -46.63},
    )

    assert response.status_code == 200
    assert response.json() == {
        "data": [
            {
                "id": "node/123",
                "name": "Delegacia Central",
                "latitude": -23.55,
                "longitude": -46.63,
                "distance_m": 420,
            }
        ]
    }
    route_service.find_nearest_police_stations.assert_awaited_once_with(
        latitude=-23.55,
        longitude=-46.63,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "params",
    [
        {"latitude": -91, "longitude": -46.63},
        {"latitude": -23.55, "longitude": 181},
        {"latitude": "nan", "longitude": -46.63},
        {"latitude": -23.55},
    ],
)
async def test_nearby_endpoint_rejects_invalid_coordinates(
    async_client: AsyncClient,
    route_service: AsyncMock,
    params: dict,
) -> None:
    response = await async_client.get(
        "/api/v1/support-locations/nearby",
        params=params,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    route_service.find_nearest_police_stations.assert_not_awaited()
