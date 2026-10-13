import pytest
from src.core.exceptions import BusinessRuleException
from src.core.security import validate_password_strength


def test_valid_password_passes_validation():
    """Valida se uma senha que atende todos os critérios da RN08 é aceita."""
    valid_passwords = [
        "ProtegEla@2026",
        "Seguranca#123",
        "SpMulher!99",
    ]
    for pwd in valid_passwords:
        # Não deve levantar exceção
        validate_password_strength(pwd)


def test_password_too_short_raises_exception():
    """Valida se senha com menos de 8 caracteres falha (RN08)."""
    with pytest.raises(BusinessRuleException) as exc_info:
        validate_password_strength("Ab1!xyz")
    assert exc_info.value.code == "PASSWORD_TOO_SHORT"


def test_password_missing_uppercase_raises_exception():
    """Valida se senha sem maiúscula falha (RN08)."""
    with pytest.raises(BusinessRuleException) as exc_info:
        validate_password_strength("seguranca@123")
    assert exc_info.value.code == "PASSWORD_MISSING_UPPERCASE"


def test_password_missing_lowercase_raises_exception():
    """Valida se senha sem minúscula falha (RN08)."""
    with pytest.raises(BusinessRuleException) as exc_info:
        validate_password_strength("SEGURANCA@123")
    assert exc_info.value.code == "PASSWORD_MISSING_LOWERCASE"


def test_password_missing_digit_raises_exception():
    """Valida se senha sem número falha (RN08)."""
    with pytest.raises(BusinessRuleException) as exc_info:
        validate_password_strength("Seguranca@Proteg")
    assert exc_info.value.code == "PASSWORD_MISSING_DIGIT"


def test_password_missing_special_char_raises_exception():
    """Valida se senha sem caractere especial falha (RN08)."""
    with pytest.raises(BusinessRuleException) as exc_info:
        validate_password_strength("Seguranca2026")
    assert exc_info.value.code == "PASSWORD_MISSING_SPECIAL_CHAR"
