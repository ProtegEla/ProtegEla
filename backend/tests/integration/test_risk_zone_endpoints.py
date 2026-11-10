"""Consultas públicas de mapa com banco e serviço reais."""

from datetime import date
from uuid import uuid4, uuid5, NAMESPACE_URL

import pytest
from conftest import new_user
from src.modules.risk_zones.models import SSPSafetyRecord
from tests.integration.test_risk_zone_grouping import add_report

BASE = "/api/v1/risk-zones"
BBOX = "-46.631,-23.551,-46.629,-23.549"


@pytest.mark.anyio
async def test_public_geojson_navigation_and_stale_zone(async_client, test_db):
    async with test_db() as session:
        user = new_user()
        session.add(user)
        await session.flush()
        first = await add_report(session, user, 0)
        second = await add_report(session, user, 19)
        second.category = "Violência"
        await add_report(session, user, 0, is_hidden=True)
        session.add(
            SSPSafetyRecord(
                source_key="1" * 64,
                source_version=1,
                location=first.location,
                incident_date=date(2026, 1, 2),
                is_active=True,
                source_url="https://www.ssp.sp.gov.br/fixture",
                source_period="2026",
                file_sha256="a" * 64,
            )
        )
        await session.commit()
    response = await async_client.get(
        BASE, params={"bbox": BBOX}, headers={"Authorization": "Bearer invalid"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["meta"] == {"total_records": 1}
    assert body["data"]["type"] == "FeatureCollection"
    (feature,) = body["data"]["features"]
    assert set(feature) == {"type", "id", "geometry", "properties"}
    assert feature["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    props = feature["properties"]
    assert props["incidents_count"] == 3
    assert props["categories"] == ["Furto", "Violência"]
    assert props["sources"] == ["app", "ssp"]
    target = f'{BASE}/{feature["id"]}/incidents'
    first_page = (await async_client.get(target, params={"page_size": 2})).json()
    second_page = (
        await async_client.get(target, params={"page_size": 2, "page": 2})
    ).json()
    incidents = first_page["data"] + second_page["data"]
    assert len(incidents) == 3
    assert (
        first_page["meta"]["total_records"] == second_page["meta"]["total_records"] == 3
    )
    assert incidents[0]["source"] == "ssp" and incidents[0]["report_id"] is None
    assert set(incidents[0]) == {
        "id",
        "source",
        "category",
        "location",
        "description",
        "incident_date",
        "report_id",
    }
    for item in incidents:
        if item["source"] == "app":
            assert item["report_id"] == item["id"]
            assert (
                await async_client.get(f'/api/v1/reports/{item["report_id"]}')
            ).status_code == 200
    assert (await async_client.get(target, params={"page": 10})).json()["data"] == []
    # A caixa contém somente o primeiro ponto, mas preserva a composição inteira.
    clipped = await async_client.get(
        BASE, params={"bbox": "-46.63001,-23.55001,-46.62999,-23.54999"}
    )
    assert clipped.json()["data"]["features"][0]["id"] == feature["id"]
    async with test_db() as session:
        saved = await session.get(type(second), second.id)
        saved.is_hidden = True
        await session.commit()
    stale = await async_client.get(target)
    assert stale.status_code == 404 and stale.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.anyio
async def test_empty_bbox_border_and_validation(async_client, test_db):
    assert (await async_client.get(BASE, params={"bbox": BBOX})).json() == {
        "data": {"type": "FeatureCollection", "features": []},
        "meta": {"total_records": 0},
    }
    async with test_db() as session:
        user = new_user()
        session.add(user)
        await session.flush()
        await add_report(session, user, 0)
        await session.commit()
    # Ponto sobre o canto da caixa é incluído.
    border = await async_client.get(
        BASE, params={"bbox": "-46.63,-23.55,-46.629,-23.549"}
    )
    assert border.json()["meta"]["total_records"] == 1
    for params in ({}, {"bbox": "invalid"}, {"bbox": "-47,-24,-46,-23"}):
        response = await async_client.get(BASE, params=params)
        assert (
            response.status_code == 422
            and response.json()["error"]["code"] == "VALIDATION_ERROR"
        )
    missing = f'{BASE}/{uuid5(NAMESPACE_URL, "missing")}/incidents'
    assert (await async_client.get(missing)).status_code == 404
    for target in (
        f"{BASE}/invalid/incidents",
        f"{BASE}/{uuid4()}/incidents",
        missing + "?page=0",
        missing + "?page_size=101",
    ):
        assert (await async_client.get(target)).status_code == 422
    assert (await async_client.get(BASE + "/status")).status_code == 200
