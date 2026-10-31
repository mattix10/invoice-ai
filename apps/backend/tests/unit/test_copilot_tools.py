from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from invoiceflow.modules.copilot.tools import (
    InvoiceDetailsArgs,
    ReadOnlyTools,
    ReconciliationEvidenceArgs,
    SearchInvoicesArgs,
)
from invoiceflow.modules.invoices.schemas import InvoiceQuery, InvoiceStatus


def test_search_passes_bounded_filters_to_invoice_service():
    invoices = Mock()
    tools = ReadOnlyTools(invoices, Mock())

    result = tools.search_invoices(page=2, page_size=10, q="  paper  ", status="needs_review")

    invoices.list.assert_called_once_with(
        InvoiceQuery(page=2, page_size=10, q="paper", status=InvoiceStatus.needs_review)
    )
    assert result is invoices.list.return_value


@pytest.mark.parametrize(
    "arguments",
    [
        {"page": 0},
        {"page": True},
        {"page": 10**100},
        {"page_size": 0},
        {"page_size": 21},
        {"q": "  "},
        {"q": "x" * 101},
        {"status": "paid"},
        {"due_from": "2026-01-01"},
    ],
)
def test_search_rejects_invalid_or_unsupported_arguments(arguments):
    with pytest.raises(ValidationError):
        SearchInvoicesArgs.model_validate(arguments)


@pytest.mark.parametrize("model", [InvoiceDetailsArgs, ReconciliationEvidenceArgs])
def test_invoice_tools_reject_invalid_ids_and_extra_arguments(model):
    with pytest.raises(ValidationError):
        model.model_validate({"invoice_id": "../../secret"})
    with pytest.raises(ValidationError):
        model.model_validate({"invoice_id": "INV-2026-0001", "unexpected": True})


@pytest.mark.parametrize("revision", [0, -1, True, "1", 10**100])
def test_reconciliation_rejects_invalid_revisions(revision):
    with pytest.raises(ValidationError):
        ReconciliationEvidenceArgs(invoice_id="INV-2026-0001", revision=revision)


def test_tools_forward_valid_ids_and_revision_to_read_services():
    invoices, reconciliations = Mock(), Mock()
    tools = ReadOnlyTools(invoices, reconciliations)

    detail = tools.get_invoice_details("INV-2026-0001")
    evidence = tools.get_reconciliation_evidence("INV-2026-0001", 2)
    latest = tools.get_reconciliation_evidence("INV-2026-0001")

    invoices.get_invoice.assert_called_once_with("INV-2026-0001")
    assert reconciliations.read.call_args_list[0].args == ("INV-2026-0001", 2)
    assert reconciliations.read.call_args_list[1].args == ("INV-2026-0001", None)
    assert detail is invoices.get_invoice.return_value
    assert evidence is latest is reconciliations.read.return_value


def test_invalid_tool_input_never_reaches_services():
    invoices, reconciliations = Mock(), Mock()
    tools = ReadOnlyTools(invoices, reconciliations)

    with pytest.raises(ValidationError):
        tools.search_invoices(page_size=21)
    with pytest.raises(ValidationError):
        tools.get_invoice_details("bad-id")
    with pytest.raises(ValidationError):
        tools.get_reconciliation_evidence("INV-2026-0001", 0)

    invoices.assert_not_called()
    assert not invoices.method_calls
    assert not reconciliations.method_calls
