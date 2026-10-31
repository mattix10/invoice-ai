from invoiceflow.modules.invoices.schemas import InvoiceQuery


class ReadOnlyTools:
    """Bounded access to existing read-only invoice services."""

    def __init__(self, invoices, reconciliations):
        self.invoices = invoices
        self.reconciliations = reconciliations

    def search_invoices(self, query: str | None = None, status=None):
        return self.invoices.list(InvoiceQuery(page_size=20, q=query, status=status))

    def get_invoice_details(self, invoice_id: str):
        return self.invoices.get_invoice(invoice_id)

    def get_reconciliation_evidence(self, invoice_id: str, revision: int | None = None):
        return self.reconciliations.read(invoice_id, revision)
