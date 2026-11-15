from unittest.mock import AsyncMock, Mock

import pytest

from src.modules.support_locations.adapters import OverpassAdapter
from src.modules.support_locations.clients import (
    OpenRouteServiceDirectionsClient,
    OverpassClient,
)
from src.modules.support_locations.schemas import SupportLocation
from src.modules.support_locations.service import SupportLocationService


@pytest.mark.anyio
async def test_returns_five_nearest_stations_sorted_by_walking_distance() -> None:
    stations = [
        SupportLocation(
            id=f"node/{index}",
            name=f"Delegacia {index}",
            latitude=-23.55,
            longitude=-46.63,
        )
        for index in range(1, 7)
    ]
    overpass_client = AsyncMock(spec=OverpassClient)
    overpass_client.find_police_stations.return_value = [
        {"type": "node", "id": index} for index in range(1, 7)
    ]
    adapter = Mock(spec=OverpassAdapter)
    adapter.to_support_locations.return_value = stations

    directions_client = AsyncMock(spec=OpenRouteServiceDirectionsClient)
    directions_client.walking_distance_m.side_effect = [600, 100, 500, 200, 400, 300]

    service = SupportLocationService(
        overpass_client=overpass_client,
        directions_client=directions_client,
        overpass_adapter=adapter,
    )

    results = await service.find_nearest_police_stations(-23.55, -46.63)

    assert [location.name for location in results] == [
        "Delegacia 2",
        "Delegacia 4",
        "Delegacia 6",
        "Delegacia 5",
        "Delegacia 3",
    ]
    assert [location.distance_m for location in results] == [100, 200, 300, 400, 500]
    overpass_client.find_police_stations.assert_awaited_once_with(
        latitude=-23.55,
        longitude=-46.63,
        radius_m=5000,
    )
    assert directions_client.walking_distance_m.await_count == 6


@pytest.mark.anyio
async def test_returns_empty_list_when_overpass_finds_no_stations() -> None:
    overpass_client = AsyncMock(spec=OverpassClient)
    overpass_client.find_police_stations.return_value = []
    adapter = Mock(spec=OverpassAdapter)
    adapter.to_support_locations.return_value = []
    directions_client = AsyncMock(spec=OpenRouteServiceDirectionsClient)

    service = SupportLocationService(
        overpass_client=overpass_client,
        directions_client=directions_client,
        overpass_adapter=adapter,
    )

    results = await service.find_nearest_police_stations(-23.55, -46.63)

    assert results == []
    directions_client.walking_distance_m.assert_not_awaited()
