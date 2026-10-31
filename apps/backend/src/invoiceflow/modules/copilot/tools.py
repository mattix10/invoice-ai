from pydantic import BaseModel, ConfigDict, Field, field_validator

from invoiceflow.modules.invoices.schemas import InvoiceId, InvoiceQuery, InvoiceStatus


class SearchInvoicesArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, ge=1, le=2147483647, strict=True)
    page_size: int = Field(default=20, ge=1, le=20, strict=True)
    q: str | None = Field(default=None, min_length=1, max_length=100)
    status: InvoiceStatus | None = None

    @field_validator("q", mode="before")
    @classmethod
    def trim_query(cls, value):
        return value.strip() if isinstance(value, str) else value


class InvoiceDetailsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    invoice_id: InvoiceId


class ReconciliationEvidenceArgs(InvoiceDetailsArgs):
    revision: int | None = Field(default=None, ge=1, le=2147483647, strict=True)


class ReadOnlyTools:
    """Validated, bounded access to existing read-only invoice services."""

    def __init__(self, invoices, reconciliations):
        self.invoices = invoices
        self.reconciliations = reconciliations

    def search_invoices(self, page=1, page_size=20, q=None, status=None):
        args = SearchInvoicesArgs(page=page, page_size=page_size, q=q, status=status)
        return self.invoices.list(InvoiceQuery(**args.model_dump()))

    def get_invoice_details(self, invoice_id: str):
        args = InvoiceDetailsArgs(invoice_id=invoice_id)
        return self.invoices.get_invoice(args.invoice_id)

    def get_reconciliation_evidence(self, invoice_id: str, revision: int | None = None):
        args = ReconciliationEvidenceArgs(invoice_id=invoice_id, revision=revision)
        return self.reconciliations.read(args.invoice_id, args.revision)
