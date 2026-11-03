"""RF08 por HTTP e PostgreSQL reais, sem substituição de autenticação."""

from datetime import date
from uuid import UUID, uuid1, uuid4

import pytest
from conftest import new_user
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from src.core.security import create_access_token, create_refresh_token
from src.modules.comments.models import Comment
from src.modules.reports.models import IncidentPeriod, Report, ReportCategory


@pytest.fixture
async def context(test_db):
    users = [new_user() for _ in range(3)]
    users[0].username = "maria"
    users[1].username = "ana"
    async with test_db() as session:
        session.add_all(users)
        await session.flush()
        reports = [
            Report(
                author_id=users[0].id,
                category=ReportCategory.FURTO,
                location=from_shape(Point(-46.63, -23.55), srid=4326),
                incident_date=date(2000, 1, 1),
                incident_period=IncidentPeriod.NOITE,
                is_anonymous=True,
            )
            for _ in range(2)
        ]
        session.add_all(reports)
        await session.commit()
    headers = [
        {"Authorization": "Bearer " + create_access_token(str(user.id))}
        for user in users
    ]
    return reports, users, headers


def url(report):
    return f"/api/v1/reports/{report.id}/comments"


async def post(client, report, headers, text="Comentário", **kwargs):
    return await client.post(
        url(report), headers=headers, json={"text": text, **kwargs}
    )


@pytest.mark.anyio
async def test_public_read_create_edit_delete_and_nested_replies(
    async_client, test_db, context
):
    reports, _, headers = context
    report = reports[0]
    empty = await async_client.get(url(report))
    assert empty.status_code == 200
    assert empty.json() == {
        "data": [],
        "meta": {"page": 1, "page_size": 20, "total_records": 0},
    }
    root = await post(async_client, report, headers[0], "  Primeiro  ")
    assert root.status_code == 201
    root = root.json()["data"]
    assert root["text"] == "Primeiro"
    assert root["author"] == "maria"
    assert root["parent_id"] is None
    assert set(root) == {
        "id",
        "report_id",
        "parent_id",
        "author",
        "text",
        "is_deleted",
        "created_at",
        "updated_at",
    }
    assert root["created_at"].endswith("Z")
    reply = await post(async_client, report, headers[1], parent_id=root["id"])
    assert reply.status_code == 201
    reply = reply.json()["data"]
    nested = await post(async_client, report, headers[2], parent_id=reply["id"])
    assert nested.status_code == 201
    nested = nested.json()["data"]
    edited = await async_client.patch(
        f'{url(report)}/{root["id"]}', headers=headers[0], json={"text": "Editado"}
    )
    assert edited.status_code == 200
    assert edited.json()["data"]["created_at"] == root["created_at"]
    assert edited.json()["data"]["text"] == "Editado"
    removed = await async_client.delete(
        f'{url(report)}/{root["id"]}', headers=headers[0]
    )
    assert removed.status_code == 204
    assert removed.content == b""
    public = await async_client.get(
        url(report), headers={"Authorization": "Bearer invalid"}
    )
    assert public.status_code == 200
    data = public.json()["data"]
    assert [item["id"] for item in data] == [root["id"], reply["id"], nested["id"]]
    assert data[0]["is_deleted"] is True
    assert data[0]["text"] is data[0]["author"] is None
    assert data[1]["author"] == "ana"
    assert data[1]["parent_id"] == root["id"]
    assert data[2]["parent_id"] == reply["id"]
    async with test_db() as session:
        saved = await session.get(Comment, UUID(root["id"]))
        assert saved.text is saved.author_id is None
        assert await session.get(Comment, UUID(reply["id"])) is not None
    # Excluir não permite restaurar ou responder ao conteúdo removido.
    assert (
        await post(async_client, report, headers[0], parent_id=root["id"])
    ).status_code == 404
    assert (
        await async_client.patch(
            f'{url(report)}/{root["id"]}',
            headers=headers[0],
            json={"text": "restaurar"},
        )
    ).status_code == 404
    assert (
        await async_client.delete(f'{url(report)}/{root["id"]}', headers=headers[0])
    ).status_code == 404


@pytest.mark.anyio
async def test_only_comment_author_can_edit_or_delete(async_client, context):
    reports, _, headers = context
    report = reports[0]
    response = await post(async_client, report, headers[1], "Autoria de Ana")
    comment_id = response.json()["data"]["id"]
    target = f"{url(report)}/{comment_id}"
    for method, kwargs in (("patch", {"json": {"text": "alteração"}}), ("delete", {})):
        denied = await getattr(async_client, method)(
            target, headers=headers[0], **kwargs
        )
        assert denied.status_code == 403
        assert denied.json()["error"]["code"] == "FORBIDDEN"
    assert (await async_client.get(url(report))).json()["data"][0][
        "text"
    ] == "Autoria de Ana"


@pytest.mark.anyio
async def test_cross_report_parent_and_mutations_are_rejected(async_client, context):
    reports, _, headers = context
    root = (await post(async_client, reports[0], headers[0])).json()["data"]
    invalid_parent = await post(
        async_client, reports[1], headers[0], parent_id=root["id"]
    )
    assert invalid_parent.status_code == 404
    for parent in (str(uuid4()),):
        assert (
            await post(async_client, reports[0], headers[0], parent_id=parent)
        ).status_code == 404
    target = f'{url(reports[1])}/{root["id"]}'
    assert (
        await async_client.patch(target, headers=headers[0], json={"text": "outro"})
    ).status_code == 404
    assert (await async_client.delete(target, headers=headers[0])).status_code == 404


@pytest.mark.anyio
async def test_hidden_and_missing_reports_hide_all_comments(
    async_client, test_db, context
):
    reports, _, headers = context
    report = reports[0]
    root = (await post(async_client, report, headers[0])).json()["data"]
    async with test_db() as session:
        await session.execute(
            update(Report).where(Report.id == report.id).values(is_hidden=True)
        )
        await session.commit()
    for report_id in (report.id, uuid4()):
        base = f"/api/v1/reports/{report_id}/comments"
        for method, path, kwargs in (
            ("get", base, {}),
            ("post", base, {"json": {"text": "novo"}}),
            ("patch", f'{base}/{root["id"]}', {"json": {"text": "novo"}}),
            ("delete", f'{base}/{root["id"]}', {}),
        ):
            response = await getattr(async_client, method)(
                path, headers=headers[0], **kwargs
            )
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.anyio
@pytest.mark.parametrize("credential", [None, "invalid", "missing_account", "refresh"])
async def test_mutations_require_real_access_identity(
    async_client, context, credential
):
    reports, users, headers = context
    root = (await post(async_client, reports[0], headers[0])).json()["data"]
    token = {
        "invalid": "invalid",
        "missing_account": create_access_token(str(uuid4())),
        "refresh": create_refresh_token(str(users[0].id)),
    }.get(credential)
    request_headers = {"Authorization": f"Bearer {token}"} if token else {}
    base = url(reports[0])
    for method, path, kwargs in (
        ("post", base, {"json": {"text": "novo"}}),
        ("patch", f'{base}/{root["id"]}', {"json": {"text": "novo"}}),
        ("delete", f'{base}/{root["id"]}', {}),
    ):
        response = await getattr(async_client, method)(
            path, headers=request_headers, **kwargs
        )
        assert response.status_code == 401


@pytest.mark.anyio
@pytest.mark.parametrize(
    "body",
    [
        None,
        [],
        {},
        {"text": "  "},
        {"text": "x" * 1001},
        {"text": 123},
        {"text": None},
        {"text": "oi", "author_id": str(uuid4())},
        {"text": "oi", "parent_id": str(uuid1())},
    ],
)
async def test_invalid_creation_payload(async_client, context, body):
    reports, _, headers = context
    response = await async_client.post(url(reports[0]), headers=headers[0], json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.anyio
async def test_edit_cannot_reparent_or_change_author(async_client, context):
    reports, _, headers = context
    root = (await post(async_client, reports[0], headers[0])).json()["data"]
    for field, value in (
        ("parent_id", str(uuid4())),
        ("author_id", str(uuid4())),
        ("is_deleted", True),
    ):
        response = await async_client.patch(
            f'{url(reports[0])}/{root["id"]}',
            headers=headers[0],
            json={"text": "novo", field: value},
        )
        assert response.status_code == 422


@pytest.mark.anyio
async def test_pagination_and_isolation(async_client, context):
    reports, _, headers = context
    ids = []
    for number in range(3):
        response = await post(async_client, reports[0], headers[0], str(number))
        ids.append(response.json()["data"]["id"])
    await post(async_client, reports[1], headers[0], "Outro relato")
    first = (await async_client.get(url(reports[0]), params={"page_size": 2})).json()
    second = (
        await async_client.get(url(reports[0]), params={"page_size": 2, "page": 2})
    ).json()
    assert [item["id"] for item in first["data"] + second["data"]] == ids
    assert first["meta"]["total_records"] == second["meta"]["total_records"] == 3
    empty = (await async_client.get(url(reports[0]), params={"page": 10})).json()
    assert empty["data"] == []
    assert empty["meta"]["total_records"] == 3
    for query in ({"page": 0}, {"page_size": 101}, {"page_size": 0}):
        assert (
            await async_client.get(url(reports[0]), params=query)
        ).status_code == 422
    assert (
        await async_client.get("/api/v1/reports/invalid/comments")
    ).status_code == 422


@pytest.mark.anyio
async def test_database_enforces_parent_report_and_content(test_db, context):
    reports, users, _ = context
    async with test_db() as session:
        root = Comment(report_id=reports[0].id, author_id=users[0].id, text="Raiz")
        session.add(root)
        await session.commit()
        for changes, constraint in (
            (
                {"report_id": reports[1].id, "parent_id": root.id},
                "fk_comments_parent_report",
            ),
            ({"parent_id": uuid4()}, "fk_comments_parent_report"),
            ({"author_id": uuid4()}, "fk_comments_author"),
            ({"text": "  "}, "ck_comments_content"),
            ({"is_deleted": True}, "ck_comments_content"),
        ):
            with pytest.raises(IntegrityError) as error:
                async with session.begin_nested():
                    session.add(
                        Comment(
                            **{
                                "report_id": reports[0].id,
                                "author_id": users[0].id,
                                "text": "Texto",
                                **changes,
                            }
                        )
                    )
                    await session.flush()
            assert error.value.orig.__cause__.constraint_name == constraint


@pytest.mark.anyio
async def test_concurrent_reply_and_delete_preserve_consistent_thread(
    async_client, test_db, context
):
    import asyncio

    from src.core.exceptions import EntityNotFoundException
    from src.modules.comments.service import CommentService

    reports, users, headers = context
    root = (await post(async_client, reports[0], headers[0])).json()["data"]

    async def reply():
        async with test_db() as session:
            try:
                return await CommentService(session).create(
                    reports[0].id,
                    author_id=users[1].id,
                    parent_id=UUID(root["id"]),
                    text="Resposta concorrente",
                )
            except EntityNotFoundException:
                return None

    async def remove():
        async with test_db() as session:
            await CommentService(session).delete(
                reports[0].id,
                UUID(root["id"]),
                author_id=users[0].id,
            )

    reply_result, _ = await asyncio.gather(reply(), remove())
    data = (await async_client.get(url(reports[0]))).json()["data"]
    assert data[0]["is_deleted"] is True
    assert data[0]["text"] is data[0]["author"] is None
    if reply_result is None:
        assert len(data) == 1
    else:
        assert len(data) == 2
        assert data[1]["parent_id"] == root["id"]
        assert data[1]["text"] == "Resposta concorrente"
