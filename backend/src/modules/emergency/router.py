from fastapi import APIRouter, status
from pydantic import BaseModel

from src.modules.emergency.service import list_useful_numbers


router = APIRouter(prefix="/emergency", tags=["Emergency"])


class UsefulNumber(BaseModel):
    name: str
    phone: str
    description: str


class UsefulNumbersResponse(BaseModel):
    data: list[UsefulNumber]


@router.get("/status", status_code=status.HTTP_200_OK)
async def emergency_status():
    """Endpoint inicial de status do módulo de emergência."""
    return {"module": "emergency", "status": "initialized"}


@router.get(
    "/useful-numbers",
    response_model=UsefulNumbersResponse,
    status_code=status.HTTP_200_OK,
)
async def get_useful_numbers() -> dict[str, list[dict[str, str]]]:
    """Retorna uma lista de telefones públicos úteis."""

    return {"data": list_useful_numbers()}
