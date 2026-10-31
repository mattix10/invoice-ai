from decimal import Decimal
from uuid import uuid4

from invoiceflow.modules.invoices.calculations import calculate_totals
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.service import InvoiceNotFound, checked_totals
from invoiceflow.modules.purchase_orders.models import (
    InvoicePurchaseOrderLink,
    PurchaseOrder,
    PurchaseOrderItem,
    SnapshotItem,
    SnapshotMapping,
    SnapshotVersion,
)
from invoiceflow.modules.purchase_orders.repository import PurchaseOrderRepository
from invoiceflow.modules.purchase_orders.schemas import (
    LinkRead,
    Mapping,
    POItem,
    PORead,
    SnapshotLine,
    SnapshotRead,
)


class PurchaseOrderError(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message


def po_response(po):
    return PORead(
        id=po.id,
        version=po.version,
        source_type=po.source_type,
        external_reference=po.external_reference,
        supplier=po.supplier,
        currency=po.currency,
        vat_rate=str(po.vat_rate),
        items=[
            POItem(
                position=i.position,
                description=i.description,
                quantity=i.quantity,
                unit_net=f"{i.unit_net:.2f}",
            )
            for i in po.items
        ],
    )


def link_response(link, po, snapshot):
    return LinkRead(
        po_id=link.po_id,
        po_version=link.po_version,
        revision=link.revision,
        snapshot_id=link.snapshot_id,
        source_changed=po.version != link.po_version,
        provenance=link.provenance,
        mappings=[
            Mapping(invoice_line_position=i.position, po_line_position=i.po_line_position)
            for i in snapshot.items
        ],
    )


class PurchaseOrderService:
    def __init__(self, session):
        self.session = session
        self.repository = PurchaseOrderRepository(session)
        self.invoices = InvoiceRepository(session)

    def get(self, po_id, lock=False):
        po = self.repository.get(po_id, lock)
        if po is None:
            raise PurchaseOrderError(404, "purchase_order_not_found", "Purchase order not found")
        return po

    def list(self):
        return [po_response(po) for po in self.repository.list()]

    def save(self, fields, po_id=None):
        try:
            po = (
                self.get(po_id, lock=True)
                if po_id
                else PurchaseOrder(id=str(uuid4()), version=0, source_type="human_entered_demo")
            )
            if po_id and po.version != fields.expected_version:
                raise PurchaseOrderError(
                    409, "po_link_revision_conflict", "Purchase order version changed"
                )
            items = [
                PurchaseOrderItem(
                    position=i.position,
                    description=i.description,
                    quantity=i.quantity,
                    unit_net=Decimal(i.unit_net),
                )
                for i in fields.items
            ]
            try:
                calculate_totals(items, Decimal(fields.vat_rate), fields.currency)
            except ValueError as exc:
                raise PurchaseOrderError(
                    409, "po_link_conflict", "Invalid purchase order totals"
                ) from exc
            po.external_reference, po.supplier, po.currency, po.vat_rate = (
                fields.external_reference,
                fields.supplier,
                fields.currency,
                Decimal(fields.vat_rate),
            )
            po.version += 1
            if po_id:
                po.items.clear()
                self.session.flush()
            po.items = items
            self.session.add(po)
            self.session.commit()
            return po_response(po)
        except Exception:
            self.session.rollback()
            raise

    def get_link(self, invoice_id):
        if self.invoices.get(invoice_id) is None:
            raise InvoiceNotFound
        link = self.repository.link(invoice_id)
        if link is None:
            raise PurchaseOrderError(404, "po_link_not_found", "Purchase order link not found")
        return link_response(link, self.get(link.po_id), self.repository.snapshot(link.snapshot_id))

    def get_snapshot(self, invoice_id, snapshot_id):
        invoice = self.invoices.get(invoice_id)
        if invoice is None:
            raise InvoiceNotFound
        snapshot = (
            invoice.po_snapshot
            if snapshot_id == "legacy"
            else self.repository.snapshot(snapshot_id)
        )
        if snapshot is None or snapshot.invoice_id != invoice_id:
            raise PurchaseOrderError(
                404, "po_snapshot_not_found", "Purchase order snapshot not found"
            )
        return SnapshotRead(
            snapshot_id=snapshot_id,
            invoice_id=invoice_id,
            po_id=getattr(snapshot, "po_id", None),
            po_version=getattr(snapshot, "po_version", None),
            purchase_order=snapshot.purchase_order,
            delivery_receipt_id=snapshot.delivery_receipt_id,
            currency=snapshot.currency,
            vat_rate=str(snapshot.vat_rate),
            items=[
                SnapshotLine(
                    invoice_line_position=item.position,
                    po_line_position=getattr(item, "po_line_position", item.position),
                    quantity=item.quantity,
                    unit_net=f"{item.unit_net:.2f}",
                )
                for item in snapshot.items
            ],
        )

    def link(self, invoice_id, request):
        try:
            invoice = self.invoices.lock_invoice(invoice_id)
            if invoice is None:
                raise InvoiceNotFound
            po = self.get(request.po_id, lock=True)
            link = self.repository.link(invoice_id)
            current_revision = link.revision if link else 0
            requested = {(m.invoice_line_position, m.po_line_position) for m in request.mappings}
            if link and request.expected_link_revision == current_revision - 1:
                snapshot = self.repository.snapshot(link.snapshot_id)
                existing = {(i.position, i.po_line_position) for i in snapshot.items}
                if (link.po_id, link.po_version, link.provenance, existing) == (
                    request.po_id,
                    request.po_version,
                    po.source_type,
                    requested,
                ) and len(requested) == len(request.mappings):
                    return link_response(link, po, snapshot)
            if (
                request.expected_link_revision != current_revision
                or po.version != request.po_version
            ):
                raise PurchaseOrderError(
                    409, "po_link_revision_conflict", "Link or purchase order version changed"
                )
            invoice_positions = {i.position for i in invoice.items}
            po_items = {i.position: i for i in po.items}
            if (
                not invoice_positions
                or invoice.vat_rate is None
                or invoice.currency != po.currency
                or invoice.vat_rate != po.vat_rate
                or len(requested) != len(request.mappings)
                or len({a for a, b in requested}) != len(requested)
                or len({b for a, b in requested}) != len(requested)
                or {a for a, b in requested} != invoice_positions
                or {b for a, b in requested} != set(po_items)
            ):
                raise PurchaseOrderError(
                    409, "po_link_conflict", "Invoice and purchase order do not match"
                )
            try:
                checked_totals(invoice)
                calculate_totals(po.items, po.vat_rate, po.currency)
            except ValueError as exc:
                raise PurchaseOrderError(
                    409, "po_link_conflict", "Invalid invoice or purchase order totals"
                ) from exc
            snapshot = SnapshotVersion(
                id=str(uuid4()),
                invoice_id=invoice.id,
                po_id=po.id,
                po_version=po.version,
                purchase_order=po.external_reference,
                currency=po.currency,
                vat_rate=po.vat_rate,
                items=[
                    SnapshotItem(
                        position=a,
                        po_line_position=b,
                        quantity=po_items[b].quantity,
                        unit_net=po_items[b].unit_net,
                    )
                    for a, b in sorted(requested)
                ],
            )
            self.session.add(snapshot)
            self.session.flush()
            self.session.add_all(
                SnapshotMapping(
                    snapshot_id=snapshot.id,
                    invoice_id=invoice.id,
                    invoice_line_position=invoice_position,
                    po_line_position=po_position,
                )
                for invoice_position, po_position in sorted(requested)
            )
            if link is None:
                link = InvoicePurchaseOrderLink(invoice_id=invoice.id)
                self.session.add(link)
            link.po_id, link.po_version, link.revision, link.snapshot_id, link.provenance = (
                po.id,
                po.version,
                current_revision + 1,
                snapshot.id,
                po.source_type,
            )
            self.session.commit()
            return link_response(link, po, snapshot)
        except Exception:
            self.session.rollback()
            raise
