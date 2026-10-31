"""Private intake documents and supplier invoice number."""

import sqlalchemy as sa
from alembic import op

revision = "0004_intake"
down_revision = "0003_reconciliation"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("invoices", sa.Column("supplier_invoice_number", sa.String(255)))
    op.create_unique_constraint(
        "uq_invoices_vendor", "invoices", ["vendor", "supplier_invoice_number"]
    )
    op.create_table(
        "intake_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("storage_name", sa.String(40), nullable=False, unique=True),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("draft", sa.JSON, nullable=False),
        sa.Column("revision", sa.Integer, nullable=False),
        sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id"), unique=True),
        sa.CheckConstraint(
            "status IN ('uploaded', 'draft', 'confirmed')", name=op.f("ck_intake_documents_status")
        ),
        sa.CheckConstraint("revision >= 0", name=op.f("ck_intake_documents_revision")),
        sa.CheckConstraint(
            "(status = 'confirmed') = (invoice_id IS NOT NULL)",
            name=op.f("ck_intake_documents_invoice_link"),
        ),
    )


def downgrade():
    op.drop_table("intake_documents")
    op.drop_constraint("uq_invoices_vendor", "invoices", type_="unique")
    op.drop_column("invoices", "supplier_invoice_number")
