from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invoiceflow.core.database import Base


class IntakeDocument(Base):
    __tablename__ = "intake_documents"
    __table_args__ = (
        UniqueConstraint("invoice_id"),
        CheckConstraint("status IN ('uploaded', 'draft', 'confirmed')", name="status"),
        CheckConstraint("revision >= 0", name="revision"),
        CheckConstraint("(status = 'confirmed') = (invoice_id IS NOT NULL)", name="invoice_link"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_name: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    draft: Mapped[dict] = mapped_column(JSON, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"))


class TextExtraction(Base):
    __tablename__ = "intake_text_extractions"
    __table_args__ = (
        UniqueConstraint("document_id", "version"),
        CheckConstraint("version > 0", name="version"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("intake_documents.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)


class ExtractedPage(Base):
    __tablename__ = "intake_extracted_pages"
    __table_args__ = (
        UniqueConstraint("extraction_id", "page_number"),
        CheckConstraint("page_number > 0", name="page_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    extraction_id: Mapped[str] = mapped_column(
        ForeignKey("intake_text_extractions.id", ondelete="CASCADE"), nullable=False
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    extraction_method: Mapped[str] = mapped_column(String(32), nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)


class IntakeSuggestion(Base):
    __tablename__ = "intake_suggestions"
    __table_args__ = (
        UniqueConstraint("document_id", "version"),
        CheckConstraint("version > 0", name="version"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("intake_documents.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class IntakeDraftAudit(Base):
    __tablename__ = "intake_draft_audit"
    __table_args__ = (
        UniqueConstraint("document_id", "revision"),
        CheckConstraint("revision > 0", name="revision"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("intake_documents.id"), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_draft: Mapped[dict] = mapped_column(JSON, nullable=False)
    draft: Mapped[dict] = mapped_column(JSON, nullable=False)
    suggestion_decisions: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
