from datetime import date
from decimal import Decimal
from unittest.mock import Mock

import pytest

from invoiceflow.modules.invoices.models import Invoice
from invoiceflow.modules.invoices.service import ComparisonNotFound, InvoiceNotFound, InvoiceService


def test_missing_invoice_and_comparison():
    repository = Mock()
    service = InvoiceService(repository)
    repository.get.return_value = None
    with pytest.raises(InvoiceNotFound):
        service.get_invoice("INV-2026-9999")
    with pytest.raises(InvoiceNotFound):
        service.get_comparison("INV-2026-9999")
    repository.active_snapshot.return_value = None
    repository.get.return_value = Invoice(
        id="INV-2026-1041",
        vendor="Vendor",
        due=date(2026, 11, 19),
        currency="PLN",
        status="approved",
        gross_amount=Decimal("3444.00"),
    )
    with pytest.raises(ComparisonNotFound):
        service.get_comparison("INV-2026-1041")
    detail = service.get_invoice("INV-2026-1041")
    assert detail.gross_amount == "3444.00"
    assert detail.due == date(2026, 11, 19)
    assert detail.issued is None and detail.purchase_order is None
    assert detail.totals is None and detail.items == []


def test_seed_command_rejects_production_environment(monkeypatch):
    from invoiceflow.modules.invoices.seed import main

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://test:test@localhost/invoiceflow_test")
    monkeypatch.setenv("INVOICEFLOW_ENV", "production")
    with pytest.raises(SystemExit, match="local"):
        main()
