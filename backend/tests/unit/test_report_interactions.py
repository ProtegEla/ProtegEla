"""Regras de confirmação e denúncia, sem HTTP ou banco real."""

from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.exceptions import (
    AppException,
    EntityNotFoundException,
    ForbiddenException,
)
from src.modules.reports.models import Report, ReportInteractionKind
from src.modules.reports.service import ReportService


@pytest.fixture
def session() -> Mock:
    return Mock(spec=AsyncSession)


@pytest.fixture
def report() -> Report:
    return Report(id=uuid4(), author_id=uuid4(), is_hidden=False)


@pytest.mark.anyio
@pytest.mark.parametrize("method", ["confirm", "report_abuse"])
async def test_missing_or_hidden_report_is_not_found(
    session: Mock, report: Report, method: str
) -> None:
    session.scalar.return_value = None
    with pytest.raises(EntityNotFoundException):
        await getattr(ReportService(session), method)(report.id, user_id=uuid4())
    session.add.assert_not_called()
    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("method", ["confirm", "report_abuse"])
async def test_author_cannot_interact(
    session: Mock, report: Report, method: str
) -> None:
    session.scalar.return_value = report
    with pytest.raises(ForbiddenException):
        await getattr(ReportService(session), method)(
            report.id, user_id=report.author_id
        )
    session.add.assert_not_called()
    session.rollback.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "method, existing",
    [
        ("confirm", ReportInteractionKind.ABUSE),
        ("report_abuse", ReportInteractionKind.CONFIRMATION),
    ],
)
async def test_opposite_interaction_is_conflict(
    session: Mock, report: Report, method: str, existing: ReportInteractionKind
) -> None:
    session.scalar.side_effect = [report, existing]
    with pytest.raises(AppException) as error:
        await getattr(ReportService(session), method)(report.id, user_id=uuid4())
    assert error.value.code == "INTERACTION_CONFLICT"
    assert error.value.status_code == 409
    session.add.assert_not_called()
    session.rollback.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "method, existing",
    [
        ("confirm", ReportInteractionKind.CONFIRMATION),
        ("report_abuse", ReportInteractionKind.ABUSE),
    ],
)
async def test_repeated_interaction_has_no_new_writes(
    session: Mock, report: Report, method: str, existing: ReportInteractionKind
) -> None:
    session.scalar.side_effect = [report, existing]
    await getattr(ReportService(session), method)(report.id, user_id=uuid4())
    session.add.assert_not_called()
    session.flush.assert_not_awaited()
    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "confirmations, abuses, hidden",
    [(0, 1, True), (3, 1, True), (10, 3, False), (10, 4, True)],
)
async def test_abuse_applies_exact_threshold(
    session: Mock, report: Report, confirmations: int, abuses: int, hidden: bool
) -> None:
    session.scalar.side_effect = [report, None]
    result = Mock()
    result.all.return_value = [
        (ReportInteractionKind.CONFIRMATION, confirmations),
        (ReportInteractionKind.ABUSE, abuses),
    ]
    session.execute.return_value = result
    user_id = uuid4()
    await ReportService(session).report_abuse(report.id, user_id=user_id)
    interaction = session.add.call_args.args[0]
    assert interaction.report_id == report.id
    assert interaction.user_id == user_id
    assert interaction.kind is ReportInteractionKind.ABUSE
    assert report.is_hidden is hidden
    session.flush.assert_awaited_once()
    session.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_confirmation_does_not_query_abuse_totals(
    session: Mock, report: Report
) -> None:
    session.scalar.side_effect = [report, None]
    await ReportService(session).confirm(report.id, user_id=uuid4())
    assert session.add.call_args.args[0].kind is ReportInteractionKind.CONFIRMATION
    assert report.is_hidden is False
    session.execute.assert_not_awaited()
    session.commit.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["scalar", "flush", "execute", "commit"])
async def test_interaction_failure_reverts_transaction(
    session: Mock, report: Report, operation: str
) -> None:
    session.scalar.side_effect = [report, None]
    result = Mock()
    result.all.return_value = [(ReportInteractionKind.ABUSE, 1)]
    session.execute.return_value = result
    getattr(session, operation).side_effect = RuntimeError("database failure")
    with pytest.raises(RuntimeError, match="database failure"):
        await ReportService(session).report_abuse(report.id, user_id=uuid4())
    session.rollback.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("field", ["report_id", "user_id"])
async def test_invalid_identifier_does_not_query_database(
    session: Mock, field: str
) -> None:
    parameters = {"report_id": uuid4(), "user_id": uuid4()}
    parameters[field] = "invalid"
    with pytest.raises(AppException) as error:
        await ReportService(session).confirm(**parameters)
    assert error.value.code == "VALIDATION_ERROR"
    session.scalar.assert_not_awaited()
