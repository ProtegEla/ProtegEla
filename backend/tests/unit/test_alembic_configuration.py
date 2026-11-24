"""A URL passa pelo env.py real sem abrir conexões ou executar migrações."""

import os
import runpy
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import sqlalchemy
from alembic import context
from alembic.config import Config
from src.core.config import settings


@pytest.mark.parametrize("offline", [False, True], ids=["online", "offline"])
@pytest.mark.parametrize(
    "application_name",
    ["teste", "teste%40exemplo", "teste%25exemplo"],
    ids=["comum", "percent40", "percent25"],
)
def test_env_preserves_database_url(monkeypatch, offline, application_name):
    # Endereço fictício; a criação da engine e o contexto Alembic são simulados.
    url = (
        "postgresql+psycopg2://example.invalid/protegela_test"
        f"?application_name={application_name}"
    )
    config = Config()
    configure = MagicMock()
    run_migrations = MagicMock()
    engine_from_config = MagicMock()
    monkeypatch.setenv("DATABASE_SYNC_URL", url)
    monkeypatch.setattr(settings, "DATABASE_SYNC_URL", url)
    monkeypatch.setattr(context, "config", config, raising=False)
    monkeypatch.setattr(context, "is_offline_mode", lambda: offline)
    monkeypatch.setattr(context, "configure", configure)
    monkeypatch.setattr(context, "begin_transaction", MagicMock())
    monkeypatch.setattr(context, "run_migrations", run_migrations)
    monkeypatch.setattr(sqlalchemy, "engine_from_config", engine_from_config)
    # env.py acrescenta um caminho ao importar; restaura-o ao encerrar o teste.
    monkeypatch.setattr(sys, "path", sys.path.copy())

    runpy.run_path(str(Path(__file__).resolve().parents[2] / "alembic" / "env.py"))

    assert config.get_main_option("sqlalchemy.url") == url
    assert settings.DATABASE_SYNC_URL == url
    assert os.environ["DATABASE_SYNC_URL"] == url
    if offline:
        engine_from_config.assert_not_called()
        assert configure.call_args.kwargs["url"] == url
    else:
        engine_from_config.assert_called_once()
        assert engine_from_config.call_args.args[0]["sqlalchemy.url"] == url
    run_migrations.assert_called_once_with()
