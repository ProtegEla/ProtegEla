"""Contrato privado de atividades do perfil."""

from typing import Literal
from pydantic import UUID4, AwareDatetime, BaseModel
from src.modules.comments.schemas import PageMeta


class ActivityRead(BaseModel):
    type: Literal["report", "comment"]
    id: UUID4
    report_id: UUID4
    text: str | None
    created_at: AwareDatetime


class ActivityPage(BaseModel):
    data: list[ActivityRead]
    meta: PageMeta
