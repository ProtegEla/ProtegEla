"""Índices RN03 preservam dados no upgrade e downgrade."""

from sqlalchemy import text
from tests.integration import test_auth_report_migrations as migrations

migration_database = migrations.migration_database


def test_geography_indexes_preserve_records(migration_database):
    engine, migrate = migration_database
    migrate("upgrade", "0007_ssp_safety_records")
    with engine.begin() as conn:
        conn.execute(
            text(
                """INSERT INTO ssp_safety_records
            (id, source_key, source_version, is_active, source_url, source_period, file_sha256)
            VALUES ('00000000-0000-4000-8000-000000000001', repeat('a',64), 1,
                    false, 'https://www.ssp.sp.gov.br/fixture', '2026', repeat('b',64))"""
            )
        )
    migrate("upgrade", "head")
    with engine.connect() as conn:
        names = set(
            conn.scalars(
                text(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()"
                )
            )
        )
        assert {"ix_reports_visible_geography", "ix_ssp_active_geography"} <= names
    migrate("downgrade", "0007_ssp_safety_records")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT count(*) FROM ssp_safety_records")) == 1
        names = set(
            conn.scalars(
                text(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()"
                )
            )
        )
        assert "ix_ssp_active_geography" not in names
    migrate("upgrade", "head")
    migrate("check")
