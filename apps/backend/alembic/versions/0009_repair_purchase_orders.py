"""Repair legacy 0008 purchase-order schemas."""

import sqlalchemy as sa
from alembic import op

revision = "0009_repair_purchase_orders"
down_revision = "0008_purchase_orders"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = {column["name"] for column in inspector.get_columns("purchase_orders")}
    if "source_type" in columns:
        return
    connection.execute(sa.text("LOCK TABLE purchase_orders IN ACCESS EXCLUSIVE MODE"))
    if connection.execute(sa.text("SELECT EXISTS (SELECT 1 FROM purchase_orders)")).scalar_one():
        raise RuntimeError("Legacy purchase orders require explicit provenance before migration")

    op.add_column("purchase_orders", sa.Column("source_type", sa.String(32), nullable=False))
    op.create_check_constraint(
        op.f("ck_purchase_orders_source_type"),
        "purchase_orders",
        "source_type IN ('existing', 'human_entered_demo')",
    )
    op.create_unique_constraint(
        "uq_snapshot_source",
        "invoice_po_snapshot_versions",
        ["id", "invoice_id", "po_id", "po_version"],
    )
    op.create_unique_constraint(
        op.f("uq_invoice_po_snapshot_version_items_snapshot_id"),
        "invoice_po_snapshot_version_items",
        ["snapshot_id", "position", "po_line_position"],
    )

    def replace_fk(table, old_columns, target, columns, target_columns):
        for fk in inspector.get_foreign_keys(table):
            if fk["constrained_columns"] == old_columns and fk["referred_table"] == target:
                op.drop_constraint(fk["name"], table, type_="foreignkey")
        op.create_foreign_key(None, table, target, columns, target_columns)

    replace_fk(
        "invoice_purchase_order_links",
        ["snapshot_id", "invoice_id"],
        "invoice_po_snapshot_versions",
        ["snapshot_id", "invoice_id", "po_id", "po_version"],
        ["id", "invoice_id", "po_id", "po_version"],
    )
    replace_fk(
        "invoice_purchase_order_item_mappings",
        ["snapshot_id", "invoice_line_position"],
        "invoice_po_snapshot_version_items",
        ["snapshot_id", "invoice_line_position", "po_line_position"],
        ["snapshot_id", "position", "po_line_position"],
    )
    op.create_foreign_key(
        None,
        "invoice_purchase_order_item_mappings",
        "invoice_po_snapshot_versions",
        ["snapshot_id", "invoice_id"],
        ["id", "invoice_id"],
    )
    replace_fk(
        "invoice_reconciliations",
        ["source_snapshot_id"],
        "invoice_po_snapshot_versions",
        ["source_snapshot_id", "invoice_id"],
        ["id", "invoice_id"],
    )


def downgrade():
    # Canonical 0008 already contains the repaired schema.
    pass
