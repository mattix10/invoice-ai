from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from invoiceflow.modules.invoices.models import Invoice, InvoicePoSnapshot, Reconciliation
from invoiceflow.modules.invoices.schemas import InvoiceQuery


class InvoiceRepository:
    def __init__(self, session: Session):
        self.session = session

    def list(self, query: InvoiceQuery) -> tuple[list[Invoice], int]:
        conditions = []
        if query.status:
            conditions.append(Invoice.status == query.status.value)
        if query.q:
            escaped = query.q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            conditions.append(
                or_(
                    Invoice.id.ilike(pattern, escape="\\"),
                    Invoice.vendor.ilike(pattern, escape="\\"),
                )
            )
        if query.due_from:
            conditions.append(Invoice.due >= query.due_from)
        if query.due_to:
            conditions.append(Invoice.due <= query.due_to)
        total = self.session.scalar(select(func.count()).select_from(Invoice).where(*conditions))
        name = query.sort.lstrip("-")
        column = {"id": Invoice.id, "due": Invoice.due, "gross_amount": Invoice.gross_amount}[name]
        order = column.desc() if query.sort.startswith("-") else column.asc()
        ordering = [order] if name == "id" else [order, Invoice.id.asc()]
        rows = self.session.scalars(
            select(Invoice)
            .where(*conditions)
            .order_by(*ordering)
            .offset((query.page - 1) * query.page_size)
            .limit(query.page_size)
        ).all()
        return list(rows), total or 0

    def get(self, invoice_id: str) -> Invoice | None:
        return self.session.scalar(
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.po_snapshot).selectinload(InvoicePoSnapshot.items),
            )
        )

    def lock_invoice(self, invoice_id: str) -> Invoice | None:
        return self.session.scalar(
            select(Invoice).where(Invoice.id == invoice_id).with_for_update()
        )

    def active_snapshot(self, invoice):
        from invoiceflow.modules.purchase_orders.repository import PurchaseOrderRepository

        repository = PurchaseOrderRepository(self.session)
        link = repository.link(invoice.id)
        return repository.snapshot(link.snapshot_id) if link else invoice.po_snapshot

    def reconciliation(self, invoice_id: str, input_hash: str) -> Reconciliation | None:
        return self.session.scalar(
            select(Reconciliation).where(
                Reconciliation.invoice_id == invoice_id, Reconciliation.input_hash == input_hash
            )
        )

    def completed_reconciliation(self, invoice_id: str, revision: int | None):
        query = select(Reconciliation).where(
            Reconciliation.invoice_id == invoice_id, Reconciliation.state == "completed"
        )
        if revision is not None:
            query = query.where(Reconciliation.revision == revision)
        return self.session.scalar(query.order_by(Reconciliation.revision.desc()).limit(1))

    def next_revision(self, invoice_id: str) -> int:
        return (
            self.session.scalar(
                select(func.max(Reconciliation.revision)).where(
                    Reconciliation.invoice_id == invoice_id
                )
            )
            or 0
        ) + 1

    def save_reconciliation(self, result: Reconciliation) -> None:
        self.session.add(result)

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
