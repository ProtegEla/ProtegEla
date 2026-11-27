import re
from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.comments.schemas import PageMeta
from src.modules.users.schemas import ActivityPage
from src.modules.users.service import (
    list_activity,
    list_emergency_contacts,
    replace_emergency_contacts,
)

_PHONE_REGEX = re.compile(r"^\+?\d{10,15}$")


class EmergencyContactPayload(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str
    is_primary: bool = False

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        digits = re.sub(r"[\s()\-]", "", value)
        if not _PHONE_REGEX.match(digits):
            raise ValueError("Telefone inválido. Informe DDD + número (ex.: 11987654321).")
        return digits


class EmergencyContactOut(BaseModel):
    id: UUID
    name: str
    phone: str
    is_primary: bool


class EmergencyContactsRequest(BaseModel):
    contacts: List[EmergencyContactPayload] = Field(default_factory=list, max_length=3)

    @field_validator("contacts")
    @classmethod
    def validate_single_primary(
        cls, contacts: List[EmergencyContactPayload]
    ) -> List[EmergencyContactPayload]:
        if contacts and sum(1 for c in contacts if c.is_primary) != 1:
            raise ValueError("Informe exatamente 1 contato de emergência principal.")
        return contacts


class EmergencyContactsResponse(BaseModel):
    data: List[EmergencyContactOut]

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def users_status():
    """Endpoint inicial de status do módulo de usuárias."""
    return {"module": "users", "status": "initialized"}


@router.get("/me/activity", response_model=ActivityPage)
async def get_activity(
    author_id: Annotated[UUID, Depends(get_current_author)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ActivityPage:
    entries, total = await list_activity(
        session, author_id, page=page, page_size=page_size
    )
    return ActivityPage(
        data=entries, meta=PageMeta(page=page, page_size=page_size, total_records=total)
    )


@router.get("/me/emergency-contacts", response_model=EmergencyContactsResponse)
async def get_emergency_contacts(
    author_id: Annotated[UUID, Depends(get_current_author)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> EmergencyContactsResponse:
    items = await list_emergency_contacts(session, author_id)
    return EmergencyContactsResponse(data=items)


@router.put("/me/emergency-contacts", response_model=EmergencyContactsResponse)
async def update_emergency_contacts(
    payload: EmergencyContactsRequest,
    author_id: Annotated[UUID, Depends(get_current_author)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> EmergencyContactsResponse:
    items = await replace_emergency_contacts(
        session, author_id, [c.model_dump() for c in payload.contacts]
    )
    return EmergencyContactsResponse(data=items)
