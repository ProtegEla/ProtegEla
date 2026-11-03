"""
Modelos de banco de dados do módulo de autenticação.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    client_key: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
    )

    failed_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    window_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    blocked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )