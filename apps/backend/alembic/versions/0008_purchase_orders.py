"""Add purchase orders and versioned invoice snapshots."""

import sqlalchemy as sa
from alembic import op

revision = "0008_purchase_orders"
down_revision = "0007_draft_audit"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_reference", sa.String(64), nullable=False),
        sa.Column("supplier", sa.String(255), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("vat_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.CheckConstraint(
            "source_type IN ('existing', 'human_entered_demo')",
            name=op.f("ck_purchase_orders_source_type"),
        ),
        sa.CheckConstraint("version > 0", name=op.f("ck_purchase_orders_version_positive")),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name=op.f("ck_purchase_orders_currency")),
        sa.CheckConstraint(
            "vat_rate >= 0 AND vat_rate <= 1", name=op.f("ck_purchase_orders_vat_rate")
        ),
    )
    op.create_table(
        "purchase_order_items",
        sa.Column(
            "po_id",
            sa.String(36),
            sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("position", sa.Integer, primary_key=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_net", sa.Numeric(18, 2), nullable=False),
        sa.CheckConstraint("position > 0", name=op.f("ck_purchase_order_items_position_positive")),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_purchase_order_items_quantity_positive")),
        sa.CheckConstraint(
            "unit_net >= 0", name=op.f("ck_purchase_order_items_unit_net_nonnegative")
        ),
    )
    op.create_table(
        "invoice_po_snapshot_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("po_id", sa.String(36), sa.ForeignKey("purchase_orders.id"), nullable=False),
        sa.Column("po_version", sa.Integer, nullable=False),
        sa.Column("purchase_order", sa.String(64), nullable=False),
        sa.Column("delivery_receipt_id", sa.String(64)),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("vat_rate", sa.Numeric(5, 4), nullable=False),
        sa.UniqueConstraint("id", "invoice_id"),
        sa.UniqueConstraint("id", "invoice_id", "po_id", "po_version", name="uq_snapshot_source"),
        sa.CheckConstraint(
            "po_version > 0", name=op.f("ck_invoice_po_snapshot_versions_po_version_positive")
        ),
        sa.CheckConstraint(
            "vat_rate >= 0 AND vat_rate <= 1", name=op.f("ck_invoice_po_snapshot_versions_vat_rate")
        ),
    )
    op.create_table(
        "invoice_po_snapshot_version_items",
        sa.Column(
            "snapshot_id",
            sa.String(36),
            sa.ForeignKey("invoice_po_snapshot_versions.id"),
            primary_key=True,
        ),
        sa.Column("position", sa.Integer, primary_key=True),
        sa.Column("po_line_position", sa.Integer, nullable=False),
        sa.UniqueConstraint("snapshot_id", "position", "po_line_position"),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_net", sa.Numeric(18, 2), nullable=False),
        sa.CheckConstraint(
            "position > 0", name=op.f("ck_invoice_po_snapshot_version_items_position_positive")
        ),
        sa.CheckConstraint(
            "quantity > 0", name=op.f("ck_invoice_po_snapshot_version_items_quantity_positive")
        ),
        sa.CheckConstraint(
            "unit_net >= 0", name=op.f("ck_invoice_po_snapshot_version_items_unit_net_nonnegative")
        ),
    )
    op.create_table(
        "invoice_purchase_order_links",
        sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id"), primary_key=True),
        sa.Column("po_id", sa.String(36), sa.ForeignKey("purchase_orders.id"), nullable=False),
        sa.Column("po_version", sa.Integer, nullable=False),
        sa.Column("revision", sa.Integer, nullable=False),
        sa.Column("snapshot_id", sa.String(36), nullable=False),
        sa.Column("provenance", sa.String(32), nullable=False),
        sa.ForeignKeyConstraint(
            ["snapshot_id", "invoice_id", "po_id", "po_version"],
            [
                "invoice_po_snapshot_versions.id",
                "invoice_po_snapshot_versions.invoice_id",
                "invoice_po_snapshot_versions.po_id",
                "invoice_po_snapshot_versions.po_version",
            ],
        ),
        sa.CheckConstraint(
            "revision > 0", name=op.f("ck_invoice_purchase_order_links_revision_positive")
        ),
        sa.CheckConstraint(
            "provenance IN ('existing', 'human_entered_demo')",
            name=op.f("ck_invoice_purchase_order_links_provenance"),
        ),
    )
    op.create_table(
        "invoice_purchase_order_item_mappings",
        sa.Column("snapshot_id", sa.String(36), primary_key=True),
        sa.Column("invoice_line_position", sa.Integer, primary_key=True),
        sa.Column("invoice_id", sa.String(64), nullable=False),
        sa.Column("po_line_position", sa.Integer, nullable=False),
        sa.ForeignKeyConstraint(
            ["invoice_id", "invoice_line_position"],
            ["invoice_items.invoice_id", "invoice_items.position"],
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id", "invoice_id"],
            ["invoice_po_snapshot_versions.id", "invoice_po_snapshot_versions.invoice_id"],
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id", "invoice_line_position", "po_line_position"],
            [
                "invoice_po_snapshot_version_items.snapshot_id",
                "invoice_po_snapshot_version_items.position",
                "invoice_po_snapshot_version_items.po_line_position",
            ],
        ),
        sa.UniqueConstraint("snapshot_id", "po_line_position"),
        sa.CheckConstraint(
            "po_line_position > 0",
            name=op.f("ck_invoice_purchase_order_item_mappings_po_position_positive"),
        ),
    )
    op.add_column("invoice_reconciliations", sa.Column("source_snapshot_id", sa.String(36)))
    op.create_foreign_key(
        op.f("fk_invoice_reconciliations_source_snapshot_id_invoice_po_snapshot_versions"),
        "invoice_reconciliations",
        "invoice_po_snapshot_versions",
        ["source_snapshot_id", "invoice_id"],
        ["id", "invoice_id"],
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_invoice_reconciliations_source_snapshot_id_invoice_po_snapshot_versions"),
        "invoice_reconciliations",
        type_="foreignkey",
    )
    op.drop_column("invoice_reconciliations", "source_snapshot_id")
    op.drop_table("invoice_purchase_order_item_mappings")
    op.drop_table("invoice_purchase_order_links")
    op.drop_table("invoice_po_snapshot_version_items")
    op.drop_table("invoice_po_snapshot_versions")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
