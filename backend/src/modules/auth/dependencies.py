"""Dependência HTTP de identidade; consulta real de conta."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.core.exceptions import UnauthorizedException
from src.modules.auth.service import validate_access_token_subject
from src.modules.users.service import require_user

bearer = HTTPBearer(auto_error=False)


async def get_current_author(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> UUID:
    if credentials is None:
        raise UnauthorizedException()
    subject = validate_access_token_subject(credentials.credentials)
    await require_user(session, subject)
    return subject
