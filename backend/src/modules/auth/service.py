"""Validação de tokens de acesso; login e consulta de contas ainda pendentes."""

import math
from datetime import UTC, datetime
from uuid import UUID

from src.core.exceptions import UnauthorizedException
from src.core.security import decode_token


def validate_access_token_subject(token: str) -> UUID:
    """Valida credenciais; não substitui a consulta da conta pelo UUID retornado."""
    try:
        claims = decode_token(token)
        expires = claims.get("exp")
        if (
            claims.get("type") != "access"
            or type(expires) not in (int, float)
            or not math.isfinite(expires)
            or expires <= datetime.now(UTC).timestamp()
            or not isinstance(claims.get("sub"), str)
        ):
            raise UnauthorizedException()
        subject = UUID(claims["sub"])
        if subject.version != 4:
            raise UnauthorizedException()
        return subject
    except (ValueError, TypeError, OverflowError) as exc:
        raise UnauthorizedException("Token inválido ou expirado.") from exc
