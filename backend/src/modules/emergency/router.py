from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.emergency.service import list_useful_numbers, resolve_call_target


class CallTargetData(BaseModel):
    phone: str


class CallTargetResponse(BaseModel):
    data: CallTargetData


class UsefulNumber(BaseModel):
    name: str
    phone: str
    description: str


class UsefulNumbersResponse(BaseModel):
    data: list[UsefulNumber]


router = APIRouter(prefix="/emergency", tags=["Emergency"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def emergency_status():
    """Endpoint inicial de status do módulo de emergência."""
    return {"module": "emergency", "status": "initialized"}


@router.get(
    "/call-target",
    response_model=CallTargetResponse,
    status_code=status.HTTP_200_OK,
)
async def get_call_target(
    user_id: Annotated[UUID, Depends(get_current_author)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    response: Response,
) -> CallTargetResponse:
    phone = await resolve_call_target(session, user_id)
    response.headers["Cache-Control"] = "no-store"
    return CallTargetResponse(data=CallTargetData(phone=phone))


@router.get(
    "/useful-numbers",
    response_model=UsefulNumbersResponse,
    status_code=status.HTTP_200_OK,
)
async def get_useful_numbers() -> dict[str, list[dict[str, str]]]:
    """Retorna uma lista de telefones públicos úteis."""

    return {"data": list_useful_numbers()}
