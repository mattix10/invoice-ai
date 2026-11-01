from uuid import uuid4

from sqlalchemy.orm import Session

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.extraction_repository import ExtractionRepository
from invoiceflow.modules.intake.models import ExtractedPage, TextExtraction
from invoiceflow.modules.intake.ocr_client import extract_ocr, extract_text_layer
from invoiceflow.modules.intake.service import IntakeService


def normalize_document_text(text: str) -> str:
    return text.replace("\x00", " ")


class ExtractionService:
    def __init__(self, session: Session, directory: str, spool: str | None):
        self.session = session
        self.documents = IntakeService(session, directory)
        self.repository = ExtractionRepository(session)
        self.spool = spool

    def start(self, document_id: str) -> dict:
        document = self.documents.get(document_id, lock=True)
        if document.status == "confirmed":
            raise IntakeError(409, "document_state_conflict", "Document cannot be processed")
        try:
            path = self.documents.file(document)
            if self.spool is None:
                raise IntakeError(503, "extraction_unavailable", "Document processing unavailable")
            kind = path.suffix.removeprefix(".")
            if kind == "pdf":
                text_pages = [
                    normalize_document_text(text) for text in extract_text_layer(path, self.spool)
                ]
                ocr_pages = (
                    extract_ocr(path, kind, self.spool)
                    if any(not page.strip() for page in text_pages)
                    else None
                )
                if ocr_pages is not None and len(ocr_pages) != len(text_pages):
                    raise IntakeError(
                        503, "extraction_unavailable", "Document processing unavailable"
                    )
                pages = [
                    ("pdf_text", text)
                    if text.strip()
                    else ("ocr", normalize_document_text(ocr_pages[index]))
                    for index, text in enumerate(text_pages)
                ]
            else:
                pages = [
                    ("ocr", normalize_document_text(text))
                    for text in extract_ocr(path, kind, self.spool)
                ]
                if len(pages) != 1:
                    raise IntakeError(
                        503, "extraction_unavailable", "Document processing unavailable"
                    )
            if sum(len(page.encode("utf-8")) for _, page in pages) > 1_000_000:
                raise IntakeError(503, "extraction_unavailable", "Document processing unavailable")
            previous = self.repository.latest(document_id)
            version = previous.version + 1 if previous else 1
            extraction_id = str(uuid4())
            extraction = TextExtraction(
                id=extraction_id, document_id=document_id, version=version, status="completed"
            )
            extracted_pages = [
                ExtractedPage(
                    id=str(uuid4()),
                    extraction_id=extraction_id,
                    page_number=number,
                    extraction_method=method,
                    text=page,
                )
                for number, (method, page) in enumerate(pages, 1)
            ]
            self.repository.add(extraction, extracted_pages)
            self.session.commit()
            return self.response(extraction, extracted_pages)
        except Exception:
            self.session.rollback()
            raise

    def latest(self, document_id: str) -> dict:
        self.documents.get(document_id)
        extraction = self.repository.latest(document_id)
        if extraction is None:
            raise IntakeError(404, "extraction_not_found", "Text extraction not found")
        return self.response(extraction, self.repository.pages(extraction.id))

    @staticmethod
    def response(extraction: TextExtraction, pages: list[ExtractedPage]) -> dict:
        return {
            "document_id": extraction.document_id,
            "version": extraction.version,
            "status": extraction.status,
            "pages": [
                {
                    "document_id": extraction.document_id,
                    "page_number": page.page_number,
                    "extraction_method": page.extraction_method,
                    "extraction_version": extraction.version,
                    "text": page.text,
                }
                for page in pages
            ],
        }
