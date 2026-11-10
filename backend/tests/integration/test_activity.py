"""RF04 HTTP com identidade e persistência reais."""

from datetime import date
from uuid import uuid4

import pytest
from conftest import new_user
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from src.core.security import create_access_token
from src.modules.comments.models import Comment
from src.modules.reports.models import Report, ReportInteraction, ReportInteractionKind


@pytest.mark.anyio
async def test_activity_navigation_mutations_and_isolation(async_client, test_db):
    owner, other = new_user(), new_user()
    async with test_db() as session:
        session.add_all([owner, other])
        await session.flush()
        report = Report(
            author_id=owner.id,
            category="Furto",
            location=from_shape(Point(-46.63, -23.55), srid=4326),
            incident_date=date(2000, 1, 1),
            incident_period="noite",
            is_anonymous=True,
        )
        session.add(report)
        await session.flush()
        root = Comment(report_id=report.id, author_id=owner.id, text="Meu comentário")
        session.add(root)
        await session.flush()
        reply = Comment(
            report_id=report.id, author_id=other.id, text="Resposta", parent_id=root.id
        )
        session.add_all(
            [
                reply,
                ReportInteraction(
                    report_id=report.id,
                    user_id=other.id,
                    kind=ReportInteractionKind.CONFIRMATION,
                ),
            ]
        )
        await session.commit()
    headers = {"Authorization": "Bearer " + create_access_token(str(owner.id))}
    other_headers = {"Authorization": "Bearer " + create_access_token(str(other.id))}
    activity = "/api/v1/users/me/activity"
    first = await async_client.get(activity, headers=headers, params={"page_size": 1})
    assert first.status_code == 200
    assert first.json()["meta"]["total_records"] == 2
    second = await async_client.get(
        activity, headers=headers, params={"page_size": 1, "page": 2}
    )
    items = first.json()["data"] + second.json()["data"]
    assert {item["type"] for item in items} == {"report", "comment"}
    assert len({item["id"] for item in items}) == 2
    assert all(
        set(item) == {"id", "report_id", "type", "text", "created_at"} for item in items
    )
    empty = await async_client.get(activity, headers=headers, params={"page": 10})
    assert empty.json()["data"] == []
    assert empty.json()["meta"]["total_records"] == 2
    other_activity = await async_client.get(activity, headers=other_headers)
    assert [item["id"] for item in other_activity.json()["data"]] == [str(reply.id)]
    base = f"/api/v1/reports/{report.id}"
    comment_url = f"{base}/comments/{root.id}"
    assert (await async_client.get(comment_url)).json()["data"][
        "text"
    ] == "Meu comentário"
    assert (
        await async_client.get(f"/api/v1/reports/{uuid4()}/comments/{root.id}")
    ).status_code == 404
    body = (await async_client.get(base)).json()["data"]
    original_created = body.pop("created_at")
    body.pop("id")
    body.pop("confirmations_count")
    body["description"] = "Corrigido"
    for method, kwargs in [("put", {"json": body}), ("delete", {})]:
        assert (
            await getattr(async_client, method)(base, headers=other_headers, **kwargs)
        ).status_code == 403
    edited = await async_client.put(base, headers=headers, json=body)
    assert edited.status_code == 200
    assert edited.json()["data"]["created_at"] == original_created
    assert (await async_client.get(base)).json()["data"]["confirmations_count"] == 1
    assert (await async_client.delete(comment_url, headers=headers)).status_code == 204
    assert (await async_client.get(comment_url)).status_code == 404
    assert len((await async_client.get(activity, headers=headers)).json()["data"]) == 1
    assert (await async_client.delete(base, headers=headers)).status_code == 204
    assert (await async_client.get(base)).status_code == 404
    assert (await async_client.get(activity, headers=headers)).json()["data"] == []
    async with test_db() as session:
        assert await session.get(Comment, reply.id) is None


@pytest.mark.anyio
async def test_activity_hidden_filter_and_validation(async_client, test_db):
    user = new_user()
    async with test_db() as session:
        session.add(user)
        await session.flush()
        report = Report(
            author_id=user.id,
            category="Furto",
            location=from_shape(Point(-46.63, -23.55), srid=4326),
            incident_date=date(2000, 1, 1),
            incident_period="noite",
            is_anonymous=True,
            is_hidden=True,
        )
        session.add(report)
        await session.flush()
        session.add(Comment(report_id=report.id, author_id=user.id, text="Oculto"))
        await session.commit()
    headers = {"Authorization": "Bearer " + create_access_token(str(user.id))}
    url = "/api/v1/users/me/activity"
    assert (await async_client.get(url, headers=headers)).json()["data"] == []
    for query in ({"page": 0}, {"page_size": 101}):
        assert (
            await async_client.get(url, headers=headers, params=query)
        ).status_code == 422
    for request_headers in (
        {},
        {"Authorization": "Bearer invalid"},
        {"Authorization": "Bearer " + create_access_token(str(uuid4()))},
    ):
        assert (await async_client.get(url, headers=request_headers)).status_code == 401
    base = f"/api/v1/reports/{report.id}"
    assert (await async_client.delete(base, headers=headers)).status_code == 404


@pytest.mark.anyio
async def test_report_mutation_auth_and_payload_validation(async_client, test_db):
    user = new_user()
    async with test_db() as session:
        session.add(user)
        await session.commit()
    headers = {"Authorization": "Bearer " + create_access_token(str(user.id))}
    base = f"/api/v1/reports/{uuid4()}"
    body = {
        "location": {"latitude": -23.55, "longitude": -46.63},
        "category": "Furto",
        "incident_date": "2000-01-01",
        "incident_period": "noite",
        "is_anonymous": False,
    }
    for method, kwargs in [("put", {"json": body}), ("delete", {})]:
        assert (await getattr(async_client, method)(base, **kwargs)).status_code == 401
        assert (
            await getattr(async_client, method)(base, headers=headers, **kwargs)
        ).status_code == 404
    for invalid in (
        {},
        {**body, "author_id": str(user.id)},
        {**body, "incident_date": "2999-01-01"},
        {**body, "incident_time": "08:00"},
    ):
        response = await async_client.put(base, headers=headers, json=invalid)
        assert response.status_code == 422
    assert (
        await async_client.delete("/api/v1/reports/invalid", headers=headers)
    ).status_code == 422
