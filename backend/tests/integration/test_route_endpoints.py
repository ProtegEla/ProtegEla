from unittest.mock import AsyncMock

import pytest
from src.core.exceptions import BusinessRuleException, ExternalServiceException
from src.main import app
from src.modules.routes.clients import ORSResponse
from src.modules.routes.router import get_risk_evaluator, get_route_service
from src.modules.routes.service import RouteService

PAYLOAD = {
    "origin": {"latitude": -23.5, "longitude": -46.6},
    "destination": {"latitude": -23.5, "longitude": -46.59},
}


@pytest.fixture
def route_provider():
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.return_value = ORSResponse.model_validate(
        {
            "metadata": {"attribution": "ORS / OSM"},
            "features": [
                {
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-46.6, -23.5], [-46.59, -23.5]],
                    },
                    "properties": {
                        "segments": [
                            {
                                "distance": 1000,
                                "duration": 700,
                                "steps": [
                                    {
                                        "instruction": "Siga em frente",
                                        "distance": 1000,
                                        "duration": 700,
                                        "way_points": [0, 1],
                                    }
                                ],
                            }
                        ]
                    },
                }
            ],
        }
    )
    service = RouteService(client, requests_per_minute=1)
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_route_service] = lambda: service
    app.dependency_overrides[get_risk_evaluator] = lambda: None
    yield client
    app.dependency_overrides.clear()
    app.dependency_overrides.update(previous)


@pytest.mark.anyio
async def test_public_calculation_and_rate_limit(async_client, route_provider):
    response = await async_client.post("/api/v1/routes/calculate", json=PAYLOAD)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()["data"]
    route = data["routes"][0]
    assert route["duration_s"] == 700
    assert route["geometry"]["coordinates"][0] == [-46.6, -23.5]
    assert route["risk"] == {"status": "unavailable", "exposure_score": None}
    assert data["comparison"]["fastest_route_id"] == route["id"]
    assert data["comparison"]["lower_risk_route_id"] is None
    assert data["comparison"]["exceeds_30_percent"] is None
    assert data["attribution"] == "ORS / OSM"
    response = await async_client.post("/api/v1/routes/calculate", json=PAYLOAD)
    assert response.status_code == 429
    assert route_provider.alternatives.await_count == 1


@pytest.mark.anyio
@pytest.mark.parametrize(
    "update",
    [
        {"origin": {"latitude": 91, "longitude": 0}},
        {"origin": {"latitude": True, "longitude": 0}},
        {"origin": {"latitude": "-23.5", "longitude": 0}},
        {"origin": {"latitude": "NaN", "longitude": 0}},
        {"origin": PAYLOAD["destination"]},
        {"destination": None},
        {"stops": [PAYLOAD["origin"]] * 4},
        {"user_id": "someone"},
    ],
)
async def test_invalid_input(async_client, route_provider, update):
    response = await async_client.post(
        "/api/v1/routes/calculate", json={**PAYLOAD, **update}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    route_provider.alternatives.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "error,code,status",
    [
        (ExternalServiceException(), "EXTERNAL_SERVICE_UNAVAILABLE", 503),
        (
            BusinessRuleException("Sem caminho", code="ROUTE_NOT_FOUND"),
            "ROUTE_NOT_FOUND",
            422,
        ),
    ],
)
async def test_error_envelopes(async_client, route_provider, error, code, status):
    route_provider.alternatives.side_effect = error
    response = await async_client.post("/api/v1/routes/calculate", json=PAYLOAD)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code


@pytest.mark.anyio
async def test_navigation_payload_preserves_stop_order_and_global_instruction_indices(
    async_client, route_provider
):
    from copy import deepcopy

    first = route_provider.alternatives.return_value
    second_data = deepcopy(first.model_dump())
    second_data["features"][0]["geometry"]["coordinates"] = [
        (-46.59, -23.5),
        (-46.58, -23.5),
    ]
    second = ORSResponse.model_validate(second_data)
    route_provider.alternatives.side_effect = [first, second]
    response = await async_client.post(
        "/api/v1/routes/calculate",
        json={
            **PAYLOAD,
            "stops": [PAYLOAD["destination"]],
            "destination": {"latitude": -23.5, "longitude": -46.58},
        },
    )
    assert response.status_code == 200
    route = response.json()["data"]["routes"][0]
    assert route["geometry"]["coordinates"] == [
        [-46.6, -23.5],
        [-46.59, -23.5],
        [-46.58, -23.5],
    ]
    assert [leg["steps"][0]["way_points"] for leg in route["legs"]] == [[0, 1], [1, 2]]
    assert route["duration_s"] == sum(leg["duration_s"] for leg in route["legs"])
    assert route["distance_m"] == sum(leg["distance_m"] for leg in route["legs"])
    assert route_provider.alternatives.await_count == 2
