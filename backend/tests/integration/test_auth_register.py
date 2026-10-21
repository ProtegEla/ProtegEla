import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from src.core.security import compute_lookup_hash, decrypt_sensitive_field
from src.modules.users.models import EmergencyContact, User

URL = "/api/v1/auth/register"

def _payload(**overrides):
    data = {
        "username": "maria",
        "email": "maria@email.com",
        "password": "Senha@123",
        "emergency_contacts": [
            {"name": "Mãe", "phone": "(11) 98765-4321", "is_primary": True},
            {"name": "Irmã", "phone": "11912345678"},
        ],
    }
    data.update(overrides)
    return data


async def _count_users(test_db) -> int:
    async with test_db() as session:
        return await session.scalar(select(func.count()).select_from(User))


@pytest.fixture
async def usuaria_cadastrada(async_client: AsyncClient, test_db):
    """Deixa a 'maria' já cadastrada no banco de teste."""
    payload = _payload()
    response = await async_client.post(URL, json=payload)
    assert response.status_code == 201
    return payload


@pytest.mark.anyio
async def test_register_returns_201_without_password(async_client: AsyncClient, test_db):
    """Cadastro válido responde 201 com id, username e email."""
    response = await async_client.post(URL, json=_payload())
    assert response.status_code == 201
    data = response.json()
    assert set(data) == {"id", "username", "email"}
    assert data["username"] == "maria"
    assert data["email"] == "maria@email.com"


@pytest.mark.anyio
async def test_register_saves_encrypted_data_in_database(async_client: AsyncClient, test_db):
    """No banco, e-mail e telefones ficam cifrados e a senha só em hash."""
    await async_client.post(URL, json=_payload())
    async with test_db() as session:
        user = await session.scalar(select(User))
        contacts = (await session.scalars(select(EmergencyContact).where(EmergencyContact.user_id == user.id))).all()
    assert "maria@email.com" not in user.email_encrypted
    assert decrypt_sensitive_field(user.email_encrypted) == "maria@email.com"
    assert user.email_lookup == compute_lookup_hash("maria@email.com")
    assert "Senha@123" not in user.password_hash
    assert len(contacts) == 2
    assert sorted(decrypt_sensitive_field(c.phone_encrypted) for c in contacts) == ["11912345678", "11987654321"]
    assert sum(c.is_primary for c in contacts) == 1


@pytest.mark.anyio
@pytest.mark.parametrize("email", ["maria@email.com", "  MARIA@Email.com "], ids=["mesmo_email", "maiusculas_e_espacos"])
async def test_register_duplicate_email_returns_409(async_client: AsyncClient, usuaria_cadastrada, test_db, email):
    """E-mail já cadastrado (mesmo com maiúsculas/espaços) responde 409 e não cria outra usuária."""
    response = await async_client.post(URL, json=_payload(username="outra", email=email))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"
    assert await _count_users(test_db) == 1


@pytest.mark.anyio
async def test_register_weak_password_returns_422(async_client: AsyncClient, test_db):
    """Senha fora da RN08 responde 422 com o código do motivo e não salva nada."""
    response = await async_client.post(URL, json=_payload(password="123"))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PASSWORD_TOO_SHORT"
    assert await _count_users(test_db) == 0


@pytest.mark.anyio
@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"email": "mariaemail.com"}, "body.email"),
        ({"username": "ma"}, "body.username"),
        ({"emergency_contacts": []}, "body.emergency_contacts"),
        ({"emergency_contacts": [{"name": "A", "phone": "1234", "is_primary": True}]}, "body.emergency_contacts.0.phone"),
    ],
    ids=["email_invalido", "username_curto", "sem_contatos", "telefone_invalido"],
)
async def test_register_invalid_payload_returns_422(async_client: AsyncClient, test_db, overrides, field):
    """Dados inválidos respondem 422 VALIDATION_ERROR apontando o campo e não salvam nada."""
    response = await async_client.post(URL, json=_payload(**overrides))
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"][0]["field"] == field
    assert await _count_users(test_db) == 0