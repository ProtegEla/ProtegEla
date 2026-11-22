import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from src.core.exceptions import (
    AppException,
    BusinessRuleException,
    ExternalServiceException,
)
from src.modules.routes.clients import OpenRouteServiceClient, ORSResponse
from src.modules.routes.schemas import RouteCalculate
from src.modules.routes.service import RouteService


def response_for(start, end, duration=100, middle=None):
    coordinates = [start, end] if middle is None else [start, middle, end]
    return {
        "metadata": {"attribution": "openrouteservice | OpenStreetMap contributors"},
        "features": [
            {
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {
                    "segments": [
                        {
                            "distance": 100,
                            "duration": duration,
                            "steps": [
                                {
                                    "instruction": "Siga em frente",
                                    "distance": 100,
                                    "duration": duration,
                                    "way_points": [0, len(coordinates) - 1],
                                }
                            ],
                        }
                    ]
                },
            }
        ],
    }


@pytest.mark.anyio
async def test_composition_sorts_deduplicates_and_offsets_steps():
    points = [{"latitude": -23.5, "longitude": lon} for lon in (-46.6, -46.59, -46.58)]
    request = RouteCalculate(origin=points[0], stops=[points[1]], destination=points[2])
    a, b, c = [p.coordinate() for p in request.points()]
    first = response_for(a, b, 200)
    first["features"] += response_for(a, b, 100, (-46.595, -23.501))["features"]
    first["features"].append(first["features"][0])
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.side_effect = [
        ORSResponse.model_validate(first),
        ORSResponse.model_validate(response_for(b, c)),
    ]
    result = await RouteService(client).calculate(request)
    assert len(result.routes) == 2
    route = result.routes[0]
    assert route.duration_s == 200
    assert route.distance_m == 200
    assert route.geometry.coordinates == [a, (-46.595, -23.501), b, c]
    assert route.legs[1].steps[0].way_points == (2, 3)
    assert result.comparison.fastest_route_id == route.id
    assert result.comparison.status == "risk_unavailable"
    assert route.risk.exposure_score is None
    assert result.comparison.exceeds_30_percent is None
    assert client.alternatives.await_args_list[0].args == (
        request.origin,
        request.stops[0],
    )
    assert client.alternatives.await_args_list[1].args == (
        request.stops[0],
        request.destination,
    )


@pytest.mark.anyio
async def test_disconnected_legs_are_rejected():
    request = RouteCalculate(
        origin={"latitude": 0, "longitude": 0},
        stops=[{"latitude": 0, "longitude": 0.01}],
        destination={"latitude": 0, "longitude": 0.02},
    )
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.side_effect = [
        ORSResponse.model_validate(response_for((0, 0), (0.01, 0))),
        ORSResponse.model_validate(response_for((0.011, 0), (0.02, 0))),
    ]
    with pytest.raises(ExternalServiceException):
        await RouteService(client).calculate(request)


@pytest.mark.anyio
async def test_limit_expiration_and_distance_limit(monkeypatch):
    request = RouteCalculate(
        origin={"latitude": 0, "longitude": 0},
        destination={"latitude": 0, "longitude": 0.01},
    )
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.return_value = ORSResponse.model_validate(
        response_for((0, 0), (0.01, 0))
    )
    service = RouteService(client, requests_per_minute=1)
    monkeypatch.setattr("src.modules.routes.service.monotonic", lambda: 0)
    await service.calculate(request)
    with pytest.raises(AppException) as error:
        await service.calculate(request)
    assert error.value.status_code == 429
    monkeypatch.setattr("src.modules.routes.service.monotonic", lambda: 60)
    await service.calculate(request)
    request.destination.longitude = 1
    with pytest.raises(BusinessRuleException):
        await service.calculate(request)
    assert client.alternatives.await_count == 2


@pytest.mark.anyio
async def test_total_timeout():
    async def slow(*args):
        await asyncio.sleep(1)

    request = RouteCalculate(
        origin={"latitude": 0, "longitude": 0},
        destination={"latitude": 0, "longitude": 0.01},
    )
    client = AsyncMock(timeout_seconds=0.001)
    client.alternatives.side_effect = slow
    with pytest.raises(ExternalServiceException):
        await RouteService(client).calculate(request)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "failure",
    [
        None,
        "timeout",
        "quota",
        "missing",
        "indices",
        "nan",
        "json",
        "no_route",
        "no_point",
    ],
)
async def test_provider_contract(monkeypatch, failure):
    def handler(request):
        assert (
            request.url.path == "/openrouteservice/v2/directions/foot-walking/geojson"
        )
        assert request.headers["Authorization"] == "test-key"
        assert request.url.query == b""
        body = json.loads(request.content)
        assert body["coordinates"] == [[-46.6, -23.5], [-46.59, -23.5]]
        assert body["language"] in ("pt", "pt-br")
        assert body["alternative_routes"] == {"target_count": 3}
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if failure == "quota":
            return httpx.Response(429)
        if failure == "json":
            return httpx.Response(200, text="invalid")
        if failure in ("no_route", "no_point"):
            return httpx.Response(
                404, json={"error": {"code": 2009 if failure == "no_route" else 2010}}
            )
        data = response_for((-46.6, -23.5), (-46.59, -23.5))
        if failure == "missing":
            data = {}
        if failure == "indices":
            data["features"][0]["properties"]["segments"][0]["steps"][0][
                "way_points"
            ] = [0, 99]
        if failure == "nan":
            data["features"][0]["geometry"]["coordinates"][0] = ["NaN", -23.5]
        return httpx.Response(200, json=data)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        "src.modules.routes.clients.httpx",
        SimpleNamespace(
            AsyncClient=lambda **kw: real_client(
                transport=httpx.MockTransport(handler), **kw
            ),
            HTTPError=httpx.HTTPError,
        ),
    )
    client = OpenRouteServiceClient("https://ors.test/openrouteservice", "test-key")
    request = RouteCalculate(
        origin={"latitude": -23.5, "longitude": -46.6},
        destination={"latitude": -23.5, "longitude": -46.59},
    )
    if failure:
        expected = (
            BusinessRuleException
            if failure in ("no_route", "no_point")
            else ExternalServiceException
        )
        with pytest.raises(expected):
            await client.alternatives(request.origin, request.destination)
    else:
        assert (
            len(
                (
                    await client.alternatives(request.origin, request.destination)
                ).features
            )
            == 1
        )


@pytest.mark.anyio
async def test_missing_key():
    request = RouteCalculate(
        origin={"latitude": 0, "longitude": 0},
        destination={"latitude": 0, "longitude": 0.01},
    )
    with pytest.raises(ExternalServiceException):
        await OpenRouteServiceClient("https://ors.test", "").alternatives(
            request.origin, request.destination
        )


@pytest.mark.anyio
async def test_three_stops_use_four_calls_and_return_at_most_three_routes():
    points = [{"latitude": -23.5, "longitude": -46.6 + i * 0.01} for i in range(5)]
    request = RouteCalculate(origin=points[0], stops=points[1:4], destination=points[4])
    client = AsyncMock(timeout_seconds=8)
    results = []
    for i, (a, b) in enumerate(zip(request.points(), request.points()[1:])):
        data = response_for(a.coordinate(), b.coordinate())
        data["features"] += response_for(
            a.coordinate(), b.coordinate(), 200, (a.longitude + 0.005, -23.501)
        )["features"]
        results.append(ORSResponse.model_validate(data))
    client.alternatives.side_effect = results
    result = await RouteService(client).calculate(request)
    assert client.alternatives.await_count == 4
    assert len(result.routes) == 3
    assert all(len(route.legs) == 4 for route in result.routes)
    assert result.routes[0].duration_s == 400


@pytest.mark.anyio
async def test_failure_on_second_leg_returns_no_partial_itinerary():
    request = RouteCalculate(
        origin={"latitude": 0, "longitude": 0},
        stops=[{"latitude": 0, "longitude": 0.01}],
        destination={"latitude": 0, "longitude": 0.02},
    )
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.side_effect = [
        ORSResponse.model_validate(response_for((0, 0), (0.01, 0))),
        BusinessRuleException("Sem caminho", code="ROUTE_NOT_FOUND"),
    ]
    with pytest.raises(BusinessRuleException):
        await RouteService(client).calculate(request)
