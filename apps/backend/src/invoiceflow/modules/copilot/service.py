import re

from invoiceflow.modules.copilot.provider import PROMPT_VERSION, DemoInvestigationProvider
from invoiceflow.modules.copilot.schemas import CopilotAnswer
from invoiceflow.modules.invoices.reconciliation import ReconciliationNotFound, fingerprint
from invoiceflow.modules.invoices.schemas import EvidenceReference, ReconciliationResult
from invoiceflow.modules.invoices.service import InvoiceNotFound
from invoiceflow.modules.purchase_orders.repository import PurchaseOrderRepository


class CopilotUnavailable(Exception):
    def __init__(self, code):
        self.code = code


class CopilotService:
    def __init__(self, tools, repository, mode):
        self.tools = tools
        self.repository = repository
        self.mode = mode
        self.provider = DemoInvestigationProvider()

    def require_demo(self):
        if self.mode != "demo":
            raise CopilotUnavailable("ai_disabled" if self.mode == "disabled" else "ai_unavailable")

    def investigate(self, invoice_id, revision=None):
        self.require_demo()
        try:
            read = self.tools.get_reconciliation_evidence(invoice_id, revision)
        except ReconciliationNotFound as exc:
            raise CopilotUnavailable("reconciliation_required") from exc
        # Refresh the identity map after acquiring the same lock used by input writers.
        self.repository.session.expire_all()
        invoice = self.repository.lock_invoice(invoice_id)
        if invoice is None:
            raise InvoiceNotFound
        try:
            po = self.repository.active_snapshot(invoice)
            calculated, algorithm, input_hash, _ = fingerprint(invoice, po)
        except ValueError as exc:
            raise CopilotUnavailable("reconciliation_unavailable") from exc
        if (read.algorithm_version, read.input_hash) != (algorithm, input_hash):
            raise CopilotUnavailable("reconciliation_stale")
        po_repository = PurchaseOrderRepository(self.repository.session)
        link = po_repository.link(invoice_id)
        if link:
            source = po_repository.get(link.po_id, lock=True)
            if source is None or source.version != link.po_version:
                raise CopilotUnavailable("reconciliation_stale")
        expected = ReconciliationResult(
            invoice_id=invoice_id,
            revision=read.revision,
            state="completed",
            algorithm=algorithm,
            input_hash=input_hash,
            **calculated,
        )
        if read.result != expected:
            raise CopilotUnavailable("reconciliation_unavailable")
        return self.provider.investigate(read)

    def query(self, question, invoice_id=None):
        self.require_demo()
        # Only explicitly supported intent is interpreted in deterministic demo mode.
        normalized = question.casefold()
        mentioned = re.findall(r"\bINV-\d{4}-\d{4,}\b", question.upper())
        if invoice_id is None and len(set(mentioned)) == 1 and len(mentioned[0]) <= 64:
            invoice_id = mentioned[0]
        if invoice_id and mentioned and any(value != invoice_id for value in mentioned):
            invoice_id = None
        investigation_terms = (
            "discrepancy",
            "difference",
            "wrong",
            "investigat",
            "rozbież",
            "różnic",
        )
        if invoice_id and any(term in normalized for term in investigation_terms):
            return self.investigate(invoice_id)
        if invoice_id:
            self.tools.get_invoice_details(invoice_id)
        if not invoice_id and ("needs review" in normalized or "needing review" in normalized):
            page = self.tools.search_invoices(status="needs_review")
            refs = [
                EvidenceReference(
                    kind="invoice",
                    invoice_id=item.id,
                    reconciliation_revision=None,
                    line_position=None,
                    evidence_id=f"invoice:{item.id}",
                    label="Invoice",
                )
                for item in page.items
            ]
            ids = ", ".join(item.id for item in page.items)
            return CopilotAnswer(
                answer=f"Demo: Invoices needing review: {ids}."
                if ids
                else "Demo: No invoices needing review were found.",
                citations=refs,
                findings=[],
                suggested_questions=[],
                generation_mode="demo",
                provider="demo",
                model=None,
                prompt_version=PROMPT_VERSION,
                incomplete_context=page.total > len(page.items),
                human_review_required=True,
                unavailable_reason=None,
            )
        return CopilotAnswer(
            answer="Demo: This question cannot be answered with the available demo capabilities.",
            citations=[],
            findings=[],
            suggested_questions=[],
            generation_mode="demo",
            provider="demo",
            model=None,
            prompt_version=PROMPT_VERSION,
            incomplete_context=True,
            human_review_required=True,
            unavailable_reason="Question interpretation is unavailable in demo mode",
        )
