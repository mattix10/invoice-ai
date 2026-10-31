from decimal import Decimal

from invoiceflow.modules.invoices.calculations import (
    calculate_difference,
    calculate_totals,
    line_net,
)
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.schemas import (
    ComparisonItem,
    InvoiceComparison,
    InvoiceDetail,
    InvoiceItem,
    InvoicePage,
    InvoiceQuery,
    InvoiceSummary,
    InvoiceTotals,
)


class InvoiceNotFound(Exception):
    pass


class ComparisonNotFound(Exception):
    pass


def money(value: Decimal) -> str:
    return f"{value:.2f}"


def totals_dto(value) -> InvoiceTotals:
    return InvoiceTotals(net=money(value.net), vat=money(value.vat), gross=money(value.gross))


def checked_totals(invoice):
    totals = calculate_totals(invoice.items, invoice.vat_rate, invoice.currency)
    if (totals.net, totals.vat, totals.gross) != (
        invoice.net_amount,
        invoice.vat_amount,
        invoice.gross_amount,
    ):
        raise ValueError("Stored invoice totals do not match its items")
    return totals


def summary(invoice) -> InvoiceSummary:
    return InvoiceSummary(
        id=invoice.id,
        vendor=invoice.vendor,
        due=invoice.due,
        currency=invoice.currency,
        status=invoice.status,
        gross_amount=money(invoice.gross_amount),
    )


class InvoiceService:
    def __init__(self, repository: InvoiceRepository):
        self.repository = repository

    def list(self, query: InvoiceQuery) -> InvoicePage:
        invoices, total = self.repository.list(query)
        return InvoicePage(
            items=[summary(item) for item in invoices],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )

    def get_invoice(self, invoice_id: str) -> InvoiceDetail:
        invoice = self.repository.get(invoice_id)
        if invoice is None:
            raise InvoiceNotFound
        totals = checked_totals(invoice) if invoice.vat_rate is not None else None
        return InvoiceDetail(
            **summary(invoice).model_dump(),
            issued=invoice.issued,
            purchase_order=invoice.po_snapshot.purchase_order if invoice.po_snapshot else None,
            vat_rate=str(invoice.vat_rate) if invoice.vat_rate is not None else None,
            items=[
                InvoiceItem(
                    position=item.position,
                    name=item.name,
                    quantity=item.quantity,
                    unit_net=money(item.unit_net),
                    net=money(line_net(item.quantity, item.unit_net)),
                )
                for item in invoice.items
            ],
            totals=totals_dto(totals) if totals else None,
        )

    def get_comparison(self, invoice_id: str) -> InvoiceComparison:
        invoice = self.repository.get(invoice_id)
        if invoice is None:
            raise InvoiceNotFound
        po = invoice.po_snapshot
        if po is None:
            raise ComparisonNotFound
        if (
            invoice.vat_rate is None
            or invoice.currency != po.currency
            or invoice.vat_rate != po.vat_rate
        ):
            raise ValueError("Invoice and purchase order terms do not match")
        po_items = {item.position: item for item in po.items}
        if set(po_items) != {item.position for item in invoice.items} or any(
            po_items[item.position].quantity != item.quantity for item in invoice.items
        ):
            raise ValueError("Invoice and purchase order items do not match")
        invoice_totals = checked_totals(invoice)
        po_totals = calculate_totals(po.items, po.vat_rate, po.currency)
        difference, percent = calculate_difference(invoice_totals, po_totals)
        items = []
        for item in invoice.items:
            other = po_items[item.position]
            items.append(
                ComparisonItem(
                    position=item.position,
                    name=item.name,
                    quantity=item.quantity,
                    invoice_unit_net=money(item.unit_net),
                    po_unit_net=money(other.unit_net),
                    invoice_net=money(line_net(item.quantity, item.unit_net)),
                    po_net=money(line_net(other.quantity, other.unit_net)),
                )
            )
        return InvoiceComparison(
            invoice_id=invoice.id,
            purchase_order=po.purchase_order,
            delivery_receipt_id=po.delivery_receipt_id,
            currency=invoice.currency,
            vat_rate=str(invoice.vat_rate),
            items=items,
            invoice_totals=totals_dto(invoice_totals),
            po_totals=totals_dto(po_totals),
            difference=totals_dto(difference),
            difference_percent=str(percent) if percent is not None else None,
        )
