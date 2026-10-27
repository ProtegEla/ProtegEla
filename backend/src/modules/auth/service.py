"""
Serviço de regras de negócio do módulo Auth.

Responsabilidades futuras (a serem implementadas pelo responsável do módulo):
- Registro de usuário com validação de unicidade de e-mail (RF01) e senha forte (RN08).
- Autenticação e validação de hash de senha (RF02).
- Emissão e renovação de tokens JWT (Access e Refresh).
- Fluxo de recuperação de senha via e-mail (RF16).
"""
from src.core.exceptions import UnauthorizedException
from src.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
)


def authenticate_credentials(
    user_id: str,
    password: str,
    password_hash: str,

) -> dict[str, str]:

    if not verify_password(password, password_hash):
        raise UnauthorizedException("credenciais inválidas")

    return {
        "access_token": create_access_token(user_id),
        "refresh_token": create_refresh_token(user_id),
        "token_type": "bearer",
    }