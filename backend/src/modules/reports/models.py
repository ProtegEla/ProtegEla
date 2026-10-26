"""Persistência dos incidentes comunitários (RF09).

A autoria é obrigatória mesmo quando a publicação é anônima. A chave
estrangeira depende do modelo real de usuárias e de sua política de exclusão.
Confirmações, denúncias e zonas de risco pertencem a entregas posteriores.
"""

from datetime import date, datetime, time
from enum import Enum
from uuid import UUID, uuid4

from geoalchemy2 import Geometry, WKBElement
from sqlalchemy import Boolean, Date, DateTime, Index, String, Time, Uuid, func
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class ReportCategory(str, Enum):
    ASSEDIO = "Assédio"
    VIOLENCIA = "Violência"
    FURTO = "Furto"
    MA_ILUMINACAO = "Má iluminação"


class IncidentPeriod(str, Enum):
    MADRUGADA = "madrugada"
    MANHA = "manha"
    TARDE = "tarde"
    NOITE = "noite"


class Report(Base):
    """Incidente individual; sua criação não implica classificação de risco."""

    __tablename__ = "reports"
    __table_args__ = (Index("ix_reports_device_created", "device_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    # Não associar a uma tabela fictícia enquanto Users não estiver implementado.
    author_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    # Controle de abuso (RN06); null apenas para registros anteriores à migração.
    device_id: Mapped[UUID | None] = mapped_column(Uuid)
    category: Mapped[ReportCategory] = mapped_column(
        SQLAlchemyEnum(
            ReportCategory,
            values_callable=lambda enum: [item.value for item in enum],
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            name="report_category",
        ),
        nullable=False,
    )
    # PostGIS usa X=longitude e Y=latitude. Não contém trilha de GPS da usuária.
    location: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=False,
    )
    address_reference: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(1000))
    # Data/período/horário civis em America/Sao_Paulo, sem inventar hora ausente.
    incident_date: Mapped[date] = mapped_column(Date, nullable=False)
    incident_period: Mapped[IncidentPeriod] = mapped_column(
        SQLAlchemyEnum(
            IncidentPeriod,
            values_callable=lambda enum: [item.value for item in enum],
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            name="incident_period",
        ),
        nullable=False,
    )
    incident_time: Mapped[time | None] = mapped_column(Time(timezone=False))
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
