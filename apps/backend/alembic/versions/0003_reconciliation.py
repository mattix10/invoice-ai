"""Persist deterministic reconciliation revisions."""

import sqlalchemy as sa
from alembic import op

revision = "0003_reconciliation"
down_revision = "0002_invoices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invoice_reconciliations",
        sa.Column("invoice_id", sa.String(64), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.CheckConstraint(
            "revision > 0", name=op.f("ck_invoice_reconciliations_revision_positive")
        ),
        sa.CheckConstraint(
            "state IN ('processing', 'completed')", name=op.f("ck_invoice_reconciliations_state")
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["invoices.id"],
            ondelete="CASCADE",
            name=op.f("fk_invoice_reconciliations_invoice_id_invoices"),
        ),
        sa.PrimaryKeyConstraint("invoice_id", "revision", name=op.f("pk_invoice_reconciliations")),
        sa.UniqueConstraint(
            "invoice_id", "input_hash", name=op.f("uq_invoice_reconciliations_invoice_id")
        ),
    )


def downgrade() -> None:
    op.drop_table("invoice_reconciliations")
