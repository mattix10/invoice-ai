import asyncio
import sys
from pathlib import Path
from urllib.parse import quote

import pytest
from alembic import command
from alembic.config import Config
from mcp import Client
from mcp.client.stdio import StdioServerParameters
from sqlalchemy import text

from invoiceflow.modules.invoices.reconciliation import ReconciliationService
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.seed import seed

pytestmark = pytest.mark.integration


def test_mcp_reads_real_services_without_writes(isolated_connection, session, database_settings):
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    seed(session)
    session.commit()
    expected = ReconciliationService(InvoiceRepository(session)).reconcile("INV-2026-1042")
    schema = isolated_connection.execute(text("SELECT current_schema()")).scalar_one()
    isolated_connection.commit()
    url = database_settings.database_url.get_secret_value().replace("localhost", "127.0.0.1")
    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "invoiceflow.mcp_server"],
        env={"DATABASE_URL": f"{url}?options={quote('-csearch_path=' + schema)}"},
    )
    before = session.execute(
        text("SELECT revision, payload FROM invoice_reconciliations ORDER BY revision")
    ).all()
    amounts = session.execute(
        text("SELECT net_amount, vat_amount, gross_amount FROM invoices WHERE id = 'INV-2026-1042'")
    ).one()
    session.commit()

    async def exercise():
        async with Client(params, read_timeout_seconds=15) as client:
            assert len((await client.list_tools()).tools) == 3
            search = await client.call_tool("search_invoices", {"q": "north", "page_size": 1})
            assert search.structured_content["data"]["total"] == 1
            assert search.structured_content["data"]["items"][0]["id"] == "INV-2026-1042"
            invoice = await client.call_tool("get_invoice", {"invoice_id": "INV-2026-1042"})
            evidence = await client.call_tool(
                "get_reconciliation_evidence", {"invoice_id": "INV-2026-1042"}
            )
            assert invoice.structured_content is not None, invoice
            assert invoice.structured_content["data"]["grossAmount"] == "12915.00"
            assert (
                evidence.structured_content["data"]["result"]["difference"]["gross"]
                == (expected.difference.gross)
                == "615.00"
            )
            missing = await client.call_tool("get_invoice", {"invoice_id": "INV-2026-9999"})
            assert missing.structured_content["error"]["code"] == "invoice_not_found"
            missing_revision = await client.call_tool(
                "get_reconciliation_evidence", {"invoice_id": "INV-2026-1042", "revision": 99}
            )
            assert (
                missing_revision.structured_content["error"]["code"] == "reconciliation_not_found"
            )

            session.execute(text("UPDATE invoice_po_items SET unit_net = 771 WHERE position = 1"))
            session.commit()
            stale = await client.call_tool(
                "get_reconciliation_evidence", {"invoice_id": "INV-2026-1042", "revision": 1}
            )
            assert stale.structured_content["data"]["isCurrent"] is False
            required = await client.call_tool(
                "get_reconciliation_evidence",
                {"invoice_id": "INV-2026-1042", "require_current": True},
            )
            assert required.structured_content["error"]["code"] == "reconciliation_stale"

    asyncio.run(exercise())
    assert (
        session.execute(
            text("SELECT revision, payload FROM invoice_reconciliations ORDER BY revision")
        ).all()
        == before
    )
    assert (
        session.execute(
            text(
                "SELECT net_amount, vat_amount, gross_amount FROM invoices "
                "WHERE id = 'INV-2026-1042'"
            )
        ).one()
        == amounts
    )
