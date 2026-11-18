from unittest.mock import AsyncMock, MagicMock
import pytest
from sqlalchemy.exc import IntegrityError

from src.core.exceptions import BusinessRuleException
from src.core.security import compute_lookup_hash, decrypt_sensitive_field, verify_password
from src.modules.auth.service import EmailAlreadyRegisteredException, register_user

CONTACTS = [{"name": "Mãe", "phone": "11987654321", "is_primary": True}]

def _fake_session(existing_user_id=None):
    """Sessão falsa"""
    session = MagicMock()
    session.scalar = AsyncMock(return_value=existing_user_id)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.mark.anyio
async def test_register_user_encrypts_sensitive_data():
    """Cadastro válido salva e-mail/telefone cifrados, HMAC e senha em hash (LGPD)."""
    session = _fake_session()
    user = await register_user(session, username="maria", email="maria@email.com", password="Senha@123", emergency_contacts=CONTACTS)

    session.add.assert_called_once_with(user)
    session.commit.assert_awaited_once()
    assert user.email_encrypted != "maria@email.com"
    assert decrypt_sensitive_field(user.email_encrypted) == "maria@email.com"
    assert user.email_lookup == compute_lookup_hash("maria@email.com")
    assert user.password_hash != "Senha@123"
    assert verify_password("Senha@123", user.password_hash)
    assert len(user.emergency_contacts) == 1
    assert user.emergency_contacts[0].phone_encrypted != "11987654321"
    assert decrypt_sensitive_field(user.emergency_contacts[0].phone_encrypted) == "11987654321"
    assert user.emergency_contacts[0].is_primary is True


@pytest.mark.anyio
async def test_register_user_rejects_duplicate_email():
    """Se o e-mail já existe, lança 409 e não salva nada."""
    session = _fake_session(existing_user_id="id-existente")
    with pytest.raises(EmailAlreadyRegisteredException) as exc_info:
        await register_user(session, username="maria", email="maria@email.com", password="Senha@123", emergency_contacts=CONTACTS)
    assert exc_info.value.status_code == 409
    session.add.assert_not_called()


@pytest.mark.anyio
async def test_register_user_rejects_weak_password_before_querying_db():
    """Senha fraca (RN08) é barrada antes de consultar o banco."""
    session = _fake_session()
    with pytest.raises(BusinessRuleException):
        await register_user(session, username="maria", email="maria@email.com", password="123", emergency_contacts=CONTACTS)
    session.scalar.assert_not_awaited()


@pytest.mark.anyio
async def test_register_user_handles_concurrent_duplicate():
    """Cadastro simultâneo com mesmo e-mail: o índice único do banco barra e vira 409."""
    session = _fake_session()
    session.commit.side_effect = IntegrityError("INSERT", {}, Exception("duplicate key"))
    with pytest.raises(EmailAlreadyRegisteredException):
        await register_user(session, username="maria", email="maria@email.com", password="Senha@123", emergency_contacts=CONTACTS)
    session.rollback.assert_awaited_once()