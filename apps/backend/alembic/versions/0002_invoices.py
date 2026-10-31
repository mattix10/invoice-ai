"""Create invoice summaries, items and matched PO snapshots."""

import sqlalchemy as sa
from alembic import op

revision = "0002_invoices"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invoices",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("vendor", sa.String(length=255), nullable=False),
        sa.Column("issued", sa.Date(), nullable=True),
        sa.Column("due", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("gross_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("vat_rate", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("net_amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("vat_amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name=op.f("ck_invoices_currency")),
        sa.CheckConstraint(
            "status IN ('needs_review', 'approved', 'processing')", name=op.f("ck_invoices_status")
        ),
        sa.CheckConstraint(
            "(net_amount IS NULL AND vat_amount IS NULL AND vat_rate IS NULL) OR "
            "(net_amount IS NOT NULL AND vat_amount IS NOT NULL AND vat_rate IS NOT NULL "
            "AND gross_amount = net_amount + vat_amount)",
            name=op.f("ck_invoices_totals"),
        ),
        sa.CheckConstraint("gross_amount >= 0", name=op.f("ck_invoices_gross_nonnegative")),
        sa.CheckConstraint(
            "net_amount IS NULL OR net_amount >= 0", name=op.f("ck_invoices_net_nonnegative")
        ),
        sa.CheckConstraint(
            "vat_amount IS NULL OR vat_amount >= 0", name=op.f("ck_invoices_vat_nonnegative")
        ),
        sa.CheckConstraint(
            "vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 1)",
            name=op.f("ck_invoices_vat_rate"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invoices")),
        sa.UniqueConstraint("id", "currency", name=op.f("uq_invoices_id")),
    )
    op.create_index(op.f("ix_invoices_due"), "invoices", ["due"], unique=False)
    op.create_index(op.f("ix_invoices_status"), "invoices", ["status"], unique=False)
    op.create_table(
        "invoice_items",
        sa.Column("invoice_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_net", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.CheckConstraint("position > 0", name=op.f("ck_invoice_items_position_positive")),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_invoice_items_quantity_positive")),
        sa.CheckConstraint("unit_net >= 0", name=op.f("ck_invoice_items_unit_net_nonnegative")),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["invoices.id"],
            name=op.f("fk_invoice_items_invoice_id_invoices"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("invoice_id", "position", name=op.f("pk_invoice_items")),
    )
    op.create_table(
        "invoice_po_snapshots",
        sa.Column("invoice_id", sa.String(length=64), nullable=False),
        sa.Column("purchase_order", sa.String(length=64), nullable=False),
        sa.Column("delivery_receipt_id", sa.String(length=64), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("vat_rate", sa.Numeric(precision=5, scale=4), nullable=False),
        sa.CheckConstraint(
            "vat_rate >= 0 AND vat_rate <= 1", name=op.f("ck_invoice_po_snapshots_vat_rate")
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id", "currency"],
            ["invoices.id", "invoices.currency"],
            name=op.f("fk_invoice_po_snapshots_invoice_id_invoices"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("invoice_id", name=op.f("pk_invoice_po_snapshots")),
    )
    op.create_table(
        "invoice_po_items",
        sa.Column("invoice_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_net", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.CheckConstraint("position > 0", name=op.f("ck_invoice_po_items_position_positive")),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_invoice_po_items_quantity_positive")),
        sa.CheckConstraint("unit_net >= 0", name=op.f("ck_invoice_po_items_unit_net_nonnegative")),
        sa.ForeignKeyConstraint(
            ["invoice_id", "position"],
            ["invoice_items.invoice_id", "invoice_items.position"],
            name=op.f("fk_invoice_po_items_invoice_id_invoice_items"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["invoice_po_snapshots.invoice_id"],
            name=op.f("fk_invoice_po_items_invoice_id_invoice_po_snapshots"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("invoice_id", "position", name=op.f("pk_invoice_po_items")),
    )


def downgrade() -> None:
    op.drop_table("invoice_po_items")
    op.drop_table("invoice_po_snapshots")
    op.drop_table("invoice_items")
    op.drop_index(op.f("ix_invoices_status"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_due"), table_name="invoices")
    op.drop_table("invoices")
