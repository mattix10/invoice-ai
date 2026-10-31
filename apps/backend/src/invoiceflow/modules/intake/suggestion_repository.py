from sqlalchemy import select
from sqlalchemy.orm import Session

from invoiceflow.modules.intake.models import IntakeSuggestion


class SuggestionRepository:
    def __init__(self, session: Session):
        self.session = session

    def latest(self, document_id: str) -> IntakeSuggestion | None:
        return self.session.scalar(
            select(IntakeSuggestion)
            .where(IntakeSuggestion.document_id == document_id)
            .order_by(IntakeSuggestion.version.desc())
            .limit(1)
        )

    def add(self, suggestion: IntakeSuggestion) -> None:
        self.session.add(suggestion)
