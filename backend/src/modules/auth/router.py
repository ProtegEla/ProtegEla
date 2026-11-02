import re
import uuid
from typing import List
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db_session
from src.modules.auth.service import login_with_rate_limit, register_user
from fastapi import APIRouter, Depends, Request, status

class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1, repr=False)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

router = APIRouter(prefix="/auth", tags=["Auth"])

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_REGEX = re.compile(r"^\+?\d{10,15}$")

class EmergencyContactIn(BaseModel):
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


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)
    emergency_contacts: List[EmergencyContactIn] = Field(min_length=1, max_length=3)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not _EMAIL_REGEX.match(value):
            raise ValueError("E-mail inválido.")
        return value

    @field_validator("emergency_contacts")
    @classmethod
    def validate_single_primary(cls, contacts: List[EmergencyContactIn]) -> List[EmergencyContactIn]:
        if sum(1 for c in contacts if c.is_primary) != 1:
            raise ValueError("Informe exatamente 1 contato de emergência principal.")
        return contacts


class RegisterResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str

@router.get("/status", status_code=status.HTTP_200_OK)
async def auth_status():
    """Endpoint inicial de status do módulo de autenticação."""
    return {"module": "auth", "status": "initialized"}

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, session: AsyncSession = Depends(get_db_session)):
    """Cadastro de usuária e contatos de emergência."""
    user = await register_user(session, username=data.username, email=data.email, password=data.password, emergency_contacts=[c.model_dump() for c in data.emergency_contacts])
    return RegisterResponse(id=user.id, username=user.username, email=data.email)

@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
async def login(
    data: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
):
    """Autentica uma usuária com proteção contra tentativas excessivas."""

    client_ip = request.client.host if request.client else "unknown"

    tokens = await login_with_rate_limit(
        session,
        email=data.email,
        password=data.password,
        client_ip=client_ip,
    )

    return LoginResponse(**tokens)
