from datetime import date
from decimal import Decimal

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invoiceflow.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("id", "currency"),
        UniqueConstraint("vendor", "supplier_invoice_number"),
        CheckConstraint("status IN ('needs_review', 'approved', 'processing')", name="status"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency"),
        CheckConstraint("gross_amount >= 0", name="gross_nonnegative"),
        CheckConstraint("vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 1)", name="vat_rate"),
        CheckConstraint("net_amount IS NULL OR net_amount >= 0", name="net_nonnegative"),
        CheckConstraint("vat_amount IS NULL OR vat_amount >= 0", name="vat_nonnegative"),
        CheckConstraint(
            "(net_amount IS NULL AND vat_amount IS NULL AND vat_rate IS NULL) OR "
            "(net_amount IS NOT NULL AND vat_amount IS NOT NULL AND vat_rate IS NOT NULL "
            "AND gross_amount = net_amount + vat_amount)",
            name="totals",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    vendor: Mapped[str] = mapped_column(String(255), nullable=False)
    supplier_invoice_number: Mapped[str | None] = mapped_column(String(255))
    issued: Mapped[date | None] = mapped_column(Date)
    due: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    vat_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    net_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    vat_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", order_by="InvoiceItem.position", cascade="all, delete-orphan"
    )
    po_snapshot: Mapped["InvoicePoSnapshot | None"] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", uselist=False
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        CheckConstraint("position > 0", name="position_positive"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_net >= 0", name="unit_net_nonnegative"),
    )
    invoice_id: Mapped[str] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_net: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    invoice: Mapped[Invoice] = relationship(back_populates="items")


class InvoicePoSnapshot(Base):
    __tablename__ = "invoice_po_snapshots"
    __table_args__ = (
        ForeignKeyConstraint(
            ["invoice_id", "currency"], ["invoices.id", "invoices.currency"], ondelete="CASCADE"
        ),
        CheckConstraint("vat_rate >= 0 AND vat_rate <= 1", name="vat_rate"),
    )
    invoice_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    purchase_order: Mapped[str] = mapped_column(String(64), nullable=False)
    delivery_receipt_id: Mapped[str | None] = mapped_column(String(64))
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    invoice: Mapped[Invoice] = relationship(back_populates="po_snapshot")
    items: Mapped[list["InvoicePoItem"]] = relationship(
        back_populates="snapshot", order_by="InvoicePoItem.position", cascade="all, delete-orphan"
    )


class InvoicePoItem(Base):
    __tablename__ = "invoice_po_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["invoice_id", "position"],
            ["invoice_items.invoice_id", "invoice_items.position"],
            ondelete="CASCADE",
        ),
        CheckConstraint("position > 0", name="position_positive"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_net >= 0", name="unit_net_nonnegative"),
    )
    invoice_id: Mapped[str] = mapped_column(
        ForeignKey("invoice_po_snapshots.invoice_id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_net: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    snapshot: Mapped[InvoicePoSnapshot] = relationship(back_populates="items")


class Reconciliation(Base):
    __tablename__ = "invoice_reconciliations"
    __table_args__ = (
        UniqueConstraint("invoice_id", "input_hash"),
        CheckConstraint("revision > 0", name="revision_positive"),
        CheckConstraint("state IN ('processing', 'completed')", name="state"),
    )

    invoice_id: Mapped[str] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), primary_key=True
    )
    revision: Mapped[int] = mapped_column(Integer, primary_key=True)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    state: Mapped[str] = mapped_column(String(16), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
