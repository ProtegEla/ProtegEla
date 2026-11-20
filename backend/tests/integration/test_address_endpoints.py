from unittest.mock import AsyncMock

import pytest
from src.core.exceptions import ExternalServiceException
from src.main import app
from src.modules.addresses.router import get_address_service
from src.modules.addresses.schemas import AddressSuggestion
from src.modules.addresses.service import AddressService


@pytest.fixture
def address_client():
    client = AsyncMock()
    client.autocomplete.return_value = [
        AddressSuggestion(
            id="osm:1", label="Avenida Paulista", latitude=-23.56, longitude=-46.65
        )
    ]
    service = AddressService(client, requests_per_minute=2)
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_address_service] = lambda: service
    yield client
    app.dependency_overrides.clear()
    app.dependency_overrides.update(previous)


@pytest.mark.anyio
async def test_public_search_returns_coordinates(async_client, address_client):
    response = await async_client.get(
        "/api/v1/addresses/suggestions", params={"q": " Paulista "}
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "data": [
            {
                "id": "osm:1",
                "label": "Avenida Paulista",
                "latitude": -23.56,
                "longitude": -46.65,
            }
        ]
    }
    address_client.autocomplete.assert_awaited_once_with("Paulista")


@pytest.mark.anyio
@pytest.mark.parametrize(
    "params",
    [
        {},
        {"q": "ab"},
        {"q": "   "},
        {"q": "a" * 201},
        {"q": "Paulista", "limit": 0},
        {"q": "Paulista", "limit": 11},
    ],
)
async def test_invalid_search(async_client, address_client, params):
    response = await async_client.get("/api/v1/addresses/suggestions", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    address_client.autocomplete.assert_not_awaited()


@pytest.mark.anyio
async def test_empty_failure_and_limit(async_client, address_client):
    address_client.autocomplete.return_value = []
    response = await async_client.get("/api/v1/addresses/suggestions?q=Paulista")
    assert response.json() == {"data": []}
    address_client.autocomplete.side_effect = ExternalServiceException()
    response = await async_client.get("/api/v1/addresses/suggestions?q=Paulista")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "EXTERNAL_SERVICE_UNAVAILABLE"
    response = await async_client.get("/api/v1/addresses/suggestions?q=Paulista")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
