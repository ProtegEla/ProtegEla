"""Configuração de fixtures para testes com pytest."""

import base64
import os

import pytest
from httpx import ASGITransport, AsyncClient

# Valores públicos e fixos, exclusivos dos testes; nunca usar em um ambiente real.
os.environ["FIELD_ENCRYPTION_KEY"] = base64.urlsafe_b64encode(bytes(range(32))).decode()
os.environ["FIELD_LOOKUP_KEY"] = "lookup-ficticio-exclusivo-dos-testes"
os.environ["APP_SECRET_KEY"] = "jwt-ficticio-exclusivo-dos-testes-39"

# A importação deve ocorrer depois da configuração das chaves de teste.
from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
