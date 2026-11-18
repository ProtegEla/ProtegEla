from itertools import pairwise
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

Positive = Annotated[float, Field(gt=0, allow_inf_nan=False)]
NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Coordinate = tuple[Longitude, Latitude]


class RoutePoint(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    latitude: Latitude
    longitude: Longitude

    def coordinate(self) -> Coordinate:
        return self.longitude, self.latitude


class RouteCalculate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    origin: RoutePoint
    destination: RoutePoint
    stops: list[RoutePoint] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def distinct_neighbors(self):
        points = self.points()
        if any(a == b for a, b in pairwise(points)):
            raise ValueError("Pontos consecutivos devem ser distintos.")
        return self

    def points(self) -> list[RoutePoint]:
        return [self.origin, *self.stops, self.destination]


class RouteGeometry(BaseModel):
    type: Literal["LineString"]
    coordinates: list[Coordinate] = Field(min_length=2)


class RouteStep(BaseModel):
    instruction: str = Field(min_length=1)
    distance_m: NonNegative
    duration_s: NonNegative
    way_points: tuple[int, int]


class RouteLeg(BaseModel):
    distance_m: Positive
    duration_s: Positive
    steps: list[RouteStep] = Field(min_length=1)


class RouteRisk(BaseModel):
    status: Literal["evaluated", "no_mapped_data", "unavailable"] = "unavailable"
    exposure_score: NonNegative | None = None

    @model_validator(mode="after")
    def consistent_score(self):
        if (self.status == "evaluated") != (self.exposure_score is not None):
            raise ValueError("Pontuação incompatível com o estado da avaliação.")
        return self


class WalkingRoute(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    geometry: RouteGeometry
    distance_m: Positive
    duration_s: Positive
    legs: list[RouteLeg]
    risk: RouteRisk = Field(default_factory=RouteRisk)


class RouteComparison(BaseModel):
    fastest_route_id: UUID
    lower_risk_route_id: UUID | None = None
    extra_duration_percent: NonNegative | None = None
    exceeds_30_percent: bool | None = None
    status: Literal[
        "lower_risk_available",
        "no_lower_risk_alternative",
        "no_mapped_data",
        "risk_unavailable",
    ] = "risk_unavailable"


class CalculatedRoutes(BaseModel):
    routes: list[WalkingRoute] = Field(min_length=1, max_length=3)
    comparison: RouteComparison
    attribution: str


class RouteCalculateResponse(BaseModel):
    data: CalculatedRoutes
