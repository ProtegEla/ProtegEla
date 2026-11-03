"""Regras de autoria, respostas e transações do RF08."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.exceptions import (
    BusinessRuleException,
    EntityNotFoundException,
    ForbiddenException,
)
from src.modules.comments.models import Comment
from src.modules.comments.service import CommentService, normalize_text


@pytest.mark.parametrize("value", ["", " \n\t", "x" * 1001, None, 1])
def test_invalid_text(value):
    with pytest.raises(BusinessRuleException) as error:
        normalize_text(value)
    assert error.value.code == "VALIDATION_ERROR"


def test_normalizes_text_before_limit():
    assert normalize_text(" \n" + "x" * 1000 + " \t") == "x" * 1000


@pytest.fixture
def service():
    service = CommentService(AsyncMock(spec=AsyncSession))
    service.reports.require_visible = AsyncMock()
    return service


@pytest.mark.anyio
async def test_missing_or_cross_report_parent_rolls_back(service):
    service.session.scalar.return_value = None
    with pytest.raises(EntityNotFoundException):
        await service.create(
            uuid4(), author_id=uuid4(), text="Resposta", parent_id=uuid4()
        )
    service.session.add.assert_not_called()
    service.session.commit.assert_not_awaited()
    service.session.rollback.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("action", ["edit", "delete"])
async def test_only_author_can_mutate(service, action):
    service.session.scalar.return_value = Comment(author_id=uuid4(), text="original")
    args = {"author_id": uuid4()}
    if action == "edit":
        args["text"] = "novo"
    with pytest.raises(ForbiddenException):
        await getattr(service, action)(uuid4(), uuid4(), **args)
    service.session.commit.assert_not_awaited()
    service.session.rollback.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("action", ["edit", "delete"])
async def test_missing_comment_rolls_back(service, action):
    service.session.scalar.return_value = None
    args = {"author_id": uuid4()}
    if action == "edit":
        args["text"] = "novo"
    with pytest.raises(EntityNotFoundException):
        await getattr(service, action)(uuid4(), uuid4(), **args)
    service.session.rollback.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_erases_content_and_identity_without_deleting_replies(service):
    author_id = uuid4()
    parent_id = uuid4()
    comment = Comment(author_id=author_id, text="original", parent_id=parent_id)
    service.session.scalar.return_value = comment
    await service.delete(uuid4(), uuid4(), author_id=author_id)
    assert comment.text is None
    assert comment.author_id is None
    assert comment.is_deleted is True
    assert comment.parent_id == parent_id
    service.session.delete.assert_not_awaited()
    service.session.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_edit_preserves_author_parent_and_creation_time(service):
    author_id, parent_id = uuid4(), uuid4()
    created_at = datetime(2000, 1, 1, tzinfo=UTC)
    comment = Comment(
        id=uuid4(),
        author_id=author_id,
        text="antigo",
        parent_id=parent_id,
        created_at=created_at,
    )
    service.session.scalar.return_value = comment
    service._details = AsyncMock(return_value="projection")
    result = await service.edit(
        uuid4(), comment.id, author_id=author_id, text="  novo  "
    )
    assert result == "projection"
    assert comment.text == "novo"
    assert (comment.author_id, comment.parent_id, comment.created_at) == (
        author_id,
        parent_id,
        created_at,
    )
    service.session.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_creation_failure_rolls_back(service):
    service.session.flush.side_effect = RuntimeError("write failed")
    with pytest.raises(RuntimeError, match="write failed"):
        await service.create(uuid4(), author_id=uuid4(), text="novo")
    service.session.rollback.assert_awaited_once()
    service.session.commit.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("page,page_size", [(0, 20), (1, 0), (1, 101), (True, 20)])
async def test_invalid_pagination(service, page, page_size):
    with pytest.raises(BusinessRuleException):
        await service.list(uuid4(), page=page, page_size=page_size)
    service.session.execute.assert_not_awaited()
