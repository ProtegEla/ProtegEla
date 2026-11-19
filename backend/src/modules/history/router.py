from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.comments.schemas import PageMeta
from src.modules.history.schemas import (
    HistoryPage,
    HistoryResponse,
    RouteHistoryCreate,
    RouteHistoryRead,
    SearchCreate,
    SearchRead,
)
from src.modules.history.service import HistoryService


def private_response(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def get_history_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> HistoryService:
    return HistoryService(session)


router = APIRouter(
    prefix="/users/me", tags=["History"], dependencies=[Depends(private_response)]
)
Owner = Annotated[UUID, Depends(get_current_author)]
Service = Annotated[HistoryService, Depends(get_history_service)]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.post(
    "/search-history", status_code=201, response_model=HistoryResponse[SearchRead]
)
async def create_search(payload: SearchCreate, owner: Owner, service: Service):
    return HistoryResponse(data=await service.create(owner, payload))


@router.post(
    "/route-history", status_code=201, response_model=HistoryResponse[RouteHistoryRead]
)
async def create_route(payload: RouteHistoryCreate, owner: Owner, service: Service):
    return HistoryResponse(data=await service.create(owner, payload))


@router.get("/search-history", response_model=HistoryPage[SearchRead])
async def list_searches(
    owner: Owner, service: Service, page: Page = 1, page_size: PageSize = 20
):
    entries, total = await service.list(owner, "search", page=page, page_size=page_size)
    return HistoryPage(
        data=entries, meta=PageMeta(page=page, page_size=page_size, total_records=total)
    )


@router.get("/route-history", response_model=HistoryPage[RouteHistoryRead])
async def list_routes(
    owner: Owner, service: Service, page: Page = 1, page_size: PageSize = 20
):
    entries, total = await service.list(owner, "route", page=page, page_size=page_size)
    return HistoryPage(
        data=entries, meta=PageMeta(page=page, page_size=page_size, total_records=total)
    )


@router.delete("/search-history", status_code=204)
async def clear_searches(owner: Owner, service: Service) -> Response:
    await service.clear(owner, "search")
    return Response(status_code=204, headers={"Cache-Control": "no-store"})


@router.delete("/route-history", status_code=204)
async def clear_routes(owner: Owner, service: Service) -> Response:
    await service.clear(owner, "route")
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
