from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

from src.core.exceptions import ExternalServiceException

from src.modules.support_locations.schemas import SupportLocation

# Instâncias públicas do Overpass em ordem de prioridade
OVERPASS_FALLBACK_URLS = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]


class OverpassResponse(BaseModel):
    """Formato esperado da resposta da Overpass."""

    elements: list[dict[str, Any]]
    remark: str | None = None


class OverpassClient:
    """Consulta delegacias na Overpass API com fallback entre instâncias."""

    def __init__(
        self,
        api_url: str,
        timeout_seconds: float = 10,
    ) -> None:
        self.api_url = api_url
        self.timeout_seconds = timeout_seconds

    def _get_urls_to_try(self) -> list[str]:
        """Retorna lista de URLs: a principal primeiro, depois as alternativas."""
        urls = [self.api_url]
        for fallback in OVERPASS_FALLBACK_URLS:
            if fallback != self.api_url:
                urls.append(fallback)
        return urls

    async def find_police_stations(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
    ) -> list[dict[str, Any]]:
        query = (
            f"[out:json][timeout:{int(self.timeout_seconds)}];"
            f'nwr["amenity"="police"]'
            f"(around:{radius_m},{latitude},{longitude});out center;"
        )

        last_error: Exception | None = None
        for url in self._get_urls_to_try():
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout_seconds,
                    headers={"User-Agent": "ProtegEla-App/1.0 (https://github.com/ProtegEla)"},
                ) as client:
                    response = await client.post(
                        url,
                        data={"data": query},
                    )
                    response.raise_for_status()

                    result = OverpassResponse.model_validate(response.json())

                    if result.remark:
                        last_error = ExternalServiceException(
                            "A Overpass retornou uma resposta incompleta."
                        )
                        continue

                    return result.elements

            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                continue

        raise ExternalServiceException(
            "Não foi possível consultar a Overpass (todas as instâncias falharam)."
        ) from last_error


class OpenRouteServiceRouteSummary(BaseModel):
    distance: float = Field(ge=0, allow_inf_nan=False)


class OpenRouteServiceRoute(BaseModel):
    summary: OpenRouteServiceRouteSummary


class OpenRouteServiceDirectionsResponse(BaseModel):
    routes: list[OpenRouteServiceRoute] = Field(min_length=1)


class OpenRouteServiceDirectionsClient:
    """Calcula a distância a pé entre a usuária e uma delegacia."""

    def __init__(
        self,
        api_url: str,
        api_key: str,
        timeout_seconds: float = 8,
    ) -> None:
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def walking_distance_m(
        self,
        user_latitude: float,
        user_longitude: float,
        destination: SupportLocation,
    ) -> float:
        payload = {
            "coordinates": [
                [user_longitude, user_latitude],
                [destination.longitude, destination.latitude],
            ],
            "geometry": False,
            "instructions": False,
        }

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                headers={"User-Agent": "ProtegEla-App/1.0 (https://github.com/ProtegEla)"},
            ) as client:
                response = await client.post(
                    f"{self.api_url}/v2/directions/foot-walking",
                    json=payload,
                    headers={"Authorization": self.api_key},
                )
                response.raise_for_status()

                result = OpenRouteServiceDirectionsResponse.model_validate(
                    response.json()
                )

        except (httpx.HTTPError, ValueError) as exc:
            raise ExternalServiceException(
                "Não foi possível calcular a distância a pé."
            ) from exc

        return result.routes[0].summary.distance
