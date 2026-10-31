"""Record draft revisions and explicit suggestion decisions."""

import sqlalchemy as sa
from alembic import op

revision = "0007_draft_audit"
down_revision = "0006_suggestions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intake_draft_audit",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id", sa.String(36), sa.ForeignKey("intake_documents.id"), nullable=False
        ),
        sa.Column("revision", sa.Integer, nullable=False),
        sa.Column("previous_draft", sa.JSON(), nullable=False),
        sa.Column("draft", sa.JSON(), nullable=False),
        sa.Column("suggestion_decisions", sa.JSON(), nullable=True),
        sa.UniqueConstraint("document_id", "revision"),
        sa.CheckConstraint("revision > 0", name=op.f("ck_intake_draft_audit_revision")),
    )


def downgrade():
    op.drop_table("intake_draft_audit")
