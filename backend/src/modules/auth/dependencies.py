"""Dependência HTTP de identidade; consulta real de conta ainda pendente."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.core.exceptions import AppException, UnauthorizedException
from src.modules.auth.service import validate_access_token_subject

bearer = HTTPBearer(auto_error=False)


async def get_current_author(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UUID:
    if credentials is None:
        raise UnauthorizedException()
    validate_access_token_subject(credentials.credentials)
    # Não entregar o sub como identidade autenticada sem consultar a conta.
    # Substituições dessa dependência são permitidas exclusivamente nos testes.
    raise AppException(
        "A verificação da conta ainda não está disponível.",
        code="AUTHENTICATION_UNAVAILABLE",
        status_code=503,
    )
