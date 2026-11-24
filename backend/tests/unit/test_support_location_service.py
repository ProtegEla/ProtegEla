from unittest.mock import AsyncMock, Mock

import pytest

from src.modules.support_locations.adapters import OverpassAdapter
from src.modules.support_locations.clients import OverpassClient
from src.modules.support_locations.schemas import SupportLocation
from src.modules.support_locations.service import SupportLocationService


@pytest.mark.anyio
async def test_returns_stations_sorted_by_haversine_distance() -> None:
    """O serviço deve retornar todas as delegacias ordenadas por distância."""
    stations = [
        SupportLocation(id="node/1", name="Longe", latitude=-23.60, longitude=-46.70),
        SupportLocation(id="node/2", name="Perto", latitude=-23.551, longitude=-46.631),
        SupportLocation(id="node/3", name="Média", latitude=-23.56, longitude=-46.65),
    ]
    overpass_client = AsyncMock(spec=OverpassClient)
    overpass_client.find_police_stations.return_value = [
        {"type": "node", "id": i} for i in range(1, 4)
    ]
    adapter = Mock(spec=OverpassAdapter)
    adapter.to_support_locations.return_value = stations

    service = SupportLocationService(
        overpass_client=overpass_client,
        overpass_adapter=adapter,
    )

    results = await service.find_nearby_police_stations(-23.55, -46.63)

    assert [loc.name for loc in results] == ["Perto", "Média", "Longe"]
    assert all(r.distance_m >= 0 for r in results)
    assert results[0].distance_m <= results[1].distance_m <= results[2].distance_m
    overpass_client.find_police_stations.assert_awaited_once_with(
        latitude=-23.55,
        longitude=-46.63,
        radius_m=5000,
    )


@pytest.mark.anyio
async def test_returns_empty_list_when_overpass_finds_no_stations() -> None:
    overpass_client = AsyncMock(spec=OverpassClient)
    overpass_client.find_police_stations.return_value = []
    adapter = Mock(spec=OverpassAdapter)
    adapter.to_support_locations.return_value = []

    service = SupportLocationService(
        overpass_client=overpass_client,
        overpass_adapter=adapter,
    )

    results = await service.find_nearby_police_stations(-23.55, -46.63)

    assert results == []
