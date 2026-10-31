from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from invoiceflow.modules.purchase_orders.models import (
    InvoicePurchaseOrderLink,
    PurchaseOrder,
    SnapshotVersion,
)


class PurchaseOrderRepository:
    def __init__(self, session: Session):
        self.session = session

    def list(self):
        return list(
            self.session.scalars(
                select(PurchaseOrder)
                .options(selectinload(PurchaseOrder.items))
                .order_by(PurchaseOrder.id)
                .limit(100)
            )
        )

    def get(self, po_id, lock=False):
        query = (
            select(PurchaseOrder)
            .where(PurchaseOrder.id == po_id)
            .options(selectinload(PurchaseOrder.items))
        )
        if lock:
            query = query.with_for_update()
        return self.session.scalar(query)

    def link(self, invoice_id):
        return self.session.get(InvoicePurchaseOrderLink, invoice_id)

    def snapshot(self, snapshot_id):
        return self.session.scalar(
            select(SnapshotVersion)
            .where(SnapshotVersion.id == snapshot_id)
            .options(selectinload(SnapshotVersion.items))
        )
