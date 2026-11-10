"""Registros SSP separados da autoria comunitária."""

from datetime import date, datetime
from uuid import UUID, uuid4

from geoalchemy2 import Geometry, WKBElement
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Integer,
    Index,
    text,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class SSPSafetyRecord(Base):
    __tablename__ = "ssp_safety_records"
    __table_args__ = (
        Index(
            "ix_ssp_active_geography",
            text("(location::geography)"),
            postgresql_using="gist",
            postgresql_where=text("is_active"),
        ),
        CheckConstraint("source_version >= 1", name="ck_ssp_version"),
        CheckConstraint("category = 'Furto'", name="ck_ssp_category"),
        CheckConstraint(
            "NOT is_active OR (location IS NOT NULL AND incident_date IS NOT NULL)",
            name="ck_ssp_active_content",
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    source_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    source_version: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Furto", server_default="Furto"
    )
    location: Mapped[WKBElement | None] = mapped_column(Geometry("POINT", srid=4326))
    incident_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    source_period: Mapped[str] = mapped_column(String(50), nullable=False)
    file_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
