"""Atualiza históricos existentes e impede chaves estrangeiras com dados órfãos."""

import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


@pytest.fixture
def migration_database():
    database_url = os.getenv("TEST_DATABASE_SYNC_URL")
    if not database_url:
        pytest.skip("Defina TEST_DATABASE_SYNC_URL para testar migrações")
    url = make_url(database_url)
    if not url.database or not url.database.endswith("_test"):
        pytest.fail("As migrações de teste exigem banco terminado em _test")
    schema = "migration_" + uuid4().hex
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        # Impede que Alembic encontre a tabela de versão do schema public.
        connection.execute(
            text(
                f'CREATE TABLE "{schema}".alembic_version '
                "(version_num varchar(32) PRIMARY KEY)"
            )
        )
    isolated_url = url.update_query_dict({"options": f"-csearch_path={schema},public"})
    engine = create_engine(isolated_url)

    def migrate(*args, succeeds=True):
        environment = {
            **os.environ,
            "DEBUG": "false",
            "DATABASE_SYNC_URL": url.render_as_string(hide_password=False),
            "PGOPTIONS": f"-csearch_path={schema},public",
        }
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=Path(__file__).resolve().parents[2],
            env=environment,
            check=False,
            capture_output=True,
            text=True,
        )
        assert (result.returncode == 0) is succeeds, result.stderr
        return result

    try:
        yield engine, migrate
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def insert_report(connection, author_id):
    report_id = uuid4()
    connection.execute(
        text(
            "INSERT INTO reports (id, author_id, category, location, incident_date, "
            "incident_period, is_anonymous) VALUES (:id, :author, 'Furto', "
            "ST_SetSRID(ST_MakePoint(-46.63, -23.55), 4326), '2000-01-01', 'noite', true)"
        ),
        {"id": report_id, "author": author_id},
    )
    return report_id


@pytest.mark.parametrize("initial", ["0003_report_interactions", "df09e334f526"])
def test_upgrade_preserves_data_from_each_history(migration_database, initial):
    engine, migrate = migration_database
    migrate("upgrade", initial)
    user_id = uuid4()

    def insert_user(connection):
        connection.execute(
            text(
                "INSERT INTO users (id, username, email_encrypted, email_lookup, "
                "password_hash, created_at, updated_at) VALUES "
                "(:id, 'teste', 'fixture', :lookup, 'fixture', now(), now())"
            ),
            {"id": user_id, "lookup": user_id.hex},
        )

    # Insere dados antes de reunir os históricos, como em uma base de colega.
    with engine.begin() as connection:
        if initial == "0003_report_interactions":
            report_id = insert_report(connection, user_id)
        else:
            insert_user(connection)
    migrate("upgrade", "0004_merge_auth_reports")
    with engine.begin() as connection:
        if initial == "0003_report_interactions":
            insert_user(connection)
        else:
            report_id = insert_report(connection, user_id)
    migrate("upgrade", "head")
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT author_id FROM reports WHERE id=:id"), {"id": report_id}
            )
            == user_id
        )
    migrate("downgrade", "0004_merge_auth_reports")
    migrate("upgrade", "head")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM reports")) == 1


def test_orphan_reference_aborts_without_deleting_data(migration_database):
    engine, migrate = migration_database
    migrate("upgrade", "0004_merge_auth_reports")
    with engine.begin() as connection:
        report_id = insert_report(connection, uuid4())
    result = migrate("upgrade", "head", succeeds=False)
    assert "Há referências sem conta em reports.author_id" in result.stderr
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT id FROM reports")) == report_id
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0004_merge_auth_reports"
        )


def test_comments_migration_preserves_existing_reports(migration_database):
    engine, migrate = migration_database
    migrate("upgrade", "0005_report_user_foreign_keys")
    user_id = uuid4()
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, username, email_encrypted, email_lookup, "
                "password_hash, created_at, updated_at) VALUES "
                "(:id, 'teste', 'fixture', :lookup, 'fixture', now(), now())"
            ),
            {"id": user_id, "lookup": user_id.hex},
        )
        report_id = insert_report(connection, user_id)
    migrate("upgrade", "head")
    with engine.begin() as connection:
        assert connection.scalar(text("SELECT count(*) FROM comments")) == 0
        connection.execute(
            text(
                "INSERT INTO comments (id, report_id, author_id, text) "
                "VALUES (:id, :report_id, :author_id, 'Comentário')"
            ),
            {"id": uuid4(), "report_id": report_id, "author_id": user_id},
        )
    migrate("downgrade", "0005_report_user_foreign_keys")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT id FROM reports")) == report_id
    migrate("upgrade", "head")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM comments")) == 0
        assert connection.scalar(text("SELECT id FROM reports")) == report_id
