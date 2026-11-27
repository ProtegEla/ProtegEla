import logging
import re
import uuid
from typing import Annotated, List
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.auth.email import send_password_reset_email
from src.modules.auth.service import change_password, login_with_rate_limit, register_user, request_password_reset, reset_password
from fastapi import APIRouter, Depends, Request, status

logger = logging.getLogger(__name__)

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

class ForgotPasswordRequest(BaseModel):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not _EMAIL_REGEX.match(value):
            raise ValueError("E-mail inválido.")
        return value

class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, repr=False)
    new_password: str = Field(min_length=8, max_length=128, repr=False)

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
    emergency_contacts: List[EmergencyContactIn] = Field(default_factory=list, max_length=3)

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
        if contacts and sum(1 for c in contacts if c.is_primary) != 1:
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

@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
)
async def forgot_password(
    data: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Solicita a recuperação de senha."""

    token = await request_password_reset(
        session,
        email=data.email,
    )

    if token is not None:
        try:
            await send_password_reset_email(recipient=data.email, token=token)
        except (OSError, RuntimeError, ValueError):
            logger.error("Falha no envio do e-mail de recuperação de senha.")

    return {
        "message": (
            "Se o e-mail estiver cadastrado, você receberá "
            "um link para redefinir sua senha."
        )
    }

@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
)
async def reset_password_endpoint(
    data: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Redefine a senha utilizando um token de recuperação."""

    await reset_password(
        session,
        token=data.token,
        new_password=data.new_password,
    )

    return {
        "message": "Senha redefinida com sucesso."
    }


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
)
async def change_password_endpoint(
    data: ChangePasswordRequest,
    user_id: Annotated[uuid.UUID, Depends(get_current_author)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
):
    """Altera a senha da usuária autenticada."""

    await change_password(
        session,
        user_id=user_id,
        current_password=data.current_password,
        new_password=data.new_password,
    )

    return {
        "message": "Senha alterada com sucesso."
    }
