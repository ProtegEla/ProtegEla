from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db_session
from src.modules.auth.dependencies import get_current_author
from src.modules.comments.schemas import PageMeta
from src.modules.users.schemas import ActivityPage
from src.modules.users.service import list_activity

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def users_status():
    """Endpoint inicial de status do módulo de usuárias."""
    return {"module": "users", "status": "initialized"}


@router.get("/me/activity", response_model=ActivityPage)
async def get_activity(
    author_id: Annotated[UUID, Depends(get_current_author)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ActivityPage:
    entries, total = await list_activity(
        session, author_id, page=page, page_size=page_size
    )
    return ActivityPage(
        data=entries, meta=PageMeta(page=page, page_size=page_size, total_records=total)
    )
