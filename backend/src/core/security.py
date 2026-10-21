from datetime import datetime, timedelta, timezone
import re
from typing import Any, Dict, Optional
import hashlib
import hmac

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from src.core.config import settings
from src.core.exceptions import BusinessRuleException, UnauthorizedException

# Contexto de hashing de senhas priorizando Argon2id com fallback para bcrypt
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

# Instância Fernet para criptografia em repouso de dados sensíveis (LGPD: e-mails, telefones)
_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        try:
            _fernet = Fernet(settings.FIELD_ENCRYPTION_KEY.encode())
        except Exception:
            # Fallback seguro em desenvolvimento caso a chave não seja informada
            key = Fernet.generate_key()
            _fernet = Fernet(key)
    return _fernet


def validate_password_strength(password: str) -> None:
    """
    Validação da Regra de Negócio RN08:
    A senha cadastrada deve conter no mínimo 8 caracteres, incluindo pelo menos
    uma letra maiúscula, uma letra minúscula, um número e um caractere especial.
    """
    if len(password) < 8:
        raise BusinessRuleException(
            "A senha deve conter no mínimo 8 caracteres (RN08).",
            code="PASSWORD_TOO_SHORT",
        )
    if not re.search(r"[A-Z]", password):
        raise BusinessRuleException(
            "A senha deve conter pelo menos uma letra maiúscula (RN08).",
            code="PASSWORD_MISSING_UPPERCASE",
        )
    if not re.search(r"[a-z]", password):
        raise BusinessRuleException(
            "A senha deve conter pelo menos uma letra minúscula (RN08).",
            code="PASSWORD_MISSING_LOWERCASE",
        )
    if not re.search(r"[0-9]", password):
        raise BusinessRuleException(
            "A senha deve conter pelo menos um número (RN08).",
            code="PASSWORD_MISSING_DIGIT",
        )
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_+=\[\]\\/;`~]", password):
        raise BusinessRuleException(
            "A senha deve conter pelo menos um caractere especial (RN08).",
            code="PASSWORD_MISSING_SPECIAL_CHAR",
        )


def hash_password(password: str) -> str:
    """Gera hash criptográfico da senha utilizando Argon2id."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto confere com o hash armazenado."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra_claims: Optional[Dict[str, Any]] = None) -> str:
    """Emite um JWT Access Token de curta duração."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expires,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.APP_SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Emite um JWT Refresh Token de longa duração."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expires,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.APP_SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decodifica e valida assinatura e expiração de um JWT."""
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise UnauthorizedException("Token inválido ou expirado.")


def encrypt_sensitive_field(plain_value: str) -> str:
    """Cifra dados pessoais sensíveis em repouso (RNF06 - conformidade LGPD)."""
    fernet = get_fernet()
    return fernet.encrypt(plain_value.encode("utf-8")).decode("utf-8")


def decrypt_sensitive_field(encrypted_value: str) -> str:
    """Decifra dados sensíveis cifrados em repouso."""
    fernet = get_fernet()
    return fernet.decrypt(encrypted_value.encode("utf-8")).decode("utf-8")


def compute_lookup_hash(plain_value: str) -> str:
    """Gera hash HMAC-SHA256"""
    normalized = plain_value.strip().lower()
    return hmac.new(settings.FIELD_LOOKUP_KEY.encode("utf-8"),normalized.encode("utf-8"),hashlib.sha256).hexdigest()
