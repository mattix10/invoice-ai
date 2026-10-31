from typing import Protocol

from invoiceflow.modules.copilot.schemas import CopilotAnswer, Finding
from invoiceflow.modules.invoices.schemas import ReconciliationRead

PROMPT_VERSION = "demo-v1"


class InvestigationProvider(Protocol):
    def investigate(self, read: ReconciliationRead) -> CopilotAnswer: ...


class DemoInvestigationProvider:
    def investigate(self, read: ReconciliationRead) -> CopilotAnswer:
        result = read.result
        difference = result.difference
        all_relevant = [line for line in result.lines if line.difference_net != "0.00"]
        relevant = all_relevant[:20]
        refs = [
            ref
            for ref in read.evidence_refs
            if ref.kind in {"reconciliation", "discrepancy_line"}
            and (
                ref.line_position is None
                or any(line.position == ref.line_position for line in relevant)
            )
        ]
        details = " ".join(
            f"Line {line.position}: quantity {line.invoice_quantity} on invoice and "
            f"{line.po_quantity} on PO; unit net {line.invoice_unit_net} versus "
            f"{line.po_unit_net} {result.inputs.currency}."
            for line in relevant
        )
        answer = (
            f"Demo: Difference is {difference.net} net, {difference.vat} VAT and "
            f"{difference.gross} gross {result.inputs.currency}. {details} "
            + (
                "Human review and supplier confirmation are recommended."
                if relevant
                else "Human review is required."
            )
        )
        return CopilotAnswer(
            answer=answer,
            citations=refs,
            findings=[
                Finding(
                    description="Reconciliation difference",
                    currency=result.inputs.currency,
                    net=difference.net,
                    vat=difference.vat,
                    gross=difference.gross,
                    evidence_ids=[refs[0].evidence_id],
                )
            ],
            suggested_questions=[],
            generation_mode="demo",
            provider="demo",
            model=None,
            prompt_version=PROMPT_VERSION,
            incomplete_context=len(all_relevant) > len(relevant),
            human_review_required=True,
            unavailable_reason=None,
        )
