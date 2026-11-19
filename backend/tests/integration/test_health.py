import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_health_check_returns_healthy(async_client: AsyncClient):
    """Testa se o endpoint de healthcheck responde com 200 e status healthy."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ProtegEla API"


@pytest.mark.anyio
async def test_root_endpoint_returns_metadata(async_client: AsyncClient):
    """Testa se o endpoint raiz responde com links para documentação."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert "docs" in data


@pytest.mark.anyio
@pytest.mark.parametrize(
    "module_path",
    [
        "/api/v1/auth/status",
        "/api/v1/users/status",
        "/api/v1/reports/status",
        "/api/v1/comments/status",
        "/api/v1/risk-zones/status",
        "/api/v1/routes/status",
        "/api/v1/emergency/status",
        "/api/v1/support-locations/status",
        "/api/v1/notifications/status",
    ],
)
async def test_module_routers_are_accessible(async_client: AsyncClient, module_path: str):
    """Verifica se todos os 9 módulos da arquitetura estão devidamente montados na API v1."""
    response = await async_client.get(module_path)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "initialized"
