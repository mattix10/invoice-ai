from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from invoiceflow.core.database import get_session
from invoiceflow.main import create_app
from invoiceflow.modules.invoices.seed import seed

pytestmark = pytest.mark.integration


@pytest.fixture
def invoice_client(isolated_connection, session, database_settings):
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    seed(session)
    session.commit()
    app = create_app(database_settings)
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_real_repository_list_filters_and_pagination(invoice_client):
    response = invoice_client.get(
        "/api/v1/invoices",
        params={
            "status": "needs_review",
            "q": "north",
            "due_from": "2026-11-21",
            "due_to": "2026-11-21",
            "sort": "due",
            "page_size": 1,
        },
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == "INV-2026-1042"
    page = invoice_client.get("/api/v1/invoices", params={"page": 5, "page_size": 1}).json()
    assert page["items"] == []
    assert page["total"] == 4
    for literal in ("%", "_"):
        assert invoice_client.get("/api/v1/invoices", params={"q": literal}).json()["total"] == 0


def test_real_repository_detail_comparison_and_missing(invoice_client):
    detail = invoice_client.get("/api/v1/invoices/INV-2026-1042").json()
    assert detail["totals"] == {"net": "10500.00", "vat": "2415.00", "gross": "12915.00"}
    assert len(detail["items"]) == 3
    summary = invoice_client.get("/api/v1/invoices/INV-2026-1041").json()
    assert summary["issued"] is None and summary["purchase_order"] is None
    assert summary["items"] == [] and summary["totals"] is None
    comparison = invoice_client.get("/api/v1/invoices/INV-2026-1042/comparison").json()
    assert comparison["difference"]["gross"] == "615.00"
    assert comparison["difference_percent"] == "5.0"
    for suffix, code in [
        ("INV-2026-9999", "invoice_not_found"),
        ("INV-2026-9999/comparison", "invoice_not_found"),
        ("INV-2026-1041/comparison", "comparison_not_found"),
    ]:
        response = invoice_client.get("/api/v1/invoices/" + suffix)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == code


def test_seed_preserves_existing_edits_and_does_not_duplicate(invoice_client, session):
    session.execute(text("UPDATE invoices SET vendor = 'Edited' WHERE id = 'INV-2026-1042'"))
    session.commit()
    assert seed(session) == 0
    session.commit()
    assert session.execute(text("SELECT count(*) FROM invoices")).scalar_one() == 4
    assert (
        session.execute(text("SELECT vendor FROM invoices WHERE id = 'INV-2026-1042'")).scalar_one()
        == "Edited"
    )


@pytest.mark.parametrize(
    "statement",
    [
        "INSERT INTO invoice_items (invoice_id, position, name, quantity, unit_net) "
        "VALUES ('INV-2026-9999', 1, 'x', 1, 1)",
        "INSERT INTO invoice_items (invoice_id, position, name, quantity, unit_net) "
        "VALUES ('INV-2026-1042', 1, 'x', 1, 1)",
        "UPDATE invoice_po_snapshots SET currency = 'USD' WHERE invoice_id = 'INV-2026-1042'",
        "INSERT INTO invoice_po_items (invoice_id, position, quantity, unit_net) "
        "VALUES ('INV-2026-1042', 99, 1, 1)",
        "UPDATE invoice_items SET unit_net = -1 WHERE invoice_id = 'INV-2026-1042' "
        "AND position = 1",
        "UPDATE invoices SET status = 'invalid' WHERE id = 'INV-2026-1042'",
        "UPDATE invoice_items SET quantity = 0 WHERE invoice_id = 'INV-2026-1042' AND position = 1",
    ],
)
def test_database_rejects_invalid_relations_and_values(invoice_client, session, statement):
    with pytest.raises(IntegrityError):
        session.execute(text(statement))
    session.rollback()


def test_equal_sort_values_use_ascending_id(invoice_client, session):
    session.execute(text("UPDATE invoices SET due = '2026-11-21'"))
    session.commit()
    response = invoice_client.get("/api/v1/invoices", params={"sort": "-due"})
    assert [item["id"] for item in response.json()["items"]] == [
        "INV-2026-1039",
        "INV-2026-1040",
        "INV-2026-1041",
        "INV-2026-1042",
    ]


def test_inconsistent_invoice_and_po_are_not_presented_as_valid(invoice_client, session):
    session.execute(
        text(
            "UPDATE invoice_items SET unit_net = 821 WHERE invoice_id = 'INV-2026-1042' "
            "AND position = 1"
        )
    )
    session.commit()
    with pytest.raises(ValueError, match="totals"):
        invoice_client.get("/api/v1/invoices/INV-2026-1042")
    session.execute(
        text(
            "UPDATE invoice_items SET unit_net = 820 WHERE invoice_id = 'INV-2026-1042' "
            "AND position = 1"
        )
    )
    session.execute(
        text(
            "UPDATE invoice_po_items SET quantity = 9 WHERE invoice_id = 'INV-2026-1042' "
            "AND position = 1"
        )
    )
    session.commit()
    session.expire_all()
    with pytest.raises(ValueError, match="items do not match"):
        invoice_client.get("/api/v1/invoices/INV-2026-1042/comparison")
