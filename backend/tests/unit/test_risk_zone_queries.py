"""Validação e limites das consultas de mapa."""

from dataclasses import replace
from unittest.mock import AsyncMock
from uuid import uuid4, uuid5, NAMESPACE_URL

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.exceptions import BusinessRuleException, EntityNotFoundException
from src.modules.risk_zones.service import RiskZoneService, group_incidents, parse_bbox
from tests.unit.test_risk_zone_components import members


@pytest.mark.parametrize(
    "value",
    [
        "",
        "1,2,3",
        "nan,0,1,2",
        "0,0,inf,1",
        "2,0,1,1",
        "-181,0,-180,1",
        "0,90,1,91",
        "-47,-24,-46,-23",
        "0,0,1,0",
        "x,1,2,3",
    ],
)
def test_invalid_bbox(value):
    with pytest.raises(BusinessRuleException):
        parse_bbox(value)


@pytest.mark.anyio
async def test_invalid_bbox_does_not_query_database():
    service = RiskZoneService(AsyncMock(spec=AsyncSession))
    with pytest.raises(BusinessRuleException):
        await service.list("bad")
    service.session.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_zone_limit_and_geometry_intersection():
    service = RiskZoneService(AsyncMock(spec=AsyncSession))
    (zone,) = group_incidents(members())
    service.group = AsyncMock(return_value=[zone])
    assert await service.list("-46.631,-23.551,-46.629,-23.549") == [zone]
    assert await service.list("-46.61,-23.551,-46.60,-23.549") == []
    service.group.return_value = [replace(zone, id=uuid4()) for _ in range(500)]
    assert len(await service.list("-46.631,-23.551,-46.629,-23.549")) == 500
    service.group.return_value.append(zone)
    with pytest.raises(BusinessRuleException):
        await service.list("-46.631,-23.551,-46.629,-23.549")


@pytest.mark.anyio
async def test_empty_page_count_and_missing_zone():
    service = RiskZoneService(AsyncMock(spec=AsyncSession))
    (zone,) = group_incidents(members())
    service.group = AsyncMock(return_value=[zone])
    assert await service.incidents(zone.id, page=10) == ((), 3)
    with pytest.raises(EntityNotFoundException):
        await service.incidents(uuid5(NAMESPACE_URL, "missing"))
    for kwargs in ({"page": 0}, {"page_size": 101}, {"page": True}):
        with pytest.raises(BusinessRuleException):
            await service.incidents(zone.id, **kwargs)
