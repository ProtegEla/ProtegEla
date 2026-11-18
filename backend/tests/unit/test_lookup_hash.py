from src.core.security import compute_lookup_hash

def test_lookup_hash_is_deterministic():
    """O mesmo e-mail sempre gera o mesmo hash."""
    assert compute_lookup_hash("maria@email.com") == compute_lookup_hash("maria@email.com")

def test_lookup_hash_ignores_case_and_spaces():
    """Maiúsculas e espaços nas pontas não mudam o hash."""
    assert compute_lookup_hash("  Maria@Email.COM ") == compute_lookup_hash("maria@email.com")


def test_lookup_hash_differs_for_different_emails():
    """E-mails diferentes geram hashes diferentes."""
    assert compute_lookup_hash("maria@email.com") != compute_lookup_hash("ana@email.com")


def test_lookup_hash_has_64_hex_chars_and_hides_email():
    """O hash cabe na coluna email_lookup (64) e não contém o e-mail em texto puro."""
    result = compute_lookup_hash("maria@email.com")
    assert len(result) == 64
    assert "maria" not in result