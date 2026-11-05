"""Contratos HTTP das orientações de segurança do RF11."""

from datetime import UTC, datetime

from pydantic import UUID4, AwareDatetime, BaseModel, ConfigDict, field_serializer


class SafetyGuideSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID4
    slug: str
    title: str
    summary: str
    position: int


class SafetyGuideRead(SafetyGuideSummary):
    content: str
    updated_at: AwareDatetime

    @field_serializer("updated_at")
    def utc_datetime(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class SafetyGuideList(BaseModel):
    data: list[SafetyGuideSummary]


class SafetyGuideResponse(BaseModel):
    data: SafetyGuideRead