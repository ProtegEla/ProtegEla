"""Respostas públicas GeoJSON do mapa."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import UUID4, BaseModel
from src.modules.comments.schemas import PageMeta
from src.modules.reports.models import ReportCategory
from src.modules.risk_zones.service import RiskZone, ZoneIncident


class PointGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: tuple[float, float]


class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]


class MultiPolygonGeometry(BaseModel):
    type: Literal["MultiPolygon"]
    coordinates: list[list[list[tuple[float, float]]]]


class ZoneProperties(BaseModel):
    marker_location: PointGeometry
    categories: list[ReportCategory]
    sources: list[Literal["app", "ssp"]]
    incidents_count: int


class ZoneFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: UUID
    geometry: PointGeometry | PolygonGeometry | MultiPolygonGeometry
    properties: ZoneProperties

    @classmethod
    def from_zone(cls, zone: RiskZone):
        return cls(
            id=zone.id,
            geometry=zone.geometry,
            properties=ZoneProperties(
                marker_location=zone.marker_location,
                categories=zone.categories,
                sources=zone.sources,
                incidents_count=len(zone.incidents),
            ),
        )


class FeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[ZoneFeature]


class ZoneMeta(BaseModel):
    total_records: int


class ZoneResponse(BaseModel):
    data: FeatureCollection
    meta: ZoneMeta


class IncidentRead(BaseModel):
    id: UUID4
    source: Literal["app", "ssp"]
    category: ReportCategory
    location: PointGeometry
    description: str | None
    incident_date: date
    report_id: UUID4 | None

    @classmethod
    def from_incident(cls, incident: ZoneIncident):
        return cls(
            **vars(incident),
            report_id=incident.id if incident.source == "app" else None
        )


class IncidentPage(BaseModel):
    data: list[IncidentRead]
    meta: PageMeta
