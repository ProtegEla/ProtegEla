"""Rotas públicas das orientações de segurança"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.modules.safety_guides.schemas import (
    SafetyGuideList,
    SafetyGuideRead,
    SafetyGuideResponse,
    SafetyGuideSummary,
)
from src.modules.safety_guides.service import SafetyGuideService

router = APIRouter(tags=["Safety Guides"])

async def get_safety_guide_service(session: Annotated[AsyncSession, Depends(get_db_session)]) -> SafetyGuideService:
    return SafetyGuideService(session)

@router.get("/safety-guides", response_model=SafetyGuideList, status_code=status.HTTP_200_OK)
async def list_safety_guides(service: Annotated[SafetyGuideService, Depends(get_safety_guide_service)]) -> SafetyGuideList:
    return SafetyGuideList(data=[SafetyGuideSummary.model_validate(guide) for guide in await service.list()])


@router.get("/safety-guides/{slug}", response_model=SafetyGuideResponse, status_code=status.HTTP_200_OK)
async def get_safety_guide(slug: Annotated[str, Path(pattern=r"^[a-z0-9-]{1,80}$")], service: Annotated[SafetyGuideService, Depends(get_safety_guide_service)]) -> SafetyGuideResponse:
    return SafetyGuideResponse(data=SafetyGuideRead.model_validate(await service.get_by_slug(slug)))