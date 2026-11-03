from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Path, status
from pydantic import UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.reports.schemas import (
    AbuseData,
    ConfirmationData,
    EmptyInteraction,
    ReportAbuseRegistered,
    ReportConfirmed,
    ReportCreate,
    ReportCreated,
    ReportDetailData,
    ReportDetailResponse,
    ReportRead,
)
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


# Rotas estáticas, como /status, precisam vir antes de /{id}.
@router.get(
    "/{id}",
    status_code=status.HTTP_200_OK,
    response_model=ReportDetailResponse,
    responses={
        404: {"description": "Relato inexistente ou ocultado."},
        422: {"description": "Identificador inválido."},
    },
)
async def get_report_details(
    report_id: Annotated[UUID4, Path(alias="id")],
    service: Annotated[ReportService, Depends(get_report_service)],
) -> ReportDetailResponse:
    details = await service.get_details(report_id)
    return ReportDetailResponse(data=ReportDetailData.from_details(details))


INTERACTION_ERRORS = {
    401: {"description": "Credencial ausente, inválida ou expirada."},
    403: {"description": "Interação da autora com o próprio relato."},
    404: {"description": "Relato inexistente ou ocultado."},
    409: {"description": "Já existe interação de outro tipo."},
    422: {"description": "Identificador ou corpo inválido."},
    503: {"description": "Verificação de existência da conta indisponível."},
}


@router.post(
    "/{id}/confirm",
    status_code=status.HTTP_200_OK,
    response_model=ReportConfirmed,
    responses=INTERACTION_ERRORS,
)
async def confirm_report(
    report_id: Annotated[UUID4, Path(alias="id")],
    payload: EmptyInteraction,
    user_id: Annotated[UUID, Depends(get_current_author)],
    service: Annotated[ReportService, Depends(get_report_service)],
) -> ReportConfirmed:
    await service.confirm(report_id, user_id=user_id)
    return ReportConfirmed(data=ConfirmationData(report_id=report_id))


@router.post(
    "/{id}/report-abuse",
    status_code=status.HTTP_200_OK,
    response_model=ReportAbuseRegistered,
    responses=INTERACTION_ERRORS,
)
async def report_abuse(
    report_id: Annotated[UUID4, Path(alias="id")],
    payload: EmptyInteraction,
    user_id: Annotated[UUID, Depends(get_current_author)],
    service: Annotated[ReportService, Depends(get_report_service)],
) -> ReportAbuseRegistered:
    await service.report_abuse(report_id, user_id=user_id)
    return ReportAbuseRegistered(data=AbuseData(report_id=report_id))
