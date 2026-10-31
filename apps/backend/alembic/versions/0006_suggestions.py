"""Persist independently versioned field suggestions."""

import sqlalchemy as sa
from alembic import op

revision = "0006_suggestions"
down_revision = "0005_text_extractions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intake_suggestions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id", sa.String(36), sa.ForeignKey("intake_documents.id"), nullable=False
        ),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.UniqueConstraint("document_id", "version"),
        sa.CheckConstraint("version > 0", name=op.f("ck_intake_suggestions_version")),
    )


def downgrade():
    op.drop_table("intake_suggestions")
