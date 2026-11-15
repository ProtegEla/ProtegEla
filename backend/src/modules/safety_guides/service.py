from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import EntityNotFoundException
from src.modules.safety_guides.models import SafetyGuide


class SafetyGuideService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self) -> list[SafetyGuide]:
        result = await self.session.scalars(select(SafetyGuide).order_by(SafetyGuide.position, SafetyGuide.id))
        return list(result)

    async def get_by_slug(self, slug: str) -> SafetyGuide:
        guide = await self.session.scalar(select(SafetyGuide).where(SafetyGuide.slug == slug))
        if guide is None:
            raise EntityNotFoundException("Orientação não encontrada.")
        return guide