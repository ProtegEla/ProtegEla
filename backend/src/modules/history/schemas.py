from datetime import UTC, datetime
from typing import Annotated, Generic, TypeVar

from pydantic import (
    UUID4,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_serializer,
)

from src.modules.comments.schemas import PageMeta

Label = Annotated[
    str,
    StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=300),
]
Positive = Annotated[float, Field(strict=True, gt=0, allow_inf_nan=False)]


class SearchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: Label


class RouteHistoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    origin_label: Label
    destination_label: Label
    stop_labels: list[Label] = Field(default_factory=list, max_length=3)
    distance_m: Positive
    duration_s: Positive


class HistoryIdentity(BaseModel):
    id: UUID4
    created_at: AwareDatetime

    @field_serializer("created_at")
    def utc_time(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class SearchRead(SearchCreate, HistoryIdentity):
    pass


class RouteHistoryRead(RouteHistoryCreate, HistoryIdentity):
    pass


T = TypeVar("T")


class HistoryResponse(BaseModel, Generic[T]):
    data: T


class HistoryPage(BaseModel, Generic[T]):
    data: list[T]
    meta: PageMeta
