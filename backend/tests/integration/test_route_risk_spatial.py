from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from conftest import new_user
from geoalchemy2 import WKTElement
from src.modules.reports.models import Report, ReportInteraction
from src.modules.risk_zones.models import SSPSafetyRecord
from src.modules.risk_zones.service import RoutingRiskService
from src.modules.routes.schemas import RouteGeometry


def road(identity, y, ground=True):
    return {
        "id": identity,
        "ground": ground,
        "geometry": {"type": "LineString", "coordinates": [[-46.631, y], [-46.629, y]]},
    }


def route(y, repeat=False):
    coordinates = [(-46.6308, y), (-46.6292, y)]
    if repeat:
        coordinates += [coordinates[0]]
    return SimpleNamespace(
        geometry=RouteGeometry(type="LineString", coordinates=coordinates)
    )


@pytest.mark.anyio
async def test_metric_matching_parallel_roads_and_repeated_traversals(test_db):
    async with test_db() as session:
        service = RoutingRiskService(session)
        roads = [road("a", -23.55), road("b", -23.5501)]
        incidents = [
            {
                "group_id": "zone",
                "score": 2,
                "geometry": {"type": "Point", "coordinates": [-46.63, -23.55]},
            }
        ]
        scores = await service.exposures(
            [route(-23.55), route(-23.5501), route(-23.55, True)], roads, incidents
        )
        assert scores[0] > 300
        assert scores[1] == 0
        assert scores[2] == pytest.approx(2 * scores[0])
        # Mesmo grupo atribuído duas vezes à mesma via não duplica sua pontuação.
        duplicated = await service.exposures([route(-23.55)], roads, incidents * 2)
        assert duplicated[0] == pytest.approx(scores[0])
        empty = await service.exposures([route(-23.55)], roads, [])
        assert empty == [0]


@pytest.mark.anyio
@pytest.mark.parametrize("case", ["tie", "bridge", "far", "route_gap", "overlap"])
async def test_ambiguous_or_missing_association_is_unavailable(test_db, case):
    async with test_db() as session:
        roads = [road("a", -23.55)]
        incident_y = -23.55
        if case == "tie":
            roads += [road("b", -23.5501)]
            incident_y = -23.55005
        if case == "bridge":
            roads[0]["ground"] = False
        if case == "far":
            incident_y = -23.551
        if case == "overlap":
            roads += [road("b", -23.55)]
        incidents = [
            {
                "group_id": "zone",
                "score": 2,
                "geometry": {"type": "Point", "coordinates": [-46.63, incident_y]},
            }
        ]
        with pytest.raises(ValueError):
            await RoutingRiskService(session).exposures(
                [route(-23.552 if case == "route_gap" else -23.55)], roads, incidents
            )


@pytest.mark.anyio
async def test_snapshot_uses_real_votes_visibility_and_active_ssp(test_db):
    async with test_db() as session:
        author = new_user()
        voters = [new_user() for _ in range(3)]
        session.add_all([author, *voters])
        await session.flush()
        report = Report(
            author_id=author.id,
            category="Furto",
            location=WKTElement("POINT(-46.63 -23.55)", srid=4326),
            incident_date=date(2026, 1, 1),
            incident_period="noite",
            is_anonymous=True,
        )
        session.add(report)
        await session.flush()
        for voter in voters:
            session.add(
                ReportInteraction(
                    report_id=report.id,
                    user_id=voter.id,
                    kind="confirmation",
                    created_at=datetime.now(UTC),
                )
            )
        await session.flush()
        service = RoutingRiskService(session)
        rows, weights = await service.snapshot()
        assert rows[0]["confirmations"] == 3
        assert weights[0]["score"] == 4
        report.is_hidden = True
        await session.flush()
        assert await service.snapshot() == ([], [])
        official = SSPSafetyRecord(
            source_key=uuid4().hex,
            source_version=1,
            category="Furto",
            location=report.location,
            incident_date=date(2020, 1, 1),
            is_active=True,
            source_url="https://example.test",
            source_period="2020",
            file_sha256="a" * 64,
        )
        session.add(official)
        await session.flush()
        assert (await service.snapshot())[1][0]["score"] == 0.5
        official.is_active = False
        await session.flush()
        assert await service.snapshot() == ([], [])


@pytest.mark.anyio
async def test_http_comparison_with_real_postgis_and_mocked_external_services(
    test_db, async_client
):
    from unittest.mock import AsyncMock

    from src.main import app
    from src.modules.routes.clients import ORSResponse
    from src.modules.routes.router import get_risk_evaluator, get_route_service
    from src.modules.routes.service import RouteRiskEvaluator, RouteService

    async with test_db() as session:
        session.add(
            SSPSafetyRecord(
                source_key=uuid4().hex,
                source_version=1,
                category="Furto",
                location=WKTElement("POINT(-46.63 -23.55)", srid=4326),
                incident_date=date(2026, 1, 1),
                is_active=True,
                source_url="https://example.test",
                source_period="2026",
                file_sha256="a" * 64,
            )
        )
        await session.flush()
        start, end = (-46.6308, -23.55), (-46.6292, -23.55)
        shapes = [[start, end], [start, (start[0], -23.5501), (end[0], -23.5501), end]]
        features = []
        for coordinates, duration in zip(shapes, [100, 131]):
            features.append(
                {
                    "geometry": {"type": "LineString", "coordinates": coordinates},
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
                                        "way_points": [0, len(coordinates) - 1],
                                    }
                                ],
                            }
                        ]
                    },
                }
            )
        client = AsyncMock(timeout_seconds=8)
        client.alternatives.return_value = ORSResponse.model_validate(
            {"features": features, "metadata": {"attribution": "ORS / OSM"}}
        )
        road_client = AsyncMock()
        road_client.roads.return_value = [
            road("a", -23.55),
            road("b", -23.5501),
            {
                "id": "c",
                "ground": True,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [start, (start[0], -23.5501)],
                },
            },
            {
                "id": "d",
                "ground": True,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [end, (end[0], -23.5501)],
                },
            },
        ]
        previous = app.dependency_overrides.copy()
        app.dependency_overrides[get_route_service] = lambda: RouteService(client)
        app.dependency_overrides[get_risk_evaluator] = lambda: RouteRiskEvaluator(
            RoutingRiskService(session), road_client
        )
        try:
            response = await async_client.post(
                "/api/v1/routes/calculate",
                json={
                    "origin": {"latitude": start[1], "longitude": start[0]},
                    "destination": {"latitude": end[1], "longitude": end[0]},
                },
            )
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["comparison"]["status"] == "lower_risk_available"
        assert data["comparison"]["exceeds_30_percent"] is True
        assert data["routes"][0]["risk"]["exposure_score"] > 0
        assert data["routes"][1]["risk"]["exposure_score"] == 0
