import json

import pytest
from sqlalchemy import text
from test_copilot_cloudflare import INVOICE_ID, prepared_session  # noqa: F401

from invoiceflow.modules.copilot.service import CopilotService, CopilotUnavailable
from invoiceflow.modules.copilot.tools import ReadOnlyTools
from invoiceflow.modules.invoices.reconciliation import ReconciliationService
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.service import InvoiceService


def test_supplier_draft_uses_verified_reconciliation(prepared_session):  # noqa: F811
    repository = InvoiceRepository(prepared_session)
    reconciliation = ReconciliationService(repository)
    reconciliation.reconcile(INVOICE_ID)
    service = CopilotService(
        ReadOnlyTools(InvoiceService(repository), reconciliation), repository, "demo"
    )

    draft = service.draft_supplier_inquiry(INVOICE_ID, 1, "neutral")

    assert "615.00 gross PLN" in draft.body
    assert "820.00" in draft.body and "770.00" in draft.body
    assert draft.draft_only and draft.requires_human_review
    assert all(ref.invoice_id == INVOICE_ID for ref in draft.evidence_refs)


def test_supplier_draft_requires_reconciliation(prepared_session):  # noqa: F811
    repository = InvoiceRepository(prepared_session)
    service = CopilotService(
        ReadOnlyTools(InvoiceService(repository), ReconciliationService(repository)),
        repository,
        "demo",
    )

    with pytest.raises(CopilotUnavailable, match="reconciliation_required"):
        service.draft_supplier_inquiry(INVOICE_ID, 1, "neutral")


def test_supplier_draft_is_unavailable_when_there_is_no_discrepancy(prepared_session):  # noqa: F811
    prepared_session.execute(
        text(
            "UPDATE invoice_items SET unit_net = 770 "
            "WHERE invoice_id = 'INV-2026-1042' AND position = 1"
        )
    )
    prepared_session.execute(
        text(
            "UPDATE invoices SET net_amount = 10000, vat_amount = 2300, gross_amount = 12300 "
            "WHERE id = 'INV-2026-1042'"
        )
    )
    prepared_session.commit()
    repository = InvoiceRepository(prepared_session)
    reconciliation = ReconciliationService(repository)
    reconciliation.reconcile(INVOICE_ID)
    service = CopilotService(
        ReadOnlyTools(InvoiceService(repository), reconciliation), repository, "demo"
    )

    with pytest.raises(CopilotUnavailable, match="reconciliation_unavailable"):
        service.draft_supplier_inquiry(INVOICE_ID, 1, "neutral")


def test_supplier_draft_rejects_stale_inputs_without_writes(prepared_session):  # noqa: F811
    repository = InvoiceRepository(prepared_session)
    reconciliation = ReconciliationService(repository)
    reconciliation.reconcile(INVOICE_ID)
    prepared_session.execute(
        text(
            "UPDATE invoice_items SET unit_net = 821 "
            "WHERE invoice_id = 'INV-2026-1042' AND position = 1"
        )
    )
    prepared_session.commit()
    service = CopilotService(
        ReadOnlyTools(InvoiceService(repository), reconciliation), repository, "demo"
    )

    with pytest.raises(CopilotUnavailable) as error:
        service.draft_supplier_inquiry(INVOICE_ID, 1, "neutral")

    assert error.value.code in {"reconciliation_stale", "reconciliation_unavailable"}
    assert (
        prepared_session.execute(text("SELECT count(*) FROM invoice_reconciliations")).scalar_one()
        == 1
    )


@pytest.mark.parametrize("altered", [False, True])
def test_live_draft_rejects_unverified_provider_text(prepared_session, altered):  # noqa: F811
    repository = InvoiceRepository(prepared_session)
    reconciliation = ReconciliationService(repository)
    reconciliation.reconcile(INVOICE_ID)

    class Provider:
        def complete(self, messages, **kwargs):
            facts = json.loads(messages[-1]["content"])
            draft = {"opening": "neutral_2", "evidence_ids": facts["evidence_ids"]}
            if altered:
                draft["body"] = " We promise a refund of 999 PLN."
            return {"response": draft}

    service = CopilotService(
        ReadOnlyTools(InvoiceService(repository), reconciliation),
        repository,
        "cloudflare",
        Provider(),
    )
    if altered:
        with pytest.raises(CopilotUnavailable, match="invalid_ai_response"):
            service.draft_supplier_inquiry(INVOICE_ID, 1, "neutral")
    else:
        draft = service.draft_supplier_inquiry(INVOICE_ID, 1, "neutral")
        assert draft.generation_mode == "live"
        assert "615.00 gross PLN" in draft.body
        assert "help us understand" in draft.body
