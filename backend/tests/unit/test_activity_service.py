"""Permissões, preservação de identidade e atomicidade do histórico RF04."""

from datetime import date
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.exceptions import BusinessRuleException, ForbiddenException
from src.modules.reports.models import Report
from src.modules.reports.schemas import ReportCreate
from src.modules.reports.service import ReportService
from src.modules.users.service import list_activity


@pytest.mark.anyio
@pytest.mark.parametrize("page,size", [(0, 20), (1, 101), (True, 20), (1, 0)])
async def test_activity_invalid_pagination(page, size):
    session = AsyncMock(spec=AsyncSession)
    with pytest.raises(BusinessRuleException):
        await list_activity(session, uuid4(), page=page, page_size=size)
    session.execute.assert_not_awaited()


@pytest.fixture
def service():
    service = ReportService(AsyncMock(spec=AsyncSession))
    service.require_visible = AsyncMock()
    return service


def payload():
    return ReportCreate.model_validate(
        {
            "location": {"latitude": -23.55, "longitude": -46.63},
            "category": "Furto",
            "description": "  Corrigido  ",
            "incident_date": "2000-01-01",
            "incident_period": "noite",
            "is_anonymous": True,
        }
    ).to_service_data()


@pytest.mark.anyio
@pytest.mark.parametrize("action", ["edit", "delete"])
async def test_report_only_author_can_mutate(service, action):
    service.require_visible.return_value = Report(author_id=uuid4())
    kwargs = {"author_id": uuid4()}
    if action == "edit":
        kwargs["data"] = payload()
    with pytest.raises(ForbiddenException):
        await getattr(service, action)(uuid4(), **kwargs)
    service.session.commit.assert_not_awaited()
    service.session.rollback.assert_awaited_once()
    service.session.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_edit_preserves_creation_identity_and_moderation(service):
    owner, device = uuid4(), uuid4()
    report = Report(id=uuid4(), author_id=owner, device_id=device, is_hidden=False)
    service.require_visible.return_value = report
    result = await service.edit(report.id, payload(), author_id=owner)
    assert result is report
    assert (report.author_id, report.device_id, report.is_hidden) == (
        owner,
        device,
        False,
    )
    assert report.description == "Corrigido"
    assert report.incident_date == date(2000, 1, 1)
    service.require_visible.assert_awaited_once_with(report.id, lock=True)
    service.session.commit.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("action", ["edit", "delete"])
async def test_write_failure_rolls_back(service, action):
    owner = uuid4()
    service.require_visible.return_value = Report(author_id=owner)
    service.session.flush.side_effect = RuntimeError("write")
    service.session.execute.side_effect = RuntimeError("write")
    kwargs = {"author_id": owner}
    if action == "edit":
        kwargs["data"] = payload()
    with pytest.raises(RuntimeError, match="write"):
        await getattr(service, action)(uuid4(), **kwargs)
    service.session.rollback.assert_awaited_once()
    service.session.commit.assert_not_awaited()


@pytest.mark.anyio
async def test_get_missing_comment_raises_not_found():
    from unittest.mock import MagicMock
    from src.core.exceptions import EntityNotFoundException
    from src.modules.comments.service import CommentService

    service = CommentService(AsyncMock(spec=AsyncSession))
    service.reports.require_visible = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.one_or_none.return_value = None
    service.session.execute.return_value = result
    with pytest.raises(EntityNotFoundException):
        await service.get(uuid4(), uuid4())
    service.session.commit.assert_not_awaited()
