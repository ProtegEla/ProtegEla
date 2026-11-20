"""Histórico privado limitado; resumos cifrados sem trilha de GPS."""

import json
from datetime import timedelta
from typing import Literal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import BusinessRuleException, UnauthorizedException
from src.core.security import decrypt_sensitive_field, encrypt_sensitive_field
from src.modules.history.models import HistoryEntry
from src.modules.history.schemas import (
    RouteHistoryCreate,
    RouteHistoryRead,
    SearchCreate,
    SearchRead,
)
from src.modules.users.models import User

Kind = Literal["search", "route"]
RETENTION = timedelta(days=30)
MAX_RECORDS = 100


def read_entry(entry: HistoryEntry):
    schema = SearchRead if entry.kind == "search" else RouteHistoryRead
    return schema(
        **json.loads(decrypt_sensitive_field(entry.payload_encrypted)),
        id=entry.id,
        created_at=entry.created_at
    )


async def purge_expired(session: AsyncSession) -> int:
    """Exclusão física global para execução periódica; transação do chamador."""
    now = await session.scalar(select(func.clock_timestamp()))
    result = await session.execute(
        delete(HistoryEntry).where(HistoryEntry.created_at <= now - RETENTION)
    )
    return result.rowcount


class HistoryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _prepare(self, user_id: UUID, kind: Kind):
        if kind not in ("search", "route"):
            raise BusinessRuleException(
                "Tipo de histórico inválido.", code="VALIDATION_ERROR"
            )
        # Serializa leitura, limpeza e inserções da mesma conta entre workers.
        owner = await self.session.scalar(
            select(User.id).where(User.id == user_id).with_for_update()
        )
        if owner is None:
            raise UnauthorizedException()
        now = await self.session.scalar(select(func.clock_timestamp()))
        await self.session.execute(
            delete(HistoryEntry).where(
                HistoryEntry.user_id == user_id,
                HistoryEntry.created_at <= now - RETENTION,
            )
        )
        return now

    async def create(self, user_id: UUID, payload: SearchCreate | RouteHistoryCreate):
        kind = "search" if isinstance(payload, SearchCreate) else "route"
        encrypted = encrypt_sensitive_field(payload.model_dump_json())
        try:
            now = await self._prepare(user_id, kind)
            entry = HistoryEntry(
                user_id=user_id, kind=kind, payload_encrypted=encrypted, created_at=now
            )
            self.session.add(entry)
            await self.session.flush()
            excess = (
                select(HistoryEntry.id)
                .where(HistoryEntry.user_id == user_id, HistoryEntry.kind == kind)
                .order_by(HistoryEntry.created_at.desc(), HistoryEntry.id.desc())
                .offset(MAX_RECORDS)
            )
            await self.session.execute(
                delete(HistoryEntry).where(HistoryEntry.id.in_(excess))
            )
            result = read_entry(entry)
            await self.session.commit()
            return result
        except Exception:
            await self.session.rollback()
            raise

    async def list(
        self, user_id: UUID, kind: Kind, *, page: int = 1, page_size: int = 20
    ):
        if (
            type(page) is not int
            or type(page_size) is not int
            or page < 1
            or not 1 <= page_size <= 100
        ):
            raise BusinessRuleException("Paginação inválida.", code="VALIDATION_ERROR")
        try:
            await self._prepare(user_id, kind)
            scope = (HistoryEntry.user_id == user_id, HistoryEntry.kind == kind)
            total = await self.session.scalar(
                select(func.count()).select_from(HistoryEntry).where(*scope)
            )
            entries = (
                await self.session.scalars(
                    select(HistoryEntry)
                    .where(*scope)
                    .order_by(HistoryEntry.created_at.desc(), HistoryEntry.id.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
            result = [read_entry(entry) for entry in entries]
            await self.session.commit()
            return result, total
        except Exception:
            await self.session.rollback()
            raise

    async def clear(self, user_id: UUID, kind: Kind) -> None:
        try:
            await self._prepare(user_id, kind)
            await self.session.execute(
                delete(HistoryEntry).where(
                    HistoryEntry.user_id == user_id, HistoryEntry.kind == kind
                )
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
