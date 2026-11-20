from typing import Literal

import httpx
from pydantic import BaseModel, Field

from src.core.exceptions import ExternalServiceException
from src.modules.addresses.schemas import AddressSuggestion


class Geometry(BaseModel):
    type: Literal["Point"]
    coordinates: tuple[float, float]


class Properties(BaseModel):
    gid: str = Field(min_length=1)
    label: str = Field(min_length=1)


class Feature(BaseModel):
    geometry: Geometry
    properties: Properties


class GeocodingResponse(BaseModel):
    features: list[Feature]


class OpenRouteServiceGeocodingClient:
    def __init__(self, api_url: str, api_key: str, timeout_seconds: float = 8):
        self.api_url = api_url
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def autocomplete(self, text: str) -> list[AddressSuggestion]:
        if not self.api_key or self.api_key == "mock_dev_key":
            raise ExternalServiceException("Configure a chave do OpenRouteService.")
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    self.api_url,
                    headers={"Authorization": self.api_key, "Accept-Language": "pt-BR"},
                    params={
                        "text": text,
                        "boundary.country": "BRA",
                        "focus.point.lat": -23.55052,
                        "focus.point.lon": -46.633308,
                        "layers": "address,street,venue",
                    },
                )
                response.raise_for_status()
                result = GeocodingResponse.model_validate(response.json())
            return [
                AddressSuggestion(
                    id=feature.properties.gid,
                    label=feature.properties.label,
                    longitude=feature.geometry.coordinates[0],
                    latitude=feature.geometry.coordinates[1],
                )
                for feature in result.features
            ]
        except (httpx.HTTPError, ValueError):
            raise ExternalServiceException(
                "Não foi possível consultar sugestões de endereços."
            ) from None
