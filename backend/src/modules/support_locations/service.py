"""
Serviço de regras de negócio do módulo Support Locations.

Responsabilidades futuras (a serem implementadas pelo responsável do módulo):
- Integração cliente com Overpass API (OpenStreetMap) para delegacias e hospitais (RF12).
- Consulta espacial de locais em um raio a partir da localização da usuária.
- Cache em banco de dados local para operação resiliente a falhas externas (RNF10).
"""

"""Casos de uso do módulo Support Locations."""

from src.modules.support_locations.adapters import OverpassAdapter

from src.modules.support_locations.clients import (
    OpenRouteServiceDirectionsClient,
    OverpassClient,
)
from src.modules.support_locations.schemas import (
    SupportLocation,
    SupportLocationWithDistance,
)

POLICE_STATION_SEARCH_RADIUS_M = 5000
NEAREST_POLICE_STATIONS_LIMIT = 5

class SupportLocationService:
    """Coordena a busca e a ordenação de delegacias próximas."""

    def __init__(
        self,
        overpass_client: OverpassClient,
        directions_client: OpenRouteServiceDirectionsClient,
        overpass_adapter: OverpassAdapter,
    ) -> None:
        self.overpass_client = overpass_client
        self.directions_client = directions_client
        self.overpass_adapter = overpass_adapter

    async def find_nearest_police_stations(
        self,
        latitude: float,
        longitude: float,
    ) -> list[SupportLocationWithDistance]:
        osm_elements = await self.overpass_client.find_police_stations(
            latitude=latitude,
            longitude=longitude,
            radius_m=POLICE_STATION_SEARCH_RADIUS_M,
        )
        nearby_police_stations: list[SupportLocation] = (
            self.overpass_adapter.to_support_locations(osm_elements)
        )

        locations: list[SupportLocationWithDistance] = []

        for nearby_police_station in nearby_police_stations:
            distance_m = await self.directions_client.walking_distance_m(
                user_latitude=latitude,
                user_longitude=longitude,
                destination=nearby_police_station,
            )
            locations.append(
                SupportLocationWithDistance(
                    id=nearby_police_station.id,
                    name=nearby_police_station.name,
                    latitude=nearby_police_station.latitude,
                    longitude=nearby_police_station.longitude,
                    distance_m=distance_m,
                )
            )

        locations.sort(key=lambda location: location.distance_m)
        return locations[:NEAREST_POLICE_STATIONS_LIMIT]
