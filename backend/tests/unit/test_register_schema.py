import pytest
from pydantic import ValidationError
from src.modules.auth.router import RegisterRequest

def _payload(**overrides):
    data = {
        "username": "maria",
        "email": "maria@email.com",
        "password": "Senha@123",
        "emergency_contacts": [{"name": "Mãe", "phone": "11987654321", "is_primary": True}],
    }
    data.update(overrides)
    return data


def test_valid_payload_normalizes_email_and_phone():
    """E-mail vai para minúsculas e telefone fica só com dígitos."""
    req = RegisterRequest(**_payload(email="  Maria@Email.COM ", emergency_contacts=[{"name": "Mãe", "phone": "(11) 98765-4321", "is_primary": True}]))
    assert req.email == "maria@email.com"
    assert req.emergency_contacts[0].phone == "11987654321"


def test_accepts_up_to_three_contacts_with_one_primary():
    """1 principal e até 2 secundários (RF01)."""
    contacts = [
        {"name": "A", "phone": "11987654321", "is_primary": True},
        {"name": "B", "phone": "11987654322"},
        {"name": "C", "phone": "+5511987654323"},
    ]
    assert len(RegisterRequest(**_payload(emergency_contacts=contacts)).emergency_contacts) == 3


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "mariaemail.com"},
        {"email": "maria@email"},
        {"username": "ma"},
        {"emergency_contacts": []},
        {"emergency_contacts": [{"name": str(i), "phone": "11987654321", "is_primary": i == 0} for i in range(4)]},
        {"emergency_contacts": [{"name": "A", "phone": "11987654321", "is_primary": True}, {"name": "B", "phone": "11987654322", "is_primary": True}]},
        {"emergency_contacts": [{"name": "A", "phone": "11987654321"}]},
        {"emergency_contacts": [{"name": "A", "phone": "1234", "is_primary": True}]},
    ],
    ids=["email_sem_arroba", "email_sem_dominio", "username_curto", "sem_contatos", "4_contatos", "2_principais", "nenhum_principal", "telefone_invalido"],
)
def test_invalid_payload_is_rejected(overrides):
    """Dados fora das regras do RF01 são rejeitados pelo schema."""
    with pytest.raises(ValidationError):
        RegisterRequest(**_payload(**overrides))