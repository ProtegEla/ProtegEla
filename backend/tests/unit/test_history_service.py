from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from cryptography.fernet import InvalidToken
from pydantic import ValidationError
from src.core.exceptions import BusinessRuleException, UnauthorizedException
from src.core.security import encrypt_sensitive_field
from src.modules.history.models import HistoryEntry
from src.modules.history.schemas import RouteHistoryCreate, SearchCreate
from src.modules.history.service import HistoryService, read_entry


@pytest.mark.parametrize("label", ["", "  ", "a" * 301, 123])
def test_search_rejects_invalid_labels(label):
    with pytest.raises(ValidationError):
        SearchCreate(label=label)


def test_history_normalizes_labels_and_rejects_unapproved_data():
    assert SearchCreate(label="  Paulista  ").label == "Paulista"
    with pytest.raises(ValidationError):
        SearchCreate(label="Paulista", latitude=-23.5)
    with pytest.raises(ValidationError):
        RouteHistoryCreate(
            origin_label="A",
            destination_label="B",
            stop_labels=["C"] * 4,
            distance_m=1,
            duration_s=1,
        )


@pytest.mark.parametrize("value", [0, -1, True, "10", float("nan"), float("inf")])
def test_route_summary_requires_positive_numeric_totals(value):
    with pytest.raises(ValidationError):
        RouteHistoryCreate(
            origin_label="A", destination_label="B", distance_m=value, duration_s=1
        )


@pytest.mark.anyio
async def test_missing_owner_rolls_back_without_saving():
    session = AsyncMock()
    session.scalar.return_value = None
    with pytest.raises(UnauthorizedException):
        await HistoryService(session).create(uuid4(), SearchCreate(label="Paulista"))
    session.commit.assert_not_awaited()
    session.execute.assert_not_awaited()
    session.rollback.assert_awaited_once()


@pytest.mark.anyio
async def test_invalid_pagination_does_not_query_database():
    session = AsyncMock()
    with pytest.raises(BusinessRuleException):
        await HistoryService(session).list(uuid4(), "search", page_size=101)
    session.scalar.assert_not_awaited()


def test_read_entry_decrypts_summary_and_excludes_owner():
    entry = HistoryEntry(
        id=uuid4(),
        user_id=uuid4(),
        kind="search",
        payload_encrypted=encrypt_sensitive_field('{"label":"Paulista"}'),
        created_at=datetime.now(UTC),
    )
    result = read_entry(entry).model_dump(mode="json")
    assert set(result) == {"id", "label", "created_at"}
    assert result["label"] == "Paulista"
    assert result["created_at"].endswith("Z")
    entry.payload_encrypted = "corrupt"
    with pytest.raises(InvalidToken):
        read_entry(entry)
