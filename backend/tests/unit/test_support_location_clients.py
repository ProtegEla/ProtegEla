import json

import httpx
import pytest

import src.modules.support_locations.clients as support_location_clients
from src.core.exceptions import ExternalServiceException
from src.modules.support_locations.schemas import SupportLocation


@pytest.fixture
def use_mock_transport(monkeypatch):
    real_async_client = httpx.AsyncClient

    def install(handler):
        transport = httpx.MockTransport(handler)

        def create_client(**kwargs):
            return real_async_client(transport=transport, **kwargs)

        monkeypatch.setattr(
            support_location_clients.httpx,
            "AsyncClient",
            create_client,
        )

    return install


@pytest.mark.anyio
async def test_overpass_client_sends_query_and_parses_elements(use_mock_transport) -> None:
    captured_requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(
            200,
            json={"elements": [{"type": "node", "id": 123}]},
        )

    use_mock_transport(handler)
    client = support_location_clients.OverpassClient(
        api_url="https://overpass.test/api/interpreter",
        timeout_seconds=10,
    )

    elements = await client.find_police_stations(-23.55, -46.63, radius_m=5000)

    assert elements == [{"type": "node", "id": 123}]
    request = captured_requests[0]
    assert request.method == "POST"
    assert request.url == "https://overpass.test/api/interpreter"
    assert b'nwr%5B%22amenity%22%3D%22police%22%5D' in request.content
    assert b"around%3A5000%2C-23.55%2C-46.63" in request.content


@pytest.mark.anyio
async def test_overpass_client_raises_external_error_for_http_failure(
    use_mock_transport,
) -> None:
    use_mock_transport(lambda _: httpx.Response(503))
    client = support_location_clients.OverpassClient(
        api_url="https://overpass.test/api/interpreter"
    )

    with pytest.raises(ExternalServiceException):
        await client.find_police_stations(-23.55, -46.63, radius_m=5000)


@pytest.mark.anyio
async def test_directions_client_sends_coordinates_and_parses_distance(
    use_mock_transport,
) -> None:
    captured_requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(
            200,
            json={"routes": [{"summary": {"distance": 1234.5}}]},
        )

    use_mock_transport(handler)
    client = support_location_clients.OpenRouteServiceDirectionsClient(
        api_url="https://ors.test/openrouteservice",
        api_key="test-key",
    )
    destination = SupportLocation(
        id="node/123",
        name="Delegacia Central",
        latitude=-23.56,
        longitude=-46.64,
    )

    distance = await client.walking_distance_m(-23.55, -46.63, destination)

    assert distance == 1234.5
    request = captured_requests[0]
    assert request.method == "POST"
    assert request.url == (
        "https://ors.test/openrouteservice/v2/directions/foot-walking"
    )
    assert request.headers["Authorization"] == "test-key"
    payload = json.loads(request.content)
    assert payload["coordinates"] == [
        [-46.63, -23.55],
        [-46.64, -23.56],
    ]
    assert payload["geometry"] is False
    assert payload["instructions"] is False


@pytest.mark.anyio
async def test_directions_client_raises_external_error_for_invalid_response(
    use_mock_transport,
) -> None:
    use_mock_transport(lambda _: httpx.Response(200, json={"routes": []}))
    client = support_location_clients.OpenRouteServiceDirectionsClient(
        api_url="https://ors.test/openrouteservice",
        api_key="test-key",
    )
    destination = SupportLocation(
        id="node/123",
        latitude=-23.56,
        longitude=-46.64,
    )

    with pytest.raises(ExternalServiceException):
        await client.walking_distance_m(-23.55, -46.63, destination)
