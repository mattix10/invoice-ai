from decimal import Decimal
from unittest.mock import Mock

import pytest

from invoiceflow.modules.invoices.models import (
    Invoice,
    InvoiceItem,
    InvoicePoItem,
    InvoicePoSnapshot,
)
from invoiceflow.modules.invoices.reconciliation import (
    ReconciliationConflict,
    ReconciliationService,
    reconcile_inputs,
)


def invoice(price="0.05", po_price="0.00"):
    return Invoice(
        id="INV-2026-1042",
        currency="PLN",
        vat_rate=Decimal("0.10"),
        net_amount=Decimal(price),
        vat_amount=(Decimal(price) * Decimal("0.10")).quantize(
            Decimal("0.01"), rounding="ROUND_HALF_UP"
        ),
        gross_amount=Decimal(price)
        + (Decimal(price) * Decimal("0.10")).quantize(Decimal("0.01"), rounding="ROUND_HALF_UP"),
        items=[InvoiceItem(position=1, name="item", quantity=1, unit_net=Decimal(price))],
        po_snapshot=InvoicePoSnapshot(
            purchase_order="PO-1",
            currency="PLN",
            vat_rate=Decimal("0.10"),
            items=[InvoicePoItem(position=1, quantity=1, unit_net=Decimal(po_price))],
        ),
    )


def test_rounding_and_zero_baseline():
    result = reconcile_inputs(invoice())
    assert result["difference"] == {"net": "0.05", "vat": "0.01", "gross": "0.06"}
    assert result["difference_percent"] is None


def test_equal_values_have_no_difference():
    result = reconcile_inputs(invoice("1.00", "1.00"))
    assert result["difference"]["gross"] == "0.00"
    assert result["difference_percent"] == "0.0"


def test_incomplete_and_invalid_input_rolls_back():
    repository = Mock()
    item = invoice()
    item.po_snapshot = None
    repository.lock_invoice.return_value = item
    with pytest.raises(ReconciliationConflict):
        ReconciliationService(repository).reconcile(item.id)
    repository.rollback.assert_called_once()
    item = invoice()
    item.items[0].quantity = 0
    with pytest.raises(ValueError):
        reconcile_inputs(item)


def test_persistence_failure_rolls_back():
    repository = Mock()
    repository.lock_invoice.return_value = invoice()
    repository.active_snapshot.return_value = repository.lock_invoice.return_value.po_snapshot
    repository.reconciliation.return_value = None
    repository.next_revision.return_value = 1
    repository.commit.side_effect = RuntimeError("failure")
    with pytest.raises(RuntimeError):
        ReconciliationService(repository).reconcile("INV-2026-1042")
    repository.rollback.assert_called_once()


def test_only_processing_can_transition_to_completed():
    from invoiceflow.modules.invoices.models import Reconciliation
    from invoiceflow.modules.invoices.reconciliation import complete_processing

    result = Reconciliation(state="processing")
    complete_processing(result)
    assert result.state == "completed"
    with pytest.raises(ValueError):
        complete_processing(result)
