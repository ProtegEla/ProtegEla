"""Schemas HTTP de relatos; campos internos não integram a resposta pública."""

import re
from datetime import UTC, date, datetime, time
from typing import Annotated

from geoalchemy2.shape import to_shape
from pydantic import (
    UUID4,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    field_serializer,
    field_validator,
)

from src.modules.reports.models import IncidentPeriod, Report, ReportCategory
from src.modules.reports.service import CreateReportData


class ReportLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: Annotated[float, Field(strict=True, ge=-90, le=90, allow_inf_nan=False)]
    longitude: Annotated[
        float, Field(strict=True, ge=-180, le=180, allow_inf_nan=False)
    ]
    address_reference: Annotated[str | None, Field(max_length=255)] = None

    @field_validator("address_reference", mode="before")
    @classmethod
    def normalize_reference(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: ReportLocation
    category: ReportCategory
    description: Annotated[str | None, Field(max_length=1000)] = None
    incident_date: date
    incident_period: IncidentPeriod
    incident_time: time | None = None
    is_anonymous: StrictBool

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value

    @field_validator("incident_date", mode="before")
    @classmethod
    def parse_incident_date(cls, value: object) -> date:
        if type(value) is date:
            return value
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Use o formato YYYY-MM-DD.")
        return date.fromisoformat(value)

    @field_validator("incident_time", mode="before")
    @classmethod
    def parse_incident_time(cls, value: object) -> time | None:
        if value is None or isinstance(value, time):
            return value
        if not isinstance(value, str) or not re.fullmatch(r"\d{2}:\d{2}", value):
            raise ValueError("Use o formato HH:MM.")
        return time.fromisoformat(value)

    def to_service_data(self) -> CreateReportData:
        return CreateReportData(
            latitude=self.location.latitude,
            longitude=self.location.longitude,
            address_reference=self.location.address_reference,
            category=self.category,
            description=self.description,
            incident_date=self.incident_date,
            incident_period=self.incident_period,
            incident_time=self.incident_time,
            is_anonymous=self.is_anonymous,
        )


class ReportRead(ReportCreate):
    id: UUID4
    created_at: AwareDatetime

    @field_serializer("incident_time")
    def serialize_time(self, value: time | None) -> str | None:
        return value.isoformat(timespec="minutes") if value is not None else None

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")

    @classmethod
    def from_report(cls, report: Report) -> "ReportRead":
        point = to_shape(report.location)
        return cls(
            id=report.id,
            location=ReportLocation(
                latitude=point.y,
                longitude=point.x,
                address_reference=report.address_reference,
            ),
            category=report.category,
            description=report.description,
            incident_date=report.incident_date,
            incident_period=report.incident_period,
            incident_time=report.incident_time,
            is_anonymous=report.is_anonymous,
            created_at=report.created_at,
        )


class ReportCreated(BaseModel):
    data: ReportRead
