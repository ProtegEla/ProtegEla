"""Composição determinística e projeção sem autoria privada."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from shapely.geometry import Point, mapping
from sqlalchemy.ext.asyncio import AsyncSession
from src.modules.risk_zones.service import RiskZoneService, group_incidents


def members():
    ids = [UUID(int=n, version=4) for n in (1, 2, 3)]
    rows = []
    for index, uid in enumerate(ids):
        point = Point(-46.63 + index * 0.0001, -23.55)
        rows.append(
            dict(
                key=f"app:{uid}",
                id=uid,
                source="app",
                category="Furto",
                description=None,
                incident_date=date(2026, 1, 1),
                location=mapping(point),
                buffer=mapping(point.buffer(0.00006)),
                neighbors=[f"app:{ids[j]}" for j in range(3) if abs(index - j) == 1],
            )
        )
    return rows


def test_chain_is_order_independent_and_identity_tracks_membership():
    rows = members()
    (first,) = group_incidents(rows)
    (reverse,) = group_incidents(rows[::-1])
    assert first == reverse
    assert first.id.version == 5
    assert len(first.incidents) == 3
    rows[1]["neighbors"] = [rows[0]["key"]]
    rows[2]["neighbors"] = []
    split = group_incidents(rows)
    assert len(split) == 2
    assert first.id not in {zone.id for zone in split}


@pytest.mark.anyio
async def test_group_is_read_only_and_selects_only_public_fields():
    session = AsyncMock(spec=AsyncSession)
    result = MagicMock()
    result.mappings.return_value.all.return_value = members()
    session.execute.return_value = result
    (zone,) = await RiskZoneService(session).group()
    assert set(vars(zone.incidents[0])) == {
        "id",
        "source",
        "category",
        "description",
        "incident_date",
        "location",
    }
    session.commit.assert_not_awaited()
    session.flush.assert_not_awaited()
    session.add.assert_not_called()
