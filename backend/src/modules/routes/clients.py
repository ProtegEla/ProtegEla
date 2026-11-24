import math
from typing import Literal

import httpx
from pydantic import BaseModel, Field, model_validator

from src.core.exceptions import BusinessRuleException, ExternalServiceException
from src.modules.routes.schemas import (
    NonNegative,
    Positive,
    RouteGeometry,
    RouteLeg,
    RoutePoint,
    RouteStep,
)


class ORSStep(BaseModel):
    instruction: str = Field(min_length=1)
    distance: NonNegative
    duration: NonNegative
    way_points: tuple[int, int]


class ORSSegment(BaseModel):
    distance: Positive
    duration: Positive
    steps: list[ORSStep] = Field(min_length=1)


class ORSProperties(BaseModel):
    segments: list[ORSSegment] = Field(min_length=1, max_length=1)


class ORSFeature(BaseModel):
    geometry: RouteGeometry
    properties: ORSProperties

    @model_validator(mode="after")
    def valid_steps(self):
        segment = self.properties.segments[0]
        last = 0
        for step in segment.steps:
            start, end = step.way_points
            if not (start == last and start <= end < len(self.geometry.coordinates)):
                raise ValueError("Índices de instrução inconsistentes.")
            last = end
        if last != len(self.geometry.coordinates) - 1:
            raise ValueError("Instruções incompletas.")
        for field in ("distance", "duration"):
            total = sum(getattr(step, field) for step in segment.steps)
            if not math.isclose(
                total, getattr(segment, field), abs_tol=1, rel_tol=0.01
            ):
                raise ValueError("Totais de instruções inconsistentes.")
        return self

    def leg(self) -> RouteLeg:
        segment = self.properties.segments[0]
        return RouteLeg(
            distance_m=segment.distance,
            duration_s=segment.duration,
            steps=[
                RouteStep(
                    instruction=step.instruction,
                    distance_m=step.distance,
                    duration_s=step.duration,
                    way_points=step.way_points,
                )
                for step in segment.steps
            ],
        )


class ORSMetadata(BaseModel):
    attribution: str = Field(min_length=1)


class ORSResponse(BaseModel):
    features: list[ORSFeature] = Field(min_length=1, max_length=3)
    metadata: ORSMetadata


class OpenRouteServiceClient:
    def __init__(self, api_url: str, api_key: str, timeout_seconds: float = 8):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def alternatives(
        self, origin: RoutePoint, destination: RoutePoint
    ) -> ORSResponse:
        if not self.api_key or self.api_key == "mock_dev_key":
            raise ExternalServiceException("Configure a chave do OpenRouteService.")
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.api_url}/v2/directions/foot-walking/geojson",
                    headers={"Authorization": self.api_key},
                    json={
                        "coordinates": [origin.coordinate(), destination.coordinate()],
                        "preference": "fastest",
                        "language": "pt",
                        "instructions": True,
                        "instructions_format": "text",
                        "elevation": False,
                        "alternative_routes": {"target_count": 3},
                    },
                )
                if response.status_code in (400, 404):
                    error = response.json().get("error", {})
                    if isinstance(error, dict) and error.get("code") in (2009, 2010):
                        raise BusinessRuleException(
                            "Não há caminho para pedestres em um dos trechos.",
                            code="ROUTE_NOT_FOUND",
                        )
                response.raise_for_status()
                return ORSResponse.model_validate(response.json())
        except (httpx.HTTPError, ValueError, AttributeError):
            raise ExternalServiceException(
                "Não foi possível calcular a rota."
            ) from None


class RoadNode(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)


class OSMWay(BaseModel):
    type: Literal["way"]
    id: int
    tags: dict[str, str]
    geometry: list[RoadNode] = Field(min_length=2)


class RoadResponse(BaseModel):
    elements: list[OSMWay] = Field(max_length=2000)
    remark: str | None = None


class OverpassRoadClient:
    def __init__(self, api_url: str, timeout_seconds: float = 10):
        self.api_url = api_url
        self.timeout_seconds = timeout_seconds

    async def roads(self, bounds):
        west, south, east, north = bounds
        query = f'[out:json][timeout:5];way["highway"]({south},{west},{north},{east});out tags geom;'
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(self.api_url, data={"data": query})
                response.raise_for_status()
                parsed = RoadResponse.model_validate(response.json())
            if parsed.remark:
                raise ValueError("Resposta Overpass incompleta.")
            result = []
            for way in parsed.elements:
                tags = way.tags
                foot = tags.get("foot")
                if foot in {"no", "private", "use_sidepath"}:
                    continue
                if foot not in {"yes", "designated", "permissive"} and (
                    tags.get("access") in {"no", "private"}
                    or tags["highway"]
                    in {
                        "motorway",
                        "motorway_link",
                        "trunk",
                        "trunk_link",
                        "construction",
                        "proposed",
                    }
                ):
                    continue
                result.append(
                    {
                        "id": str(way.id),
                        "ground": tags.get("layer", "0") == "0"
                        and tags.get("bridge", "no") == "no"
                        and tags.get("tunnel", "no") == "no"
                        and tags.get("indoor", "no") == "no",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                (node.lon, node.lat) for node in way.geometry
                            ],
                        },
                    }
                )
            if not result:
                raise ValueError("Sem vias caminháveis.")
            return result
        except (httpx.HTTPError, ValueError, KeyError):
            raise ExternalServiceException(
                "Não foi possível obter vias para avaliar risco."
            ) from None
