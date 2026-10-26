"""Criação, consulta e interações de incidentes, sem responsabilidades HTTP."""

import hashlib
import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import NoReturn
from uuid import UUID
from zoneinfo import ZoneInfo

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import (
    AppException,
    BusinessRuleException,
    EntityNotFoundException,
    ForbiddenException,
)
from src.modules.reports.models import (
    IncidentPeriod,
    Report,
    ReportCategory,
    ReportInteraction,
    ReportInteractionKind,
)


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


@dataclass(frozen=True, kw_only=True)
class ReportDetails:
    """Projeção pública sem identidade interna, denúncias ou estado de moderação."""

    id: UUID
    latitude: float
    longitude: float
    address_reference: str | None
    category: ReportCategory
    description: str | None
    incident_date: date
    incident_period: IncidentPeriod
    incident_time: time | None
    is_anonymous: bool
    created_at: datetime
    confirmations_count: int


def sao_paulo_today() -> date:
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


class ReportService:
    """Usa uma sessão por requisição; confirma ou reverte transações de escrita.

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

    async def get_details(self, report_id: UUID) -> ReportDetails:
        """Consulta pública em um único snapshot, sem exigir identidade autenticada."""
        self._validate_uuid(report_id, "report_id")
        confirmations = (
            select(func.count(ReportInteraction.id))
            .where(
                ReportInteraction.report_id == Report.id,
                ReportInteraction.kind == ReportInteractionKind.CONFIRMATION,
            )
            .correlate(Report)
            .scalar_subquery()
        )
        result = await self.session.execute(
            select(
                Report.id,
                Report.location,
                Report.address_reference,
                Report.category,
                Report.description,
                Report.incident_date,
                Report.incident_period,
                Report.incident_time,
                Report.is_anonymous,
                Report.created_at,
                confirmations.label("confirmations_count"),
            )
            .where(Report.id == report_id, Report.is_hidden.is_(False))
            .execution_options(autoflush=False)
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise EntityNotFoundException("Relato não encontrado.")
        point = to_shape(row["location"])
        return ReportDetails(
            id=row["id"],
            latitude=point.y,
            longitude=point.x,
            address_reference=row["address_reference"],
            category=row["category"],
            description=row["description"],
            incident_date=row["incident_date"],
            incident_period=row["incident_period"],
            incident_time=row["incident_time"],
            is_anonymous=row["is_anonymous"],
            created_at=row["created_at"],
            confirmations_count=row["confirmations_count"],
        )

    async def confirm(self, report_id: UUID, *, user_id: UUID) -> None:
        await self._register_interaction(
            report_id, user_id=user_id, kind=ReportInteractionKind.CONFIRMATION
        )

    async def report_abuse(self, report_id: UUID, *, user_id: UUID) -> None:
        await self._register_interaction(
            report_id, user_id=user_id, kind=ReportInteractionKind.ABUSE
        )

    async def _register_interaction(
        self, report_id: UUID, *, user_id: UUID, kind: ReportInteractionKind
    ) -> None:
        self._validate_uuid(report_id, "report_id")
        self._validate_uuid(user_id, "user_id")
        try:
            # Serializa interações do relato, inclusive de usuárias diferentes,
            # para avaliar a RN06 e a visibilidade na mesma transação.
            report = await self.session.scalar(
                select(Report)
                .where(Report.id == report_id, Report.is_hidden.is_(False))
                .with_for_update()
                .execution_options(populate_existing=True, autoflush=False)
            )
            if report is None:
                raise EntityNotFoundException("Relato não encontrado.")
            if report.author_id == user_id:
                raise ForbiddenException(
                    "A autora não pode confirmar ou denunciar o próprio relato."
                )
            existing = await self.session.scalar(
                select(ReportInteraction.kind).where(
                    ReportInteraction.report_id == report_id,
                    ReportInteraction.user_id == user_id,
                )
            )
            if existing is not None:
                if existing != kind:
                    raise AppException(
                        "Já existe uma interação de outro tipo para este relato.",
                        code="INTERACTION_CONFLICT",
                        status_code=409,
                    )
                # Repetições não renovam a data nem criam outra interação.
                await self.session.commit()
                return

            self.session.add(
                ReportInteraction(
                    report_id=report_id,
                    user_id=user_id,
                    kind=kind,
                    created_at=func.clock_timestamp(),
                )
            )
            await self.session.flush()
            if kind == ReportInteractionKind.ABUSE:
                result = await self.session.execute(
                    select(ReportInteraction.kind, func.count(ReportInteraction.id))
                    .where(ReportInteraction.report_id == report_id)
                    .group_by(ReportInteraction.kind)
                )
                counts = dict(result.all())
                confirmations = counts.get(ReportInteractionKind.CONFIRMATION, 0)
                abuses = counts.get(ReportInteractionKind.ABUSE, 0)
                if 10 * abuses > 3 * confirmations:
                    report.is_hidden = True
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

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
