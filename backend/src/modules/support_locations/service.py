"""
Serviço de regras de negócio do módulo Support Locations.

Faz 1 única requisição ao Overpass para obter todas as delegacias em um raio.
Calcula a distância em linha reta (Haversine) no próprio servidor — sem
chamadas extras ao ORS — e devolve a lista completa para que o frontend
faça cache no dispositivo e exiba as mais próximas.
"""

import math

from src.modules.support_locations.adapters import OverpassAdapter
from src.modules.support_locations.clients import OverpassClient
from src.modules.support_locations.schemas import (
    SupportLocation,
    SupportLocationWithDistance,
)

POLICE_STATION_SEARCH_RADIUS_M = 5000


def _haversine_distance_m(
    lat1: float, lon1: float, lat2: float, lon2: float,
) -> float:
    """Calcula a distância geodésica em metros entre duas coordenadas."""
    earth_radius_m = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_m * c


class SupportLocationService:
    """Coordena a busca de delegacias próximas via Overpass."""

    def __init__(
        self,
        overpass_client: OverpassClient,
        overpass_adapter: OverpassAdapter,
    ) -> None:
        self.overpass_client = overpass_client
        self.overpass_adapter = overpass_adapter

    async def find_nearest_police_stations(
        self,
        latitude: float,
        longitude: float,
    ) -> list[SupportLocationWithDistance]:
        """1 chamada ao Overpass → retorna todas as delegacias com distância haversine."""
        osm_elements = await self.overpass_client.find_police_stations(
            latitude=latitude,
            longitude=longitude,
            radius_m=POLICE_STATION_SEARCH_RADIUS_M,
        )
        nearby: list[SupportLocation] = (
            self.overpass_adapter.to_support_locations(osm_elements)
        )

        locations = [
            SupportLocationWithDistance(
                id=station.id,
                name=station.name,
                latitude=station.latitude,
                longitude=station.longitude,
                distance_m=round(
                    _haversine_distance_m(
                        latitude, longitude,
                        station.latitude, station.longitude,
                    ),
                ),
            )
            for station in nearby
        ]

        locations.sort(key=lambda loc: loc.distance_m)
        return locations

    find_nearby_police_stations = find_nearest_police_stations
