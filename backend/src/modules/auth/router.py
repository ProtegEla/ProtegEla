from fastapi import APIRouter, status
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1, repr=False)

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def auth_status():
    """Endpoint inicial de status do módulo de autenticação."""
    return {"module": "auth", "status": "initialized"}


