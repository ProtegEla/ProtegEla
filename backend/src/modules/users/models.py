"""
Modelos ORM de banco de dados para usuárias e contatos de emergência (SQLAlchemy).

Responsabilidades futuras (a serem mapeadas pelo responsável do módulo):
- Tabela users (username, e-mail criptografado, password_hash, preferences).
- Tabela emergency_contacts (telefone criptografado, flag is_primary).
"""
from src.core.database import Base

import uuid
from datetime import datetime, timezone
from typing import List

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid,primary_key=True,default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50),nullable=False)
    email_encrypted: Mapped[str] = mapped_column(Text,nullable=False)
    email_lookup: Mapped[str] = mapped_column(String(64),unique=True,index=True,nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    emergency_contacts: Mapped[List["EmergencyContact"]] = relationship(back_populates="user",cascade="all, delete-orphan",passive_deletes=True)


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"
    __table_args__ = (Index("uq_emergency_contacts_one_primary","user_id",unique=True,postgresql_where=text("is_primary")),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="emergency_contacts")