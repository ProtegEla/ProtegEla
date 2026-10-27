import pytest
from src.core.security import hash_password, decode_token
from src.core.exceptions import UnauthorizedException
from src.modules.auth.service import authenticate_credentials


def test_login_senha_correta():
    password_hash = hash_password("senha1234")

    tokens = authenticate_credentials(
        "usuarioTeste",
        "senha1234",
        password_hash,
    )

    access = decode_token(tokens["access_token"])
    refresh = decode_token(tokens["refresh_token"])

    assert tokens["token_type"] == "bearer"
    assert access["sub"] == "usuarioTeste"
    assert access["type"] == "access"
    assert refresh["type"] == "refresh"


def test_login_senha_incorreta():
    password_hash = hash_password("senha1234")

    with pytest.raises(
        UnauthorizedException,
        match="credenciais inválidas",
    ):
        authenticate_credentials(
            "usuario-teste",
            "senhaFalsa",
            password_hash,
        )