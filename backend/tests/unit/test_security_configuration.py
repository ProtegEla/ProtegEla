"""Configuração explícita e leitura de dados entre processos independentes."""

import base64
import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from pydantic import ValidationError
from src.core import security
from src.core.config import Settings, settings


@pytest.fixture
def configured_keys():
    return {
        name: os.environ[name] for name in ("FIELD_ENCRYPTION_KEY", "FIELD_LOOKUP_KEY")
    }


def test_valid_keys_are_preserved(configured_keys):
    configured = Settings(_env_file=None, **configured_keys)
    assert configured.FIELD_ENCRYPTION_KEY == configured_keys["FIELD_ENCRYPTION_KEY"]
    assert configured.FIELD_LOOKUP_KEY == configured_keys["FIELD_LOOKUP_KEY"]
    Fernet(configured.FIELD_ENCRYPTION_KEY.encode())
    for value in configured_keys.values():
        assert value not in repr(configured)


@pytest.mark.parametrize("name", ["FIELD_ENCRYPTION_KEY", "FIELD_LOOKUP_KEY"])
def test_missing_key_is_rejected(name, configured_keys, monkeypatch):
    monkeypatch.delenv(name)
    configured_keys.pop(name)
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, **configured_keys)
    assert name in str(error.value)
    for value in configured_keys.values():
        assert value not in str(error.value)


@pytest.mark.parametrize("name", ["FIELD_ENCRYPTION_KEY", "FIELD_LOOKUP_KEY"])
@pytest.mark.parametrize("value", ["", "   ", "\t\n", None])
def test_empty_or_invalid_type_is_rejected(name, value, configured_keys):
    configured_keys[name] = value
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, **configured_keys)
    assert name in str(error.value)
    assert "input_value" not in str(error.value)
    assert "input_type" not in str(error.value)


@pytest.mark.parametrize(
    "value",
    [
        "segredo-ficticio-invalido",
        "☃",
        base64.urlsafe_b64encode(b"tamanho-invalido").decode(),
    ],
)
def test_invalid_fernet_key_does_not_expose_inputs(value, configured_keys):
    configured_keys["FIELD_ENCRYPTION_KEY"] = value
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, **configured_keys)
    message = str(error.value)
    assert "FIELD_ENCRYPTION_KEY" in message
    assert "chave Fernet válida" in message
    for secret in configured_keys.values():
        assert secret not in message
        assert secret not in repr(error.value)


def test_lookup_key_spaces_are_preserved(configured_keys):
    configured_keys["FIELD_LOOKUP_KEY"] = "  segredo-ficticio-de-lookup  "
    configured = Settings(_env_file=None, **configured_keys)
    assert configured.FIELD_LOOKUP_KEY == configured_keys["FIELD_LOOKUP_KEY"]


def test_invalid_key_never_generates_a_replacement(monkeypatch):
    monkeypatch.setattr(security, "_fernet", None)
    monkeypatch.setattr(settings, "FIELD_ENCRYPTION_KEY", "invalida")
    with patch.object(Fernet, "generate_key") as generate:
        with pytest.raises(ValueError):
            security.get_fernet()
        generate.assert_not_called()
    assert security._fernet is None


@pytest.fixture
def run_security_process(tmp_path, configured_keys):
    script = """
import json
import sys
from cryptography.fernet import InvalidToken
from src.core.security import (
    compute_lookup_hash, encrypt_sensitive_field, decrypt_sensitive_field,
)

request = json.load(sys.stdin)
if request['operation'] == 'encrypt':
    result = {'ciphertext': encrypt_sensitive_field(request['value'])}
else:
    try:
        result = {'plaintext': decrypt_sensitive_field(request['value'])}
    except InvalidToken:
        result = {'invalid_token': True}
result['lookup'] = compute_lookup_hash(request['email'])
print(json.dumps(result))
"""

    def run(operation, value, *, email="maria@example.com", **keys):
        environment = {
            "PYTHONPATH": str(Path(__file__).resolve().parents[2]),
            **configured_keys,
            "APP_SECRET_KEY": os.environ["APP_SECRET_KEY"],
            **keys,
        }
        result = subprocess.run(
            [sys.executable, "-B", "-c", script],
            input=json.dumps({"operation": operation, "value": value, "email": email}),
            capture_output=True,
            text=True,
            check=True,
            cwd=tmp_path,
            env=environment,
            timeout=15,
        )
        return json.loads(result.stdout)

    return run


def test_encryption_and_lookup_survive_process_restarts(run_security_process):
    original = run_security_process("encrypt", "telefone-ficticio")
    for _ in range(2):
        restarted = run_security_process(
            "decrypt", original["ciphertext"], email="  MARIA@EXAMPLE.COM  "
        )
        assert restarted["plaintext"] == "telefone-ficticio"
        assert restarted["lookup"] == original["lookup"]


def test_different_encryption_key_cannot_decrypt(run_security_process):
    original = run_security_process("encrypt", "telefone-ficticio")
    other_key = base64.urlsafe_b64encode(bytes(reversed(range(32)))).decode()
    other = run_security_process(
        "decrypt", original["ciphertext"], FIELD_ENCRYPTION_KEY=other_key
    )
    assert other["invalid_token"] is True
    assert other["lookup"] == original["lookup"]


def test_different_lookup_key_changes_email_lookup(run_security_process):
    original = run_security_process("encrypt", "telefone-ficticio")
    other = run_security_process(
        "decrypt",
        original["ciphertext"],
        FIELD_LOOKUP_KEY="outro-segredo-ficticio-de-lookup",
    )
    assert other["plaintext"] == "telefone-ficticio"
    assert other["lookup"] != original["lookup"]


def test_application_import_rejects_invalid_configuration(tmp_path, configured_keys):
    result = subprocess.run(
        [sys.executable, "-B", "-c", "from src.main import app"],
        capture_output=True,
        text=True,
        check=False,
        cwd=tmp_path,
        env={
            "PYTHONPATH": str(Path(__file__).resolve().parents[2]),
            **configured_keys,
            "FIELD_ENCRYPTION_KEY": "segredo-invalido-na-inicializacao",
        },
        timeout=15,
    )
    assert result.returncode != 0
    assert "FIELD_ENCRYPTION_KEY" in result.stderr
    assert "segredo-invalido-na-inicializacao" not in result.stderr
    assert configured_keys["FIELD_LOOKUP_KEY"] not in result.stderr
