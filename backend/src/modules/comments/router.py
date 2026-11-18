"""Rotas de comentários; validação HTTP e delegação ao serviço."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.comments.schemas import (
    CommentCreate,
    CommentEdit,
    CommentPage,
    CommentRead,
    CommentResponse,
    PageMeta,
)
from src.modules.comments.service import CommentService

router = APIRouter(tags=["Comments"])


async def get_comment_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CommentService:
    return CommentService(session)


@router.get("/comments/status", status_code=status.HTTP_200_OK)
async def comments_status() -> dict[str, str]:
    return {"module": "comments", "status": "initialized"}


@router.get("/reports/{report_id}/comments", response_model=CommentPage)
async def list_comments(
    report_id: UUID4,
    service: Annotated[CommentService, Depends(get_comment_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> CommentPage:
    comments, total = await service.list(report_id, page=page, page_size=page_size)
    return CommentPage(
        data=[CommentRead.model_validate(comment) for comment in comments],
        meta=PageMeta(page=page, page_size=page_size, total_records=total),
    )


@router.post(
    "/reports/{report_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    report_id: UUID4,
    payload: CommentCreate,
    author_id: Annotated[UUID, Depends(get_current_author)],
    service: Annotated[CommentService, Depends(get_comment_service)],
) -> CommentResponse:
    comment = await service.create(
        report_id, author_id=author_id, text=payload.text, parent_id=payload.parent_id
    )
    return CommentResponse(data=CommentRead.model_validate(comment))


@router.patch(
    "/reports/{report_id}/comments/{comment_id}", response_model=CommentResponse
)
async def edit_comment(
    report_id: UUID4,
    comment_id: UUID4,
    payload: CommentEdit,
    author_id: Annotated[UUID, Depends(get_current_author)],
    service: Annotated[CommentService, Depends(get_comment_service)],
) -> CommentResponse:
    comment = await service.edit(
        report_id, comment_id, author_id=author_id, text=payload.text
    )
    return CommentResponse(data=CommentRead.model_validate(comment))


@router.delete(
    "/reports/{report_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_comment(
    report_id: UUID4,
    comment_id: UUID4,
    author_id: Annotated[UUID, Depends(get_current_author)],
    service: Annotated[CommentService, Depends(get_comment_service)],
) -> Response:
    await service.delete(report_id, comment_id, author_id=author_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/reports/{report_id}/comments/{comment_id}", response_model=CommentResponse
)
async def get_comment(
    report_id: UUID4,
    comment_id: UUID4,
    service: Annotated[CommentService, Depends(get_comment_service)],
) -> CommentResponse:
    return CommentResponse(
        data=CommentRead.model_validate(await service.get(report_id, comment_id))
    )
