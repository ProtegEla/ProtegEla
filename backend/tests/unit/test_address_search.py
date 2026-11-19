from unittest.mock import AsyncMock

import httpx
import pytest
from src.core.exceptions import AppException, ExternalServiceException
from src.modules.addresses.clients import OpenRouteServiceGeocodingClient
from src.modules.addresses.schemas import AddressSuggestion
from src.modules.addresses.service import AddressService


@pytest.mark.anyio
async def test_service_preserves_ranking_deduplicates_and_limits():
    first = AddressSuggestion(
        id="osm:1", label="Paulista", latitude=-23.5, longitude=-46.6
    )
    second = first.model_copy(update={"id": "osm:2"})
    client = AsyncMock()
    client.autocomplete.return_value = [first, first, second]
    service = AddressService(client, requests_per_minute=1)
    assert await service.suggest("  Paulista  ", 1) == [first]
    client.autocomplete.assert_awaited_once_with("Paulista")
    with pytest.raises(AppException) as error:
        await service.suggest("Paulista", 5)
    assert error.value.status_code == 429
    assert client.autocomplete.await_count == 1


@pytest.mark.anyio
async def test_limit_expires(monkeypatch):
    client = AsyncMock()
    client.autocomplete.return_value = []
    service = AddressService(client, requests_per_minute=1)
    monkeypatch.setattr("src.modules.addresses.service.monotonic", lambda: 0)
    assert await service.suggest("Paulista", 5) == []
    monkeypatch.setattr("src.modules.addresses.service.monotonic", lambda: 60)
    assert await service.suggest("Paulista", 5) == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    "failure", [None, "timeout", "http", "json", "coordinates", "missing"]
)
async def test_geocoder_request_and_response(monkeypatch, failure):
    def handler(request):
        assert request.headers["Authorization"] == "test-key"
        assert "api_key" not in request.url.params
        assert request.url.params["boundary.country"] == "BRA"
        assert request.url.params["text"] == "Paulista"
        assert request.url.params["focus.point.lon"] == "-46.633308"
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if failure == "http":
            return httpx.Response(429)
        if failure == "json":
            return httpx.Response(200, text="invalid")
        if failure == "missing":
            return httpx.Response(200, json={})
        return httpx.Response(
            200,
            json={
                "features": [
                    {
                        "geometry": {
                            "type": "Point",
                            "coordinates": [-46.6, 100 if failure else -23.5],
                        },
                        "properties": {"gid": "osm:1", "label": "Paulista"},
                    }
                ]
            },
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    client = OpenRouteServiceGeocodingClient(
        "https://ors.test/pelias/v1/autocomplete", "test-key"
    )
    if failure:
        with pytest.raises(ExternalServiceException):
            await client.autocomplete("Paulista")
    else:
        assert (await client.autocomplete("Paulista"))[0].latitude == -23.5


@pytest.mark.anyio
async def test_missing_key_does_not_call_provider():
    with pytest.raises(ExternalServiceException):
        await OpenRouteServiceGeocodingClient("https://ors.test", "").autocomplete(
            "Paulista"
        )
