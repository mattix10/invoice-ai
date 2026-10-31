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
