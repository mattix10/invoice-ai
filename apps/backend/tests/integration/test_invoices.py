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
            "dueFrom": "2026-11-21",
            "dueTo": "2026-11-21",
            "sort": "due",
            "pageSize": 1,
        },
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == "INV-2026-1042"
    page = invoice_client.get("/api/v1/invoices", params={"page": 5, "pageSize": 1}).json()
    assert page["items"] == []
    assert page["total"] == 4
    for literal in ("%", "_"):
        assert invoice_client.get("/api/v1/invoices", params={"q": literal}).json()["total"] == 0


def test_real_repository_detail_comparison_and_missing(invoice_client):
    detail = invoice_client.get("/api/v1/invoices/INV-2026-1042").json()
    assert detail["totals"] == {"net": "10500.00", "vat": "2415.00", "gross": "12915.00"}
    assert len(detail["items"]) == 3
    summary = invoice_client.get("/api/v1/invoices/INV-2026-1041").json()
    assert summary["issued"] is None and summary["purchaseOrder"] is None
    assert summary["items"] == [] and summary["totals"] is None
    comparison = invoice_client.get("/api/v1/invoices/INV-2026-1042/comparison").json()
    assert comparison["difference"]["gross"] == "615.00"
    assert comparison["differencePercent"] == "5.0"
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


def test_reconciliation_records_evidence_and_is_idempotent(invoice_client, session):
    url = "/api/v1/invoices/INV-2026-1042/reconciliation"
    first = invoice_client.post(url, json={})
    assert first.status_code == 200
    result = first.json()
    assert result["state"] == "completed" and result["revision"] == 1
    assert result["difference"] == {"net": "500.00", "vat": "115.00", "gross": "615.00"}
    assert result["differencePercent"] == "5.0"
    assert [line["differenceNet"] for line in result["lines"]] == ["500.00", "0.00", "0.00"]
    assert invoice_client.post(url, json={}).json() == result
    assert session.execute(text("SELECT count(*) FROM invoice_reconciliations")).scalar_one() == 1
    session.execute(
        text(
            "UPDATE invoice_po_items SET quantity = 9 "
            "WHERE invoice_id = 'INV-2026-1042' AND position = 1"
        )
    )
    session.commit()
    session.expire_all()
    changed = invoice_client.post(url, json={}).json()
    assert changed["revision"] == 2
    assert changed["lines"][0]["poQuantity"] == 9
    assert (
        invoice_client.post("/api/v1/invoices/INV-2026-1041/reconciliation", json={}).status_code
        == 409
    )
    assert (
        invoice_client.post("/api/v1/invoices/INV-2026-9999/reconciliation", json={}).status_code
        == 404
    )
    assert invoice_client.post(url, json={"state": "approved"}).status_code == 422
    assert (
        session.execute(text("SELECT status FROM invoices WHERE id = 'INV-2026-1042'")).scalar_one()
        == "needs_review"
    )


def test_concurrent_reconciliation_returns_one_revision(isolated_connection, database_settings):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from invoiceflow.modules.invoices.reconciliation import ReconciliationService
    from invoiceflow.modules.invoices.repository import InvoiceRepository

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    with Session(isolated_connection) as session:
        seed(session)
        session.commit()
    schema = isolated_connection.execute(text("SELECT current_schema()")).scalar_one()
    engine = create_engine(
        database_settings.database_url.get_secret_value(),
        connect_args={"options": f"-csearch_path={schema}"},
    )
    barrier = Barrier(2)

    def run():
        with Session(engine) as session:
            barrier.wait(timeout=10)
            return ReconciliationService(InvoiceRepository(session)).reconcile("INV-2026-1042")

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: run(), range(2)))
        assert results[0] == results[1]
        assert results[0].revision == 1
        assert (
            isolated_connection.execute(
                text("SELECT count(*) FROM invoice_reconciliations")
            ).scalar_one()
            == 1
        )
    finally:
        engine.dispose()


def test_reconciliation_database_failure_rolls_back(invoice_client, session):
    from sqlalchemy import event

    from invoiceflow.modules.invoices.reconciliation import ReconciliationService
    from invoiceflow.modules.invoices.repository import InvoiceRepository

    def fail_commit(session):
        raise RuntimeError("simulated commit failure")

    event.listen(session, "before_commit", fail_commit)
    try:
        with pytest.raises(RuntimeError, match="simulated"):
            ReconciliationService(InvoiceRepository(session)).reconcile("INV-2026-1042")
    finally:
        event.remove(session, "before_commit", fail_commit)
    assert session.execute(text("SELECT count(*) FROM invoice_reconciliations")).scalar_one() == 0


def test_reconciliation_openapi_contract(invoice_client):
    schema = invoice_client.get("/openapi.json").json()
    operation = schema["paths"]["/api/v1/invoices/{invoice_id}/reconciliation"]["post"]
    assert operation["operationId"] == "reconcileInvoice"
    assert {"200", "404", "409", "422", "503"} <= operation["responses"].keys()
    assert operation["requestBody"]["required"] is True
    assert "ReconciliationInputs" in schema["components"]["schemas"]


def test_explicit_link_pins_po_version_and_reconciliation_history(
    invoice_client, session, monkeypatch
):
    monkeypatch.setenv("INVOICEFLOW_ENV", "local")
    reconciliation_url = "/api/v1/invoices/INV-2026-1042/reconciliation"
    history_url = "/api/v1/invoices/INV-2026-1042/reconciliations"
    legacy = invoice_client.post(reconciliation_url, json={}).json()
    assert legacy["algorithm"] == "deterministic-v1"
    assert invoice_client.get(f"{history_url}/latest").json()["isCurrent"] is True
    po_fields = {
        "externalReference": "PO-FICTIONAL",
        "supplier": "Fictional supplier",
        "currency": "PLN",
        "vatRate": "0.23",
        "items": [
            {"position": 30, "description": "First", "quantity": 10, "unitNet": "820.00"},
            {"position": 10, "description": "Second", "quantity": 10, "unitNet": "110.00"},
            {"position": 20, "description": "Third", "quantity": 5, "unitNet": "240.00"},
        ],
    }
    created = invoice_client.post("/api/v1/purchase-orders", json=po_fields)
    assert created.status_code == 200 or created.status_code == 201
    po = created.json()
    link_body = {
        "poId": po["id"],
        "poVersion": po["version"],
        "expectedLinkRevision": 0,
        "mappings": [
            {"invoiceLinePosition": 1, "poLinePosition": 30},
            {"invoiceLinePosition": 2, "poLinePosition": 10},
            {"invoiceLinePosition": 3, "poLinePosition": 20},
        ],
    }
    link_url = "/api/v1/invoices/INV-2026-1042/purchase-order-link"
    first = invoice_client.put(link_url, json=link_body)
    assert first.status_code == 200
    link = first.json()
    assert link["revision"] == 1
    assert invoice_client.put(link_url, json=link_body).json() == link

    assert invoice_client.get(f"{history_url}/1").json()["isCurrent"] is False
    result = invoice_client.post(reconciliation_url, json={})
    assert result.status_code == 200
    assert result.json()["algorithm"] == "deterministic-v2"
    assert result.json()["difference"] == {"net": "0.00", "vat": "0.00", "gross": "0.00"}
    assert invoice_client.post(reconciliation_url, json={}).json() == result.json()
    assert invoice_client.get(f"{history_url}/latest").json()["isCurrent"] is True

    po_fields["items"][0]["unitNet"] = "720.00"
    updated = invoice_client.put(
        f"/api/v1/purchase-orders/{po['id']}",
        json={**po_fields, "expectedVersion": po["version"]},
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == po["version"] + 1
    assert invoice_client.get(link_url).json()["sourceChanged"] is True
    assert invoice_client.post(reconciliation_url, json={}).json() == result.json()

    refreshed = invoice_client.put(
        link_url,
        json={**link_body, "poVersion": updated.json()["version"], "expectedLinkRevision": 1},
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["snapshotId"] != link["snapshotId"]
    assert invoice_client.get(f"{history_url}/2").json()["isCurrent"] is False
    changed = invoice_client.post(reconciliation_url, json={})
    assert changed.status_code == 200
    assert changed.json()["revision"] == result.json()["revision"] + 1
    assert changed.json()["difference"] == {"net": "1000.00", "vat": "230.00", "gross": "1230.00"}
    assert invoice_client.get(f"{history_url}/1").json()["result"] == legacy
    assert invoice_client.get(f"{history_url}/latest").json()["isCurrent"] is True
    assert session.execute(text("SELECT count(*) FROM invoice_reconciliations")).scalar_one() == 3
    with pytest.raises(IntegrityError):
        session.execute(text("UPDATE invoice_purchase_order_links SET po_version = po_version + 1"))
    session.rollback()
    with pytest.raises(IntegrityError):
        session.execute(
            text(
                "UPDATE invoice_reconciliations SET source_snapshot_id = :snapshot "
                "WHERE invoice_id = 'INV-2026-1042' AND revision = 1"
            ),
            {"snapshot": "missing-snapshot"},
        )
    session.rollback()


def test_linked_comparison_exposes_invoice_and_po_quantities(invoice_client, monkeypatch):
    monkeypatch.setenv("INVOICEFLOW_ENV", "local")
    created = invoice_client.post(
        "/api/v1/purchase-orders",
        json={
            "externalReference": "PO-QUANTITY-DIFFERENCE",
            "supplier": "Fictional supplier",
            "currency": "PLN",
            "vatRate": "0.23",
            "items": [
                {"position": 10, "description": "Monitor", "quantity": 5, "unitNet": "820.00"},
                {"position": 20, "description": "Keyboard", "quantity": 10, "unitNet": "110.00"},
                {"position": 30, "description": "Dock", "quantity": 5, "unitNet": "240.00"},
            ],
        },
    ).json()
    linked = invoice_client.put(
        "/api/v1/invoices/INV-2026-1042/purchase-order-link",
        json={
            "poId": created["id"],
            "poVersion": created["version"],
            "expectedLinkRevision": 0,
            "mappings": [
                {"invoiceLinePosition": 1, "poLinePosition": 10},
                {"invoiceLinePosition": 2, "poLinePosition": 20},
                {"invoiceLinePosition": 3, "poLinePosition": 30},
            ],
        },
    )
    assert linked.status_code == 200

    comparison = invoice_client.get("/api/v1/invoices/INV-2026-1042/comparison")

    assert comparison.status_code == 200
    assert comparison.json()["items"][0] == {
        "position": 1,
        "name": "27-inch monitor",
        "quantity": 10,
        "poQuantity": 5,
        "invoiceUnitNet": "820.00",
        "poUnitNet": "820.00",
        "invoiceNet": "8200.00",
        "poNet": "4100.00",
    }
    assert comparison.json()["difference"]["net"] == "4100.00"


def test_link_rejects_missing_mapping_without_partial_write(invoice_client, session, monkeypatch):
    monkeypatch.setenv("INVOICEFLOW_ENV", "local")
    created = invoice_client.post(
        "/api/v1/purchase-orders",
        json={
            "externalReference": "PO-INCOMPLETE",
            "supplier": "Fictional supplier",
            "currency": "PLN",
            "vatRate": "0.23",
            "items": [{"position": 1, "description": "Item", "quantity": 1, "unitNet": "1.00"}],
        },
    )
    assert created.status_code in (200, 201)
    po = created.json()
    response = invoice_client.put(
        "/api/v1/invoices/INV-2026-1042/purchase-order-link",
        json={
            "poId": po["id"],
            "poVersion": po["version"],
            "expectedLinkRevision": 0,
            "mappings": [{"invoiceLinePosition": 1, "poLinePosition": 1}],
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "po_link_conflict"
    assert (
        invoice_client.get("/api/v1/invoices/INV-2026-1042/comparison").json()["difference"][
            "gross"
        ]
        == "615.00"
    )


def test_concurrent_link_and_reconciliation_record_complete_snapshot(
    isolated_connection, database_settings
):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from invoiceflow.modules.invoices.reconciliation import ReconciliationService
    from invoiceflow.modules.invoices.repository import InvoiceRepository
    from invoiceflow.modules.purchase_orders.schemas import LinkRequest, POFields
    from invoiceflow.modules.purchase_orders.service import PurchaseOrderService

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    with Session(isolated_connection) as session:
        seed(session)
        session.commit()
        po = PurchaseOrderService(session).save(
            POFields.model_validate(
                {
                    "externalReference": "PO-CONCURRENT",
                    "supplier": "Fictional supplier",
                    "currency": "PLN",
                    "vatRate": "0.23",
                    "items": [
                        {"position": 1, "description": "A", "quantity": 10, "unitNet": "820.00"},
                        {"position": 2, "description": "B", "quantity": 10, "unitNet": "110.00"},
                        {"position": 3, "description": "C", "quantity": 5, "unitNet": "240.00"},
                    ],
                }
            )
        )
    schema = isolated_connection.execute(text("SELECT current_schema()")).scalar_one()
    engine = create_engine(
        database_settings.database_url.get_secret_value(),
        connect_args={"options": f"-csearch_path={schema}"},
    )
    barrier = Barrier(2)
    request = LinkRequest.model_validate(
        {
            "poId": po.id,
            "poVersion": po.version,
            "expectedLinkRevision": 0,
            "mappings": [
                {"invoiceLinePosition": position, "poLinePosition": position}
                for position in (1, 2, 3)
            ],
        }
    )

    def link():
        with Session(engine) as session:
            barrier.wait(timeout=10)
            return PurchaseOrderService(session).link("INV-2026-1042", request)

    def reconcile():
        with Session(engine) as session:
            barrier.wait(timeout=10)
            return ReconciliationService(InvoiceRepository(session)).reconcile("INV-2026-1042")

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            link_future = executor.submit(link)
            result_future = executor.submit(reconcile)
            linked = link_future.result(timeout=20)
            result = result_future.result(timeout=20)
        assert linked.revision == 1
        assert result.algorithm in ("deterministic-v1", "deterministic-v2")
        assert result.difference.gross == (
            "615.00" if result.algorithm == "deterministic-v1" else "0.00"
        )
        with Session(engine) as session:
            latest = ReconciliationService(InvoiceRepository(session)).reconcile("INV-2026-1042")
            assert latest.algorithm == "deterministic-v2"
            assert latest.difference.gross == "0.00"
            assert (
                session.execute(
                    text("SELECT count(*) FROM invoice_po_snapshot_versions")
                ).scalar_one()
                == 1
            )
            assert session.execute(
                text("SELECT count(*) FROM invoice_reconciliations")
            ).scalar_one() == (2 if result.algorithm == "deterministic-v1" else 1)
    finally:
        engine.dispose()


def test_link_commit_failure_rolls_back_snapshot_and_mapping(invoice_client, session, monkeypatch):
    from sqlalchemy import event

    from invoiceflow.modules.purchase_orders.schemas import LinkRequest
    from invoiceflow.modules.purchase_orders.service import PurchaseOrderService

    monkeypatch.setenv("INVOICEFLOW_ENV", "local")
    created = invoice_client.post(
        "/api/v1/purchase-orders",
        json={
            "externalReference": "PO-ROLLBACK",
            "supplier": "Fictional supplier",
            "currency": "PLN",
            "vatRate": "0.23",
            "items": [
                {"position": 1, "description": "A", "quantity": 10, "unitNet": "820.00"},
                {"position": 2, "description": "B", "quantity": 10, "unitNet": "110.00"},
                {"position": 3, "description": "C", "quantity": 5, "unitNet": "240.00"},
            ],
        },
    )
    assert created.status_code == 201
    po = created.json()
    request = LinkRequest.model_validate(
        {
            "poId": po["id"],
            "poVersion": po["version"],
            "expectedLinkRevision": 0,
            "mappings": [
                {"invoiceLinePosition": position, "poLinePosition": position}
                for position in (1, 2, 3)
            ],
        }
    )

    def fail_commit(session):
        raise RuntimeError("simulated commit failure")

    event.listen(session, "before_commit", fail_commit)
    try:
        with pytest.raises(RuntimeError, match="simulated"):
            PurchaseOrderService(session).link("INV-2026-1042", request)
    finally:
        event.remove(session, "before_commit", fail_commit)
    for table in (
        "invoice_purchase_order_links",
        "invoice_po_snapshot_versions",
        "invoice_purchase_order_item_mappings",
    ):
        assert session.execute(text(f"SELECT count(*) FROM {table}")).scalar_one() == 0
    comparison = invoice_client.get("/api/v1/invoices/INV-2026-1042/comparison")
    assert comparison.json()["difference"]["gross"] == "615.00"
