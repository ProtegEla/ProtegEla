import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_get_useful_numbers_returns_200(async_client: AsyncClient):
    response = await async_client.get("/api/v1/emergency/useful-numbers")

    assert response.status_code == 200


@pytest.mark.anyio
async def test_get_useful_numbers_response(async_client: AsyncClient):
    response = await async_client.get("/api/v1/emergency/useful-numbers")

    data = response.json()

    assert "data" in data
    assert isinstance(data["data"], list)
    assert len(data["data"]) == 5

    for number in data["data"]:
        assert set(number.keys()) == {"name", "phone", "description"}
        assert number["name"]
        assert number["phone"]
        assert number["description"]


@pytest.mark.anyio
async def test_get_useful_numbers_without_login(async_client: AsyncClient):
    response = await async_client.get("/api/v1/emergency/useful-numbers")

    assert response.status_code == 200

    phones = {number["phone"] for number in response.json()["data"]}

    assert "180" in phones
    assert "190" in phones