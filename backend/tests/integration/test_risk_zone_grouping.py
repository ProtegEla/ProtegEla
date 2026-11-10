"""RN03: distâncias reais, fontes mistas e atualização da composição."""

from datetime import date
from uuid import uuid4

import pytest
from conftest import new_user
from geoalchemy2 import WKTElement
from sqlalchemy import text
from shapely.geometry import shape
from src.modules.reports.models import Report
from src.modules.risk_zones.models import SSPSafetyRecord
from src.modules.risk_zones.service import RiskZoneService


async def add_report(session, user, distance, **changes):
    location = await session.scalar(
        text(
            """
        SELECT ST_AsEWKT(ST_Project(
          'SRID=4326;POINT(-46.63 -23.55)'::geography, CAST(:distance AS double precision), 0::double precision)::geometry)
    """
        ),
        {"distance": distance},
    )
    report = Report(
        author_id=user.id,
        category="Furto",
        location=WKTElement(location, extended=True),
        incident_date=date(2026, 1, 1),
        incident_period="noite",
        is_anonymous=True,
        **changes
    )
    session.add(report)
    await session.flush()
    return report


@pytest.mark.anyio
@pytest.mark.parametrize(
    "distance,count", [(19.99, 1), (20, 1), (20.0001, 2), (20.01, 2)]
)
async def test_twenty_meter_boundary(test_db, distance, count):
    async with test_db() as session:
        user = new_user()
        session.add(user)
        await session.flush()
        await add_report(session, user, 0)
        await add_report(session, user, distance)
        await session.commit()
        zones = await RiskZoneService(session).group()
        assert len(zones) == count
        for zone in zones:
            geometry = shape(zone.geometry)
            assert geometry.is_valid
            assert geometry.covers(shape(zone.marker_location))
            assert zone.geometry["type"] in {"Point", "Polygon", "MultiPolygon"}
            assert all(geometry.covers(shape(i.location)) for i in zone.incidents)


@pytest.mark.anyio
async def test_chain_and_mixed_sources_are_recomputed(test_db):
    async with test_db() as session:
        user = new_user()
        session.add(user)
        await session.flush()
        first = await add_report(session, user, 0)
        bridge = await add_report(session, user, 19)
        last = await add_report(session, user, 38)
        last.category = "Violência"
        # Mesmo UUID em tabelas distintas continua representando dois incidentes.
        official = SSPSafetyRecord(
            id=first.id,
            source_key="f" * 64,
            source_version=1,
            location=first.location,
            incident_date=date(2026, 1, 2),
            is_active=True,
            source_url="https://www.ssp.sp.gov.br/fixture",
            source_period="2026",
            file_sha256="a" * 64,
        )
        session.add(official)
        await session.commit()
        service = RiskZoneService(session)
        (zone,) = await service.group()
        assert len(zone.incidents) == 4
        assert zone.categories == ("Furto", "Violência")
        assert zone.sources == ("app", "ssp")
        assert (await service.group())[0].id == zone.id
        # Ocultação da ponte divide o componente, sem retirar pontos SSP.
        bridge.is_hidden = True
        await session.commit()
        split = await service.group()
        assert sorted(len(z.incidents) for z in split) == [1, 2]
        assert zone.id not in {z.id for z in split}
        # Desativação SSP e exclusão/edição de relato são refletidas sem cache.
        official.is_active = False
        await session.delete(last)
        first.location = bridge.location
        await session.commit()
        (remaining,) = await service.group()
        assert remaining.geometry["type"] == "Point"
        assert remaining.sources == ("app",)
        assert remaining.incidents[0].id == first.id


@pytest.mark.anyio
async def test_empty_hidden_and_inactive_do_not_generate_zones(test_db):
    async with test_db() as session:
        assert await RiskZoneService(session).group() == []
        user = new_user()
        session.add(user)
        await session.flush()
        await add_report(session, user, 0, is_hidden=True)
        session.add(
            SSPSafetyRecord(
                source_key=uuid4().hex * 2,
                source_version=1,
                is_active=False,
                source_url="https://www.ssp.sp.gov.br/fixture",
                source_period="2026",
                file_sha256="a" * 64,
            )
        )
        await session.commit()
        assert await RiskZoneService(session).group() == []
