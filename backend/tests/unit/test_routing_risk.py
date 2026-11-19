from datetime import date
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from src.core.exceptions import ExternalServiceException
from src.modules.risk_zones.service import calendar_months_before, routing_weights
from src.modules.routes.clients import ORSResponse
from src.modules.routes.schemas import RouteCalculate, RouteRisk
from src.modules.routes.service import RouteRiskEvaluator, RouteService


def incident(
    source="app", confirmations=0, day=date(2026, 11, 18), activity=date(2026, 11, 18)
):
    identity = uuid4()
    point = {"type": "Point", "coordinates": [-46.63, -23.55]}
    return {
        "key": f"{source}:{identity}",
        "id": identity,
        "source": source,
        "category": "Furto",
        "description": None,
        "incident_date": day,
        "location": point,
        "buffer": point,
        "neighbors": [],
        "confirmations": confirmations,
        "last_activity": activity,
    }


def grouped(*rows):
    for row in rows:
        row["neighbors"] = [other["key"] for other in rows if other is not row]
    return list(rows)


def test_eligibility_does_not_sum_votes_between_reports():
    today = date(2026, 11, 18)
    assert (
        routing_weights(
            grouped(incident(confirmations=2), incident(confirmations=2)), today
        )
        == []
    )
    result = routing_weights(grouped(incident(confirmations=3), incident()), today)
    assert len(result) == 2
    assert {row["score"] for row in result} == {5}
    assert len({row["group_id"] for row in result}) == 1


def test_temporal_weights_and_ssp_floor():
    today = date(2026, 11, 18)
    rows = grouped(
        incident(activity=date(2026, 5, 17)),
        incident("ssp", day=date(2025, 11, 17), activity=None),
    )
    assert {row["score"] for row in routing_weights(rows, today)} == {1}
    rows[0]["last_activity"] = date(2026, 5, 18)
    assert {row["score"] for row in routing_weights(rows, today)} == {1.5}
    rows[1]["incident_date"] = date(2025, 11, 18)
    assert {row["score"] for row in routing_weights(rows, today)} == {3}
    rows[1]["incident_date"] = date(2026, 11, 19)
    assert routing_weights(rows, today) == []
    assert calendar_months_before(date(2024, 8, 31), 6) == date(2024, 2, 29)


def alternatives():
    features = []
    for index, duration in enumerate((100, 110, 120, 131)):
        # Dividir em dois pares de trechos nos testes não é necessário para a seleção:
        # cliente real limita a 3; duas chamadas combinadas podem gerar até 81.
        features.append(
            {
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-46.63, -23.55],
                        [-46.629, -23.55 - index * 0.0001],
                        [-46.628, -23.55],
                    ],
                },
                "properties": {
                    "segments": [
                        {
                            "distance": 200,
                            "duration": duration,
                            "steps": [
                                {
                                    "instruction": "Siga",
                                    "distance": 200,
                                    "duration": duration,
                                    "way_points": [0, 2],
                                }
                            ],
                        }
                    ]
                },
            }
        )
    return features


@pytest.mark.anyio
@pytest.mark.parametrize(
    "duration,warning", [(129.99, False), (130, False), (130.01, True)]
)
async def test_comparison_thirty_percent(duration, warning):
    features = alternatives()[:2]
    segment = features[1]["properties"]["segments"][0]
    segment["duration"] = duration
    segment["steps"][0]["duration"] = duration
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.return_value = ORSResponse.model_validate(
        {"features": features, "metadata": {"attribution": "OSM"}}
    )
    evaluator = AsyncMock()
    evaluator.evaluate.return_value = [
        RouteRisk(status="evaluated", exposure_score=10),
        RouteRisk(status="evaluated", exposure_score=2),
    ]
    request = RouteCalculate(
        origin={"latitude": -23.55, "longitude": -46.63},
        destination={"latitude": -23.55, "longitude": -46.628},
    )
    result = await RouteService(client).calculate(request, evaluator)
    assert result.comparison.exceeds_30_percent is warning
    assert result.comparison.lower_risk_route_id == result.routes[1].id


@pytest.mark.anyio
async def test_risk_evaluator_absent_data_failure_and_success():
    from types import SimpleNamespace

    from src.modules.routes.schemas import RouteGeometry

    route = SimpleNamespace(
        geometry=RouteGeometry(
            type="LineString", coordinates=[(-46.63, -23.55), (-46.629, -23.55)]
        )
    )
    risk = AsyncMock()
    roads = AsyncMock()
    evaluator = RouteRiskEvaluator(risk, roads)
    risk.snapshot.return_value = ([], [])
    assert (await evaluator.evaluate([route]))[0].status == "no_mapped_data"
    roads.roads.assert_not_awaited()
    row = incident("ssp")
    risk.snapshot.return_value = ([row], routing_weights([row], date(2026, 11, 18)))
    roads.roads.side_effect = ExternalServiceException()
    assert (await evaluator.evaluate([route]))[0].status == "unavailable"
    roads.roads.side_effect = None
    risk.exposures.return_value = [100]
    assert (await evaluator.evaluate([route]))[0].exposure_score == 100


@pytest.mark.anyio
async def test_lowest_exposure_is_preserved_even_outside_three_fastest():
    from copy import deepcopy

    features = alternatives()[:2]
    second = deepcopy(features)
    for feature in second:
        for point in feature["geometry"]["coordinates"]:
            point[0] += 0.002
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.side_effect = [
        ORSResponse.model_validate(
            {"features": group, "metadata": {"attribution": "OSM"}}
        )
        for group in (features, second)
    ]
    evaluator = AsyncMock()
    evaluator.evaluate.return_value = [
        RouteRisk(status="evaluated", exposure_score=score) for score in (10, 8, 5, 0)
    ]
    request = RouteCalculate(
        origin={"latitude": -23.55, "longitude": -46.63},
        stops=[{"latitude": -23.55, "longitude": -46.628}],
        destination={"latitude": -23.55, "longitude": -46.626},
    )
    result = await RouteService(client).calculate(request, evaluator)
    assert len(evaluator.evaluate.await_args.args[0]) == 4
    assert len(result.routes) == 3
    assert result.routes[-1].risk.exposure_score == 0
    assert result.comparison.lower_risk_route_id == result.routes[-1].id


@pytest.mark.anyio
@pytest.mark.parametrize("failure", [False, True])
async def test_road_client_filters_access_and_retains_grade_information(
    monkeypatch, failure
):
    from types import SimpleNamespace

    import httpx
    from src.modules.routes.clients import OverpassRoadClient

    original = httpx.AsyncClient

    def handler(request):
        assert request.method == "POST"
        assert b"highway" in request.content
        if failure:
            return httpx.Response(200, json={"elements": [], "remark": "timeout"})
        return httpx.Response(
            200,
            json={
                "elements": [
                    {
                        "type": "way",
                        "id": i,
                        "tags": tags,
                        "geometry": [
                            {"lat": -23.55, "lon": -46.63},
                            {"lat": -23.55, "lon": -46.629},
                        ],
                    }
                    for i, tags in enumerate(
                        [
                            {"highway": "residential"},
                            {"highway": "motorway"},
                            {"highway": "footway", "foot": "no"},
                            {"highway": "footway", "bridge": "yes"},
                            {"highway": "service", "access": "private"},
                            {"highway": "path", "access": "private", "foot": "yes"},
                        ]
                    )
                ]
            },
        )

    monkeypatch.setattr(
        "src.modules.routes.clients.httpx",
        SimpleNamespace(
            AsyncClient=lambda **kw: original(
                transport=httpx.MockTransport(handler), **kw
            ),
            HTTPError=httpx.HTTPError,
        ),
    )
    client = OverpassRoadClient("https://overpass.test")
    if failure:
        with pytest.raises(ExternalServiceException):
            await client.roads((-46.64, -23.56, -46.62, -23.54))
    else:
        roads = await client.roads((-46.64, -23.56, -46.62, -23.54))
        assert [row["id"] for row in roads] == ["0", "3", "5"]
        assert roads[1]["ground"] is False


@pytest.mark.anyio
@pytest.mark.parametrize(
    "risks,status",
    [
        (
            [RouteRisk(status="evaluated", exposure_score=0)] * 2,
            "no_lower_risk_alternative",
        ),
        ([RouteRisk(status="no_mapped_data")] * 2, "no_mapped_data"),
        (
            [RouteRisk(status="evaluated", exposure_score=10), RouteRisk()],
            "risk_unavailable",
        ),
    ],
)
async def test_comparison_does_not_invent_safety_when_exposure_is_equal_or_missing(
    risks, status
):
    client = AsyncMock(timeout_seconds=8)
    client.alternatives.return_value = ORSResponse.model_validate(
        {"features": alternatives()[:2], "metadata": {"attribution": "OSM"}}
    )
    evaluator = AsyncMock()
    evaluator.evaluate.return_value = risks
    request = RouteCalculate(
        origin={"latitude": -23.55, "longitude": -46.63},
        destination={"latitude": -23.55, "longitude": -46.628},
    )
    comparison = (await RouteService(client).calculate(request, evaluator)).comparison
    assert comparison.status == status
    assert comparison.lower_risk_route_id is None
    assert comparison.extra_duration_percent is None
    assert comparison.exceeds_30_percent is None


@pytest.mark.anyio
async def test_database_failure_preserves_unavailable_risk():
    from types import SimpleNamespace

    from sqlalchemy.exc import OperationalError
    from src.modules.routes.schemas import RouteGeometry

    risk = AsyncMock()
    risk.snapshot.side_effect = OperationalError("statement", {}, Exception("offline"))
    roads = AsyncMock()
    route = SimpleNamespace(
        geometry=RouteGeometry(
            type="LineString", coordinates=[(-46.63, -23.55), (-46.629, -23.55)]
        )
    )
    result = await RouteRiskEvaluator(risk, roads).evaluate([route])
    assert result == [RouteRisk()]
    roads.roads.assert_not_awaited()
