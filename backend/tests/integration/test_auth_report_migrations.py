"""Atualiza históricos existentes e impede chaves estrangeiras com dados órfãos."""

import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
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


@pytest.mark.parametrize(
    "initial",
    [None, "0007_create_safety_guides", "0008_risk_geography_indexes"],
    ids=["schema_vazio", "head_orientacoes", "head_indices"],
)
def test_merged_history_preserves_data_and_matches_models(migration_database, initial):
    from src.core.database import Base

    engine, migrate = migration_database
    preserved = {}
    if initial is not None:
        migrate("upgrade", initial)
        user_id = uuid4()
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO users (id, username, email_encrypted, email_lookup, "
                    "password_hash, created_at, updated_at) VALUES "
                    "(:id, 'teste', 'email-ficticio-cifrado', :lookup, "
                    "'hash-ficticio', now(), now())"
                ),
                {"id": user_id, "lookup": user_id.hex},
            )
            ids = {"users": user_id, "reports": insert_report(connection, user_id)}
            record_id = uuid4()
            if initial == "0007_create_safety_guides":
                connection.execute(
                    text(
                        "INSERT INTO safety_guides "
                        "(id, slug, title, summary, content, position) VALUES "
                        "(:id, 'orientacao-ficticia', 'Teste', 'Resumo fictício', "
                        "'Conteúdo fictício a preservar', 99)"
                    ),
                    {"id": record_id},
                )
                ids["safety_guides"] = record_id
            else:
                connection.execute(
                    text(
                        "INSERT INTO ssp_safety_records "
                        "(id, source_key, source_version, is_active, source_url, "
                        "source_period, file_sha256) VALUES "
                        "(:id, :source, 1, false, 'https://example.invalid/fixture', "
                        "'2026', :source)"
                    ),
                    {"id": record_id, "source": record_id.hex * 2},
                )
                ids["ssp_safety_records"] = record_id
            for table, record_id in ids.items():
                preserved[table] = (
                    record_id,
                    tuple(
                        connection.execute(
                            text(f"SELECT * FROM {table} WHERE id = :id"),
                            {"id": record_id},
                        ).one()
                    ),
                )
    else:
        with engine.connect() as connection:
            schema = connection.scalar(text("SELECT current_schema()"))
            assert inspect(connection).get_table_names(schema=schema) == [
                "alembic_version"
            ]

    migrate("upgrade", "head")
    migrate("check")
    with engine.connect() as connection:
        schema = connection.scalar(text("SELECT current_schema()"))
        assert schema.startswith("migration_")
        inspector = inspect(connection)
        assert set(Base.metadata.tables) <= set(
            inspector.get_table_names(schema=schema)
        )
        assert connection.execute(
            text("SELECT version_num FROM alembic_version")
        ).scalars().all() == ["0009_create_history"]
        for table, (record_id, before) in preserved.items():
            after = connection.execute(
                text(f"SELECT * FROM {table} WHERE id = :id"), {"id": record_id}
            ).one()
            assert tuple(after) == before

        foreign_keys = inspector.get_foreign_keys(
            "password_reset_tokens", schema=schema
        )
        assert any(
            fk["constrained_columns"] == ["user_id"]
            and fk["referred_table"] == "users"
            and fk["referred_columns"] == ["id"]
            and fk["options"].get("ondelete") == "CASCADE"
            for fk in foreign_keys
        )
        assert any(
            index["column_names"] == ["user_id"]
            for index in inspector.get_indexes("password_reset_tokens", schema=schema)
        )
        assert any(
            constraint["column_names"] == ["token_hash"]
            for constraint in inspector.get_unique_constraints(
                "password_reset_tokens", schema=schema
            )
        )


def test_history_migration_roundtrip_and_cascade(migration_database):
    engine, migrate = migration_database
    migrate("upgrade", "head")
    user_id, entry_id = uuid4(), uuid4()
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id,username,email_encrypted,email_lookup,password_hash,created_at,updated_at) VALUES (:id,'history','cipher',:lookup,'hash',now(),now())"
            ),
            {"id": user_id, "lookup": user_id.hex},
        )
        connection.execute(
            text(
                "INSERT INTO history_entries (id,user_id,kind,payload_encrypted) VALUES (:id,:owner,'search','cipher')"
            ),
            {"id": entry_id, "owner": user_id},
        )
        assert connection.scalar(text("SELECT count(*) FROM history_entries")) == 1
        connection.execute(text("DELETE FROM users WHERE id=:id"), {"id": user_id})
        assert connection.scalar(text("SELECT count(*) FROM history_entries")) == 0
    migrate("downgrade", "d54d18c82688")
    with engine.connect() as connection:
        schema = connection.scalar(text("SELECT current_schema()"))
        assert not inspect(connection).has_table("history_entries", schema=schema)
    migrate("upgrade", "head")
    migrate("check")
