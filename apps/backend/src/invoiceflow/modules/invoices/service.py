from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from invoiceflow.modules.invoices.calculations import (
    calculate_difference,
    calculate_totals,
    line_net,
)
from invoiceflow.modules.invoices.models import Invoice
from invoiceflow.modules.invoices.models import InvoiceItem as InvoiceItemModel
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

    def create_from_draft(self, draft):
        items = [
            InvoiceItemModel(
                position=item.position,
                name=item.name.strip(),
                quantity=item.quantity,
                unit_net=Decimal(item.unit_net),
            )
            for item in draft.items
        ]
        totals = calculate_totals(items, Decimal(draft.vat_rate), draft.currency)
        if draft.declared_totals:
            for field in ("net", "vat", "gross"):
                value = getattr(draft.declared_totals, field)
                if value is not None and Decimal(value) != getattr(totals, field):
                    raise ValueError("Declared totals do not match calculated totals")
        invoice = Invoice(
            id=f"INV-{datetime.now(UTC).year}-{uuid4().int}",
            vendor=draft.vendor.strip(),
            supplier_invoice_number=draft.supplier_invoice_number.strip(),
            issued=draft.issued,
            due=draft.due,
            currency=draft.currency,
            status="needs_review",
            vat_rate=Decimal(draft.vat_rate),
            net_amount=totals.net,
            vat_amount=totals.vat,
            gross_amount=totals.gross,
            items=items,
        )
        self.repository.session.add(invoice)
        return invoice

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
        po = self.repository.active_snapshot(invoice)
        return InvoiceDetail(
            **summary(invoice).model_dump(),
            issued=invoice.issued,
            purchase_order=po.purchase_order if po else None,
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
        po = self.repository.active_snapshot(invoice)
        if po is None:
            raise ComparisonNotFound
        if (
            invoice.vat_rate is None
            or invoice.currency != po.currency
            or invoice.vat_rate != po.vat_rate
        ):
            raise ValueError("Invoice and purchase order terms do not match")
        po_items = {item.position: item for item in po.items}
        if set(po_items) != {item.position for item in invoice.items} or (
            not hasattr(po, "id")
            and any(po_items[item.position].quantity != item.quantity for item in invoice.items)
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
                    po_quantity=other.quantity,
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
