from pydantic import BaseModel, Field


class SupportLocation(BaseModel):
    """Modelo para dados de um local de apoio."""

    id: str
    name: str | None = None
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class SupportLocationWithDistance(SupportLocation):
    """Modelo para dados de um local de apoio com a distância calculada."""

    distance_m: float = Field(ge=0, allow_inf_nan=False)


class NearbySupportLocationsResponse(BaseModel):
    """Modelo para a resposta dos locais de distância próximos."""

    data: list[SupportLocationWithDistance]