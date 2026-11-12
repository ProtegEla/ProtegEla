from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

from src.core.exceptions import ExternalServiceException

from src.modules.support_locations.schemas import SupportLocation


class OverpassResponse(BaseModel):
    """Formato esperado da resposta da Overpass."""

    elements: list[dict[str, Any]]
    remark: str | None = None


class OverpassClient:
    """Consulta delegacias na Overpass API."""

    def __init__(
        self,
        api_url: str,
        timeout_seconds: float = 10,
    ) -> None:
        self.api_url = api_url
        self.timeout_seconds = timeout_seconds

    async def find_police_stations(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
    ) -> list[dict[str, Any]]:
        query = (
            f"[out:json][timeout:{self.timeout_seconds}];"
            f'nwr["amenity"="police"]'
            f"(around:{radius_m},{latitude},{longitude});out center;"
        )

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds
            ) as client:
                response = await client.post(
                    self.api_url,
                    data={"data": query},
                )
                response.raise_for_status()

                result = OverpassResponse.model_validate(response.json())

        except (httpx.HTTPError, ValueError) as exc:
            raise ExternalServiceException(
                "Não foi possível consultar a Overpass."
            ) from exc

        if result.remark:
            raise ExternalServiceException(
                "A Overpass retornou uma resposta incompleta."
            )

        return result.elements


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
                timeout=self.timeout_seconds
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
