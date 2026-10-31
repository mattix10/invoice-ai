import unicodedata
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.models import IntakeDocument
from invoiceflow.modules.intake.schemas import Draft, DraftResponse, Validation
from invoiceflow.modules.intake.storage import store
from invoiceflow.modules.invoices.calculations import calculate_totals
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.service import InvoiceService


def blank_draft():
    return Draft(
        vendor=None,
        supplier_invoice_number=None,
        issued=None,
        due=None,
        currency=None,
        vat_rate=None,
        items=[],
        declared_totals=None,
    )


def validation(draft: Draft) -> Validation:
    errors = []
    for field in ("vendor", "supplier_invoice_number", "due", "currency", "vat_rate"):
        value = getattr(draft, field)
        if value is None or isinstance(value, str) and not value.strip():
            errors.append(field)
    if not draft.items:
        errors.append("items")
    for index, item in enumerate(draft.items):
        for field in ("position", "name", "quantity", "unit_net"):
            value = getattr(item, field)
            if value is None or isinstance(value, str) and not value.strip():
                errors.append(f"items.{index}.{field}")
    if not errors:
        try:
            items = [
                SimpleNamespace(quantity=item.quantity, unit_net=Decimal(item.unit_net))
                for item in draft.items
            ]
            totals = calculate_totals(items, Decimal(draft.vat_rate), draft.currency)
            if draft.declared_totals:
                for field in ("net", "vat", "gross"):
                    declared = getattr(draft.declared_totals, field)
                    if declared is not None and Decimal(declared) != getattr(totals, field):
                        errors.append(f"declared_totals.{field}")
        except ValueError:
            errors.append("totals")
    return Validation(complete=not errors, errors=errors)


def document_response(doc):
    draft = Draft.model_validate(doc.draft)
    return {
        "document_id": doc.id,
        "invoice_id": doc.invoice_id,
        "status": doc.status,
        "original_name": doc.original_name,
        "size_bytes": doc.size_bytes,
        "created_at": doc.created_at,
        "draft": draft,
        "revision": doc.revision,
        "validation": validation(draft),
    }


class IntakeService:
    def __init__(self, session: Session, directory: str):
        self.session = session
        self.directory = directory

    def get(self, document_id, lock=False):
        query = select(IntakeDocument).where(IntakeDocument.id == document_id)
        if lock:
            query = query.with_for_update()
        doc = self.session.scalar(query)
        if doc is None:
            raise IntakeError(404, "document_not_found", "Document not found")
        return doc

    def upload(self, upload, allow_duplicate=False):
        original = unicodedata.normalize(
            "NFKC", (upload.filename or "").replace("\\", "/").split("/")[-1]
        )
        original = "".join(c for c in original if c.isprintable()).strip()[:255]
        if not original.lower().endswith(".pdf") or upload.content_type != "application/pdf":
            raise IntakeError(415, "unsupported_document_type", "Only PDF documents are supported")
        path, size, digest = store(upload.file, self.directory)
        doc = IntakeDocument(
            id=str(uuid4()),
            status="uploaded",
            original_name=original,
            storage_name=path.name,
            size_bytes=size,
            sha256=digest,
            created_at=datetime.now(UTC),
            draft=blank_draft().model_dump(mode="json"),
            revision=0,
        )
        try:
            lock_id = int(digest[:16], 16)
            if lock_id >= 2**63:
                lock_id -= 2**64
            self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})
            existing = self.session.scalar(
                select(IntakeDocument.id).where(IntakeDocument.sha256 == digest).limit(1)
            )
            if existing is not None and not allow_duplicate:
                raise IntakeError(
                    409,
                    "duplicate_document",
                    "A document with this content already exists",
                    existing_document_id=existing,
                )
            self.session.add(doc)
            self.session.commit()
        except Exception:
            self.session.rollback()
            path.unlink(missing_ok=True)
            raise
        return doc

    def file(self, doc):
        path = Path(self.directory) / doc.storage_name
        if not path.is_file():
            raise IntakeError(503, "storage_unavailable", "Document storage unavailable")
        return path

    def save(self, document_id, request):
        doc = self.get(document_id, lock=True)
        self.check_revision(doc, request.expected_revision)
        if doc.status == "confirmed":
            raise IntakeError(
                409, "document_state_conflict", "Confirmed documents cannot be edited"
            )
        doc.draft = request.draft.model_dump(mode="json")
        doc.revision += 1
        doc.status = "draft"
        self.session.commit()
        return DraftResponse(
            draft=request.draft, revision=doc.revision, validation=validation(request.draft)
        )

    def check_revision(self, doc, expected):
        if doc.revision != expected:
            raise IntakeError(
                409, "draft_revision_conflict", "Draft revision conflict", doc.revision
            )

    def confirm(self, document_id, expected):
        doc = self.get(document_id, lock=True)
        if doc.status == "confirmed":
            return {"invoice_id": doc.invoice_id, "status": "confirmed"}
        self.check_revision(doc, expected)
        draft = Draft.model_validate(doc.draft)
        if not validation(draft).complete:
            raise IntakeError(422, "invalid_draft", "Draft is incomplete")
        try:
            invoice = InvoiceService(InvoiceRepository(self.session)).create_from_draft(draft)
            self.session.flush()
            doc.invoice_id = invoice.id
            doc.status = "confirmed"
            self.session.commit()
        except ValueError:
            self.session.rollback()
            raise IntakeError(
                422, "invalid_draft", "Draft values or declared totals are invalid"
            ) from None
        except IntegrityError:
            self.session.rollback()
            raise IntakeError(409, "duplicate_invoice", "Supplier invoice already exists") from None
        return {"invoice_id": invoice.id, "status": "confirmed"}
