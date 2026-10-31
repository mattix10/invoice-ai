from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from invoiceflow.core.database import get_session
from invoiceflow.main import create_app
from invoiceflow.modules.copilot import router as copilot_router
from invoiceflow.modules.copilot.service import CopilotService, CopilotUnavailable
from invoiceflow.modules.copilot.tools import ReadOnlyTools
from invoiceflow.modules.invoices.reconciliation import ReconciliationService
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.seed import seed
from invoiceflow.modules.invoices.service import InvoiceService

pytestmark = pytest.mark.integration
INVOICE_ID = "INV-2026-1042"


@pytest.fixture
def prepared_session(isolated_connection, session):
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    seed(session)
    session.commit()
    return session


class Provider:
    model = "test-model"

    def __init__(self, change=None, revision=None):
        self.change = change
        self.revision = revision
        self.calls = 0

    def complete(self, messages, tools=None, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return {
                "tool_calls": [
                    {
                        "name": "get_reconciliation_evidence",
                        "arguments": {"invoice_id": INVOICE_ID, "revision": self.revision},
                    }
                ]
            }
        if self.change:
            self.change()
        return {"response": {"evidence_ids": [f"invoice:{INVOICE_ID}:reconciliation:1"]}}


def make_service(session, provider):
    repository = InvoiceRepository(session)
    tools = ReadOnlyTools(InvoiceService(repository), ReconciliationService(repository))
    return CopilotService(tools, repository, "cloudflare", provider)


@pytest.mark.parametrize(
    "change_type",
    [
        "invoice",
        "purchase_order",
    ],
    ids=["invoice", "purchase_order"],
)
def test_input_changed_during_inference_fails_without_new_reconciliation(
    prepared_session, database_engine, database_settings, change_type, monkeypatch
):
    session = prepared_session
    if change_type == "purchase_order":
        monkeypatch.setenv("INVOICEFLOW_ENV", "local")
        app = create_app(database_settings)
        app.dependency_overrides[get_session] = lambda: session
        with TestClient(app) as client:
            po = client.post(
                "/api/v1/purchase-orders",
                json={
                    "externalReference": "PO-TEST",
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
            assert po.status_code == 201
            linked = client.put(
                f"/api/v1/invoices/{INVOICE_ID}/purchase-order-link",
                json={
                    "poId": po.json()["id"],
                    "poVersion": po.json()["version"],
                    "expectedLinkRevision": 0,
                    "mappings": [
                        {"invoiceLinePosition": n, "poLinePosition": n} for n in (1, 2, 3)
                    ],
                },
            )
            assert linked.status_code == 200
        app.dependency_overrides.clear()
        update = "UPDATE purchase_orders SET version = version + 1 WHERE id = :po_id"
        params = {"po_id": po.json()["id"]}
    else:
        update = (
            "UPDATE invoice_items SET name = 'Changed' "
            "WHERE invoice_id = 'INV-2026-1042' AND position = 1"
        )
        params = {}
    repository = InvoiceRepository(session)
    ReconciliationService(repository).reconcile(INVOICE_ID)
    schema = session.execute(text("SELECT current_schema()")).scalar_one()
    session.rollback()

    def change():
        with database_engine.begin() as connection:
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            if change_type == "purchase_order":
                connection.execute(
                    text(
                        "UPDATE purchase_order_items SET quantity = quantity + 1 "
                        "WHERE po_id = :po_id AND position = 1"
                    ),
                    params,
                )
            connection.execute(text(update), params)

    service = make_service(session, Provider(change=change))
    with pytest.raises(CopilotUnavailable) as error:
        service.investigate(INVOICE_ID)

    assert error.value.code == "reconciliation_stale"
    assert session.execute(text("SELECT count(*) FROM invoice_reconciliations")).scalar_one() == 1


def test_explicit_historical_revision_uses_persisted_evidence_without_new_revision(
    prepared_session,
):
    session = prepared_session
    ReconciliationService(InvoiceRepository(session)).reconcile(INVOICE_ID)
    session.execute(
        text(
            "UPDATE invoice_items SET name = 'Changed' "
            "WHERE invoice_id = 'INV-2026-1042' AND position = 1"
        )
    )
    session.commit()

    answer = make_service(session, Provider(revision=1)).investigate(INVOICE_ID, 1)

    assert "historical reconciliation revision 1" in answer.answer
    assert answer.citations[0].reconciliation_revision == 1
    assert session.execute(text("SELECT count(*) FROM invoice_reconciliations")).scalar_one() == 1


def test_legacy_po_changed_during_inference_returns_stale(
    prepared_session, database_engine, database_settings, monkeypatch
):
    session = prepared_session
    ReconciliationService(InvoiceRepository(session)).reconcile(INVOICE_ID)
    schema = session.execute(text("SELECT current_schema()")).scalar_one()
    session.rollback()

    def change():
        with database_engine.begin() as connection:
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            connection.execute(
                text("SELECT id FROM invoices WHERE id = :invoice_id FOR UPDATE"),
                {"invoice_id": INVOICE_ID},
            )
            connection.execute(
                text(
                    "UPDATE invoice_po_items SET quantity = quantity + 1 "
                    "WHERE invoice_id = :invoice_id AND position = 1"
                ),
                {"invoice_id": INVOICE_ID},
            )

    provider = Provider(change=change)
    monkeypatch.setattr(copilot_router, "service", lambda request, db: make_service(db, provider))
    app = create_app(database_settings)
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        response = client.post(f"/api/v1/invoices/{INVOICE_ID}/investigations", json={})
    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "reconciliation_stale"
    assert session.execute(text("SELECT count(*) FROM invoice_reconciliations")).scalar_one() == 1
