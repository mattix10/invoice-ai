from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invoiceflow.core.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint("version > 0", name="version_positive"),
        CheckConstraint("source_type IN ('existing', 'human_entered_demo')", name="source_type"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency"),
        CheckConstraint("vat_rate >= 0 AND vat_rate <= 1", name="vat_rate"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    external_reference: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        cascade="all, delete-orphan", order_by="PurchaseOrderItem.position"
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__ = (
        CheckConstraint("position > 0", name="position_positive"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_net >= 0", name="unit_net_nonnegative"),
    )
    po_id: Mapped[str] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_net: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)


class SnapshotVersion(Base):
    __tablename__ = "invoice_po_snapshot_versions"
    __table_args__ = (
        UniqueConstraint("id", "invoice_id"),
        UniqueConstraint("id", "invoice_id", "po_id", "po_version", name="uq_snapshot_source"),
        CheckConstraint("po_version > 0", name="po_version_positive"),
        CheckConstraint("vat_rate >= 0 AND vat_rate <= 1", name="vat_rate"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    po_id: Mapped[str] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    po_version: Mapped[int] = mapped_column(Integer, nullable=False)
    purchase_order: Mapped[str] = mapped_column(String(64), nullable=False)
    delivery_receipt_id: Mapped[str | None] = mapped_column(String(64))
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    items: Mapped[list["SnapshotItem"]] = relationship(
        cascade="all, delete-orphan", order_by="SnapshotItem.position"
    )


class SnapshotItem(Base):
    __tablename__ = "invoice_po_snapshot_version_items"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "position", "po_line_position"),
        CheckConstraint("position > 0", name="position_positive"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_net >= 0", name="unit_net_nonnegative"),
    )
    snapshot_id: Mapped[str] = mapped_column(
        ForeignKey("invoice_po_snapshot_versions.id"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    po_line_position: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_net: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)


class InvoicePurchaseOrderLink(Base):
    __tablename__ = "invoice_purchase_order_links"
    __table_args__ = (
        ForeignKeyConstraint(
            ["snapshot_id", "invoice_id", "po_id", "po_version"],
            [
                "invoice_po_snapshot_versions.id",
                "invoice_po_snapshot_versions.invoice_id",
                "invoice_po_snapshot_versions.po_id",
                "invoice_po_snapshot_versions.po_version",
            ],
        ),
        CheckConstraint("revision > 0", name="revision_positive"),
        CheckConstraint("provenance IN ('existing', 'human_entered_demo')", name="provenance"),
    )
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), primary_key=True)
    po_id: Mapped[str] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    po_version: Mapped[int] = mapped_column(Integer, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_id: Mapped[str] = mapped_column(String(36), nullable=False)
    provenance: Mapped[str] = mapped_column(String(32), nullable=False)


class SnapshotMapping(Base):
    __tablename__ = "invoice_purchase_order_item_mappings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["invoice_id", "invoice_line_position"],
            ["invoice_items.invoice_id", "invoice_items.position"],
        ),
        ForeignKeyConstraint(
            ["snapshot_id", "invoice_id"],
            ["invoice_po_snapshot_versions.id", "invoice_po_snapshot_versions.invoice_id"],
        ),
        ForeignKeyConstraint(
            ["snapshot_id", "invoice_line_position", "po_line_position"],
            [
                "invoice_po_snapshot_version_items.snapshot_id",
                "invoice_po_snapshot_version_items.position",
                "invoice_po_snapshot_version_items.po_line_position",
            ],
        ),
        UniqueConstraint("snapshot_id", "po_line_position"),
        CheckConstraint("po_line_position > 0", name="po_position_positive"),
    )
    snapshot_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    invoice_line_position: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[str] = mapped_column(String(64), nullable=False)
    po_line_position: Mapped[int] = mapped_column(Integer, nullable=False)
