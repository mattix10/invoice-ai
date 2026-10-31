"""Persist page-level text provenance."""

import sqlalchemy as sa
from alembic import op

revision = "0005_text_extractions"
down_revision = "0004_intake"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intake_text_extractions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id", sa.String(36), sa.ForeignKey("intake_documents.id"), nullable=False
        ),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.UniqueConstraint("document_id", "version"),
        sa.CheckConstraint("version > 0", name=op.f("ck_intake_text_extractions_version")),
    )
    op.create_table(
        "intake_extracted_pages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "extraction_id",
            sa.String(36),
            sa.ForeignKey("intake_text_extractions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("page_number", sa.Integer, nullable=False),
        sa.Column("extraction_method", sa.String(32), nullable=False),
        sa.Column("text", sa.String, nullable=False),
        sa.UniqueConstraint("extraction_id", "page_number"),
        sa.CheckConstraint("page_number > 0", name=op.f("ck_intake_extracted_pages_page_number")),
    )


def downgrade():
    op.drop_table("intake_extracted_pages")
    op.drop_table("intake_text_extractions")
