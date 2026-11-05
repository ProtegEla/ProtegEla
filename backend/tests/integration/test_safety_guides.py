from uuid import UUID

import pytest

from src.modules.safety_guides.models import SafetyGuide

URL = "/api/v1/safety-guides"
SUMMARY = {"id", "slug", "title", "summary", "position"}


def guide(n: int, slug: str, position: int) -> SafetyGuide:
    return SafetyGuide(id=UUID(f"00000000-0000-4000-8000-00000000000{n}"), slug=slug, title=f"Título {slug}", summary=f"Resumo {slug}", content=f"Conteúdo {slug}", position=position)


@pytest.fixture
async def guides(test_db):
    # Inseridas fora de ordem; "fui-furtada" e "alguem-esta-me-seguindo" empatam em position e desempatam pelo id.
    items = [guide(3, "alguem-esta-me-seguindo", 2), guide(2, "fui-furtada", 2), guide(1, "o-que-e-assedio", 1)]
    async with test_db() as session:
        session.add_all(items)
        await session.commit()
    return items


@pytest.mark.anyio
async def test_list_is_public_ordered_and_without_content(async_client, guides):
    for headers in ({}, {"Authorization": "Bearer invalid"}):
        response = await async_client.get(URL, headers=headers)
        assert response.status_code == 200
        data = response.json()["data"]
        assert [item["slug"] for item in data] == ["o-que-e-assedio", "fui-furtada", "alguem-esta-me-seguindo"]
        assert all(set(item) == SUMMARY for item in data)


@pytest.mark.anyio
async def test_list_empty(async_client, test_db):
    response = await async_client.get(URL)
    assert (response.status_code, response.json()) == (200, {"data": []})


@pytest.mark.anyio
async def test_detail_returns_full_content(async_client, guides):
    response = await async_client.get(f"{URL}/fui-furtada")
    assert response.status_code == 200
    data = response.json()["data"]
    assert set(data) == SUMMARY | {"content", "updated_at"}
    assert (data["id"], data["title"], data["content"], data["position"]) == ("00000000-0000-4000-8000-000000000002", "Título fui-furtada", "Conteúdo fui-furtada", 2)
    assert data["updated_at"].endswith("Z")


@pytest.mark.anyio
async def test_unknown_slug_returns_not_found(async_client, guides):
    response = await async_client.get(f"{URL}/nao-existe")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.anyio
@pytest.mark.parametrize("slug", ["Fui-Furtada", "fui_furtada", "fui%20furtada", "a" * 81])
async def test_invalid_slug_returns_validation_error(async_client, test_db, slug):
    response = await async_client.get(f"{URL}/{slug}")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"