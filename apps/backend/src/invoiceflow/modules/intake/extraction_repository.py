from sqlalchemy import select
from sqlalchemy.orm import Session

from invoiceflow.modules.intake.models import ExtractedPage, TextExtraction


class ExtractionRepository:
    def __init__(self, session: Session):
        self.session = session

    def latest(self, document_id: str) -> TextExtraction | None:
        return self.session.scalar(
            select(TextExtraction)
            .where(TextExtraction.document_id == document_id)
            .order_by(TextExtraction.version.desc())
            .limit(1)
        )

    def pages(self, extraction_id: str) -> list[ExtractedPage]:
        return list(
            self.session.scalars(
                select(ExtractedPage)
                .where(ExtractedPage.extraction_id == extraction_id)
                .order_by(ExtractedPage.page_number)
            )
        )

    def add(self, extraction: TextExtraction, pages: list[ExtractedPage]) -> None:
        self.session.add(extraction)
        self.session.flush()
        self.session.add_all(pages)
