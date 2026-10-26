"""Testes opt-in no schema migrado de um banco PostgreSQL/PostGIS de testes.

Defina TEST_DATABASE_SYNC_URL para executar. Cada teste reverte suas alterações.
"""

import os
from collections.abc import Iterator
from datetime import date
from uuid import uuid4

import pytest
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.modules.reports.models import (
    IncidentPeriod,
    Report,
    ReportCategory,
    ReportInteraction,
    ReportInteractionKind,
)


@pytest.fixture
def report_session() -> Iterator[Session]:
    database_url = os.environ.get("TEST_DATABASE_SYNC_URL")
    if not database_url:
        pytest.skip("Defina TEST_DATABASE_SYNC_URL para testar PostgreSQL/PostGIS")
    url = make_url(database_url)
    if not url.database or not url.database.endswith("_test"):
        pytest.fail("Os testes de persistência exigem um banco terminado em _test")
    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                with Session(bind=connection) as session:
                    yield session
            finally:
                if transaction.is_active:
                    transaction.rollback()
    finally:
        engine.dispose()


def new_report() -> Report:
    return Report(
        author_id=uuid4(),
        category=ReportCategory.MA_ILUMINACAO,
        location=from_shape(Point(-46.633308, -23.55052), srid=4326),
        incident_date=date(2026, 10, 25),
        incident_period=IncidentPeriod.NOITE,
        is_anonymous=True,
    )


def test_anonymous_incident_preserves_author_and_location(
    report_session: Session,
) -> None:
    report = new_report()
    author_id = report.author_id
    report_session.add(report)
    report_session.flush()
    report_id = report.id
    report_session.expunge_all()

    saved = report_session.get(Report, report_id)
    assert saved is not None
    assert saved.author_id == author_id
    assert saved.is_anonymous is True
    assert saved.is_hidden is False
    assert saved.category is ReportCategory.MA_ILUMINACAO
    assert saved.incident_period is IncidentPeriod.NOITE
    assert saved.incident_date == date(2026, 10, 25)
    assert saved.incident_time is None
    assert saved.description is None
    assert saved.address_reference is None
    assert saved.created_at.utcoffset() is not None
    assert saved.id.version == 4
    assert saved.location.srid == 4326
    point = to_shape(saved.location)
    assert point.x == pytest.approx(-46.633308)
    assert point.y == pytest.approx(-23.55052)


@pytest.mark.parametrize(
    "statement, constraint",
    [
        (
            "UPDATE reports SET category = 'outra' WHERE id = :id",
            "report_category",
        ),
        (
            "UPDATE reports SET incident_period = 'outro' WHERE id = :id",
            "incident_period",
        ),
    ],
)
def test_database_rejects_invalid_categories_and_periods(
    report_session: Session, statement: str, constraint: str
) -> None:
    report = new_report()
    report_session.add(report)
    report_session.flush()

    with pytest.raises(IntegrityError) as error, report_session.begin_nested():
        report_session.execute(text(statement), {"id": report.id})
    assert error.value.orig.diag.constraint_name == constraint


def test_anonymity_does_not_allow_missing_author(report_session: Session) -> None:
    report = new_report()
    report_session.add(report)
    report_session.flush()

    with pytest.raises(IntegrityError) as error, report_session.begin_nested():
        report_session.execute(
            text("UPDATE reports SET author_id = NULL WHERE id = :id"),
            {"id": report.id},
        )
    assert error.value.orig.diag.column_name == "author_id"


@pytest.mark.parametrize("kind", list(ReportInteractionKind))
def test_interaction_round_trip(
    report_session: Session, kind: ReportInteractionKind
) -> None:
    report = new_report()
    report_session.add(report)
    report_session.flush()
    user_id = uuid4()
    interaction = ReportInteraction(report_id=report.id, user_id=user_id, kind=kind)
    report_session.add(interaction)
    report_session.flush()
    interaction_id, report_id = interaction.id, report.id
    report_session.expunge_all()

    saved = report_session.get(ReportInteraction, interaction_id)
    assert saved is not None
    assert saved.id.version == 4
    assert saved.report_id == report_id
    assert saved.user_id == user_id
    assert saved.kind is kind
    assert saved.created_at.utcoffset() is not None


@pytest.mark.parametrize("first", list(ReportInteractionKind))
@pytest.mark.parametrize("second", list(ReportInteractionKind))
def test_database_prevents_duplicate_and_opposite_interactions(
    report_session: Session,
    first: ReportInteractionKind,
    second: ReportInteractionKind,
) -> None:
    report = new_report()
    report_session.add(report)
    report_session.flush()
    user_id = uuid4()
    report_session.add(
        ReportInteraction(report_id=report.id, user_id=user_id, kind=first)
    )
    report_session.flush()

    with pytest.raises(IntegrityError) as error, report_session.begin_nested():
        report_session.add(
            ReportInteraction(report_id=report.id, user_id=user_id, kind=second)
        )
        report_session.flush()
    assert error.value.orig.diag.constraint_name == "uq_report_interactions_report_user"
    assert (
        report_session.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id == report.id
            )
        )
        == 1
    )


def test_same_user_can_interact_with_different_reports(report_session: Session) -> None:
    first_report, second_report = new_report(), new_report()
    report_session.add_all([first_report, second_report])
    report_session.flush()
    user_id = uuid4()
    report_session.add_all(
        [
            ReportInteraction(
                report_id=first_report.id,
                user_id=user_id,
                kind=ReportInteractionKind.CONFIRMATION,
            ),
            ReportInteraction(
                report_id=second_report.id,
                user_id=user_id,
                kind=ReportInteractionKind.ABUSE,
            ),
            ReportInteraction(
                report_id=first_report.id,
                user_id=uuid4(),
                kind=ReportInteractionKind.CONFIRMATION,
            ),
        ]
    )
    report_session.flush()
    assert (
        report_session.scalar(
            select(func.count(ReportInteraction.id)).where(
                ReportInteraction.report_id.in_([first_report.id, second_report.id])
            )
        )
        == 3
    )


def test_interaction_requires_existing_report(report_session: Session) -> None:
    with pytest.raises(IntegrityError) as error, report_session.begin_nested():
        report_session.add(
            ReportInteraction(
                report_id=uuid4(), user_id=uuid4(), kind=ReportInteractionKind.ABUSE
            )
        )
        report_session.flush()
    assert error.value.orig.diag.constraint_name == "fk_report_interactions_report_id"


def test_database_rejects_unknown_interaction_kind(report_session: Session) -> None:
    report = new_report()
    report_session.add(report)
    report_session.flush()
    interaction = ReportInteraction(
        report_id=report.id, user_id=uuid4(), kind=ReportInteractionKind.CONFIRMATION
    )
    report_session.add(interaction)
    report_session.flush()
    with pytest.raises(IntegrityError) as error, report_session.begin_nested():
        report_session.execute(
            text("UPDATE report_interactions SET kind = 'other' WHERE id = :id"),
            {"id": interaction.id},
        )
    assert error.value.orig.diag.constraint_name == "report_interaction_kind"


def test_hidden_state_is_persisted_and_cannot_be_null(report_session: Session) -> None:
    report = new_report()
    report_session.add(report)
    report_session.flush()
    assert report.is_hidden is False
    report.is_hidden = True
    report_session.flush()
    report_session.refresh(report)
    assert report.is_hidden is True
    with pytest.raises(IntegrityError) as error, report_session.begin_nested():
        report_session.execute(
            text("UPDATE reports SET is_hidden = NULL WHERE id = :id"),
            {"id": report.id},
        )
    assert error.value.orig.diag.column_name == "is_hidden"
