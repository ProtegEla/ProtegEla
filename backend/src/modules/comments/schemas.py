"""Contratos HTTP de comentários, sem identificadores internos de conta."""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import (
    UUID4,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
)


class CommentEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: Annotated[str, Field(strict=True, min_length=1, max_length=1000)]

    @field_validator("text", mode="before")
    @classmethod
    def trim_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CommentCreate(CommentEdit):
    parent_id: UUID4 | None = None


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID4
    report_id: UUID4
    parent_id: UUID4 | None
    author: str | None
    text: str | None
    is_deleted: bool
    created_at: AwareDatetime
    updated_at: AwareDatetime

    @field_serializer("created_at", "updated_at")
    def utc_datetime(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class CommentResponse(BaseModel):
    data: CommentRead


class PageMeta(BaseModel):
    page: int
    page_size: int
    total_records: int


class CommentPage(BaseModel):
    data: list[CommentRead]
    meta: PageMeta
