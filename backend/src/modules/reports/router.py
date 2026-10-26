from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, status
from pydantic import UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.reports.schemas import ReportCreate, ReportCreated, ReportRead
from src.modules.reports.service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


async def get_report_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ReportService:
    return ReportService(session)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ReportCreated,
    responses={
        401: {"description": "Credencial ausente, inválida ou expirada."},
        422: {"description": "Dados ou identificador de dispositivo inválidos."},
        429: {"description": "Limite de criação por dispositivo excedido."},
        503: {"description": "Verificação de existência da conta indisponível."},
    },
)
async def create_report(
    payload: ReportCreate,
    author_id: Annotated[UUID, Depends(get_current_author)],
    device_id: Annotated[UUID4, Header(alias="X-Device-Id")],
    service: Annotated[ReportService, Depends(get_report_service)],
) -> ReportCreated:
    report = await service.create(
        payload.to_service_data(), author_id=author_id, device_id=device_id
    )
    return ReportCreated(data=ReportRead.from_report(report))


@router.get("/status", status_code=status.HTTP_200_OK)
async def reports_status():
    """Endpoint inicial de status do módulo de relatos."""
    return {"module": "reports", "status": "initialized"}
