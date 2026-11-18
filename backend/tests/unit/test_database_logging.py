"""Parâmetros SQL não devem aparecer em logs ou na representação de erros."""

import logging

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import StatementError
from src.core.database import engine


def test_application_engine_disables_echo_and_hides_parameters():
    assert engine.echo is False
    assert engine.sync_engine.hide_parameters is True


def test_sql_logs_and_errors_hide_bound_parameters(caplog):
    sensitive = "parametro-ficticio-que-nao-deve-aparecer"
    # Exercita as opções da engine real, sem depender de PostgreSQL ou de rede.
    database = create_engine(
        "sqlite://",
        echo=engine.echo,
        hide_parameters=engine.sync_engine.hide_parameters,
    )
    try:
        with (
            caplog.at_level(logging.INFO, logger="sqlalchemy.engine.Engine"),
            database.connect() as connection,
        ):
            assert (
                connection.scalar(text("SELECT :value"), {"value": sensitive})
                == sensitive
            )
            with pytest.raises(StatementError) as error:
                connection.execute(
                    text("SELECT * FROM tabela_inexistente WHERE value = :value"),
                    {"value": sensitive},
                )
        assert "SELECT" in caplog.text
        assert "parameters hidden" in caplog.text
        assert sensitive not in caplog.text
        assert "parameters hidden" in str(error.value)
        assert sensitive not in str(error.value)
    finally:
        database.dispose()
