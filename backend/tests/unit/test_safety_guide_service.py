from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import EntityNotFoundException
from src.modules.safety_guides.models import SafetyGuide
from src.modules.safety_guides.service import SafetyGuideService


def new_guide(slug: str, position: int) -> SafetyGuide:
    return SafetyGuide(
        id=uuid4(),
        slug=slug,
        title=f"Título {position}",
        summary="Resumo",
        content="Conteúdo",
        position=position,
    )


def sql(statement) -> str:
    return str(statement.compile(compile_kwargs={"literal_binds": True}))


@pytest.fixture
def service():
    return SafetyGuideService(AsyncMock(spec=AsyncSession))


@pytest.mark.anyio
async def test_list_returns_guides_from_query(service):
    guides = [new_guide("o-que-e-assedio", 1), new_guide("fui-furtada", 2)]
    service.session.scalars.return_value = guides
    assert await service.list() == guides


@pytest.mark.anyio
async def test_list_orders_by_position_then_id(service):
    service.session.scalars.return_value = []
    await service.list()
    statement = service.session.scalars.await_args.args[0]
    assert "ORDER BY safety_guides.position, safety_guides.id" in sql(statement)


@pytest.mark.anyio
async def test_list_empty(service):
    service.session.scalars.return_value = []
    assert await service.list() == []


@pytest.mark.anyio
async def test_get_by_slug_returns_guide(service):
    guide = new_guide("fui-furtada", 2)
    service.session.scalar.return_value = guide
    assert await service.get_by_slug("fui-furtada") is guide
    statement = service.session.scalar.await_args.args[0]
    assert "safety_guides.slug = 'fui-furtada'" in sql(statement)


@pytest.mark.anyio
async def test_get_by_slug_missing_raises_not_found(service):
    service.session.scalar.return_value = None
    with pytest.raises(EntityNotFoundException) as error:
        await service.get_by_slug("nao-existe")
    assert error.value.code == "NOT_FOUND"


@pytest.mark.anyio
async def test_queries_are_read_only(service):
    service.session.scalars.return_value = []
    service.session.scalar.return_value = new_guide("fui-furtada", 2)
    await service.list()
    await service.get_by_slug("fui-furtada")
    service.session.add.assert_not_called()
    service.session.commit.assert_not_awaited()