from datetime import UTC, datetime, timedelta
from uuid import uuid1, uuid4

import pytest
from jose import jwt
from src.core.config import settings
from src.core.exceptions import UnauthorizedException
from src.core.security import create_access_token, create_refresh_token
from src.modules.auth.service import validate_access_token_subject


def test_access_token_returns_subject_uuid() -> None:
    subject = uuid4()
    assert validate_access_token_subject(create_access_token(str(subject))) == subject


@pytest.mark.parametrize(
    "changes, removed",
    [
        ({}, "exp"),
        ({}, "sub"),
        ({}, "type"),
        ({"type": "refresh"}, None),
        ({"sub": "invalid"}, None),
        ({"sub": str(uuid1())}, None),
        ({"sub": 123}, None),
        ({"exp": 0}, None),
        ({"exp": True}, None),
        ({"exp": "9999999999"}, None),
        ({"exp": float("inf")}, None),
        ({"exp": float("nan")}, None),
    ],
)
def test_invalid_claims_are_unauthorized(changes: dict, removed: str | None) -> None:
    claims = {
        "sub": str(uuid4()),
        "type": "access",
        "exp": (datetime.now(UTC) + timedelta(minutes=10)).timestamp(),
    }
    claims.update(changes)
    if removed:
        claims.pop(removed)
    token = jwt.encode(claims, settings.APP_SECRET_KEY, algorithm=settings.ALGORITHM)
    with pytest.raises(UnauthorizedException):
        validate_access_token_subject(token)


def test_refresh_token_cannot_authorize_creation() -> None:
    with pytest.raises(UnauthorizedException):
        validate_access_token_subject(create_refresh_token(str(uuid4())))


def test_invalid_signature_is_unauthorized() -> None:
    token = jwt.encode(
        {"sub": str(uuid4()), "type": "access", "exp": 9999999999},
        "test_wrong_signing_key",
        algorithm=settings.ALGORITHM,
    )
    with pytest.raises(UnauthorizedException):
        validate_access_token_subject(token)
