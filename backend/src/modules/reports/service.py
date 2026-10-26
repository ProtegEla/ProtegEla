"""Criação de incidentes; HTTP e autenticação ficam fora do caso de uso."""

import hashlib
import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import NoReturn
from uuid import UUID
from zoneinfo import ZoneInfo

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppException, BusinessRuleException
from src.modules.reports.models import IncidentPeriod, Report, ReportCategory


@dataclass(frozen=True, kw_only=True)
class CreateReportData:
    latitude: float
    longitude: float
    category: ReportCategory
    incident_date: date
    incident_period: IncidentPeriod
    is_anonymous: bool
    address_reference: str | None = None
    description: str | None = None
    incident_time: time | None = None


def sao_paulo_today() -> date:
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


class ReportService:
    """Usa uma sessão por requisição; confirma ou reverte a transação de criação.

    A identidade recebida deve ter sido autenticada e consultada pelo chamador.
    O serviço não transforma um UUID recebido do cliente em autenticação.
    Usar expire_on_commit=False e isolamento READ COMMITTED, conforme a sessão
    atual do projeto, para retornar os dados e contar após adquirir o lock.
    """

    def __init__(
        self, session: AsyncSession, *, today: Callable[[], date] = sao_paulo_today
    ) -> None:
        self.session = session
        self.today = today

    async def create(
        self, data: CreateReportData, *, author_id: UUID, device_id: UUID
    ) -> Report:
        self._validate_uuid(author_id, "author_id")
        self._validate_uuid(device_id, "device_id")
        self._validate(data)
        description = self._normalize_text(data.description, 1000, "description")
        reference = self._normalize_text(
            data.address_reference, 255, "location.address_reference"
        )

        try:
            # A mesma chave é compartilhada por todos os processos do backend.
            lock_key = int.from_bytes(
                hashlib.sha256(device_id.bytes).digest()[:8], signed=True
            )
            await self.session.execute(
                text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key}
            )
            count = await self.session.scalar(
                select(func.count(Report.id)).where(
                    Report.device_id == device_id,
                    Report.created_at > func.clock_timestamp() - timedelta(seconds=60),
                )
            )
            if count >= 5:
                raise AppException(
                    "Limite de 5 relatos por dispositivo em 60 segundos excedido.",
                    code="RATE_LIMIT_EXCEEDED",
                    status_code=429,
                )
            report = Report(
                author_id=author_id,
                device_id=device_id,
                category=ReportCategory(data.category),
                location=from_shape(Point(data.longitude, data.latitude), srid=4326),
                address_reference=reference,
                description=description,
                incident_date=data.incident_date,
                incident_period=IncidentPeriod(data.incident_period),
                incident_time=data.incident_time,
                is_anonymous=data.is_anonymous,
                # now() usaria o início da transação, anterior à espera pelo lock.
                created_at=func.clock_timestamp(),
            )
            self.session.add(report)
            await self.session.flush()
            await self.session.refresh(report)
            await self.session.commit()
            return report
        except Exception:
            await self.session.rollback()
            raise

    def _validate(self, data: CreateReportData) -> None:
        for field, value, limit in (
            ("location.latitude", data.latitude, 90),
            ("location.longitude", data.longitude, 180),
        ):
            if (
                isinstance(value, bool)
                or not isinstance(value, (float, int))
                or not -limit <= value <= limit
                or not math.isfinite(value)
            ):
                self._invalid(field, "Coordenada inválida.")
        try:
            ReportCategory(data.category)
        except (ValueError, TypeError):
            self._invalid("category", "Categoria desconhecida.")
        try:
            period = IncidentPeriod(data.incident_period)
        except (ValueError, TypeError):
            self._invalid("incident_period", "Período desconhecido.")
        if type(data.incident_date) is not date:
            self._invalid("incident_date", "Informe uma data civil válida.")
        if data.incident_date > self.today():
            self._invalid("incident_date", "A data do incidente não pode ser futura.")
        if not isinstance(data.is_anonymous, bool):
            self._invalid("is_anonymous", "Informe uma opção booleana de anonimato.")
        if data.incident_time is not None:
            value = data.incident_time
            if (
                not isinstance(value, time)
                or value.tzinfo is not None
                or value.second != 0
                or value.microsecond != 0
            ):
                self._invalid(
                    "incident_time", "Informe horário local com precisão HH:MM."
                )
            periods = (
                IncidentPeriod.MADRUGADA,
                IncidentPeriod.MANHA,
                IncidentPeriod.TARDE,
                IncidentPeriod.NOITE,
            )
            if periods[value.hour // 6] != period:
                self._invalid("incident_time", "Horário incompatível com o período.")

    @staticmethod
    def _normalize_text(value: str | None, limit: int, field: str) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            ReportService._invalid(field, "Informe um texto válido.")
        normalized = value.strip()
        if len(normalized) > limit:
            ReportService._invalid(field, f"O texto deve ter até {limit} caracteres.")
        return normalized or None

    @staticmethod
    def _validate_uuid(value: UUID, field: str) -> None:
        if not isinstance(value, UUID) or value.version != 4:
            ReportService._invalid(field, "Informe um UUID v4 válido.")

    @staticmethod
    def _invalid(field: str, message: str) -> NoReturn:
        raise BusinessRuleException(
            message,
            code="VALIDATION_ERROR",
            details=[{"field": field, "issue": message}],
        )
