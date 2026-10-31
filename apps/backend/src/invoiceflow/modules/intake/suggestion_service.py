from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy.orm import Session

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.extraction_repository import ExtractionRepository
from invoiceflow.modules.intake.models import IntakeSuggestion
from invoiceflow.modules.intake.service import IntakeService
from invoiceflow.modules.intake.suggestion_parser import parse_suggestions
from invoiceflow.modules.intake.suggestion_repository import SuggestionRepository
from invoiceflow.modules.intake.suggestion_schemas import SuggestionsResponse
from invoiceflow.modules.invoices.calculations import calculate_totals


class SuggestionService:
    def __init__(self, session: Session, directory: str, provider: str = "disabled"):
        self.session = session
        self.documents = IntakeService(session, directory)
        self.extractions = ExtractionRepository(session)
        self.suggestions = SuggestionRepository(session)
        self.provider = provider

    def latest(self, document_id: str) -> SuggestionsResponse:
        self.documents.get(document_id)
        record = self.suggestions.latest(document_id)
        if record is None:
            raise IntakeError(404, "suggestions_not_found", "Suggestions not found")
        return SuggestionsResponse.model_validate(record.payload)

    def start(self, document_id: str) -> SuggestionsResponse:
        try:
            document = self.documents.get(document_id, lock=True)
            if document.status not in ("uploaded", "draft"):
                raise IntakeError(409, "document_state_conflict", "Document cannot be processed")
            if self.provider != "demo":
                raise IntakeError(503, "suggestions_unavailable", "Suggestion provider unavailable")
            extraction = self.extractions.latest(document_id)
            if extraction is None:
                raise IntakeError(503, "suggestions_unavailable", "Text extraction unavailable")
            pages = self.extractions.pages(extraction.id)
            proposals = parse_suggestions(pages, extraction.version)
            pages_by_number = {page.page_number: page for page in pages}
            for item in proposals:
                source = item.source
                page = pages_by_number.get(source.page_number)
                if (
                    page is None
                    or source.extraction_version != extraction.version
                    or source.extraction_method != page.extraction_method
                    or page.text[source.start : source.end] != source.excerpt
                ):
                    raise IntakeError(422, "invalid_suggestion", "Invalid suggestion evidence")
            values = {item.field: item.value for item in proposals}
            warnings = []
            if all(
                values.get(field) is not None
                for field in ("items", "currency", "vatRate", "declaredTotals")
            ):
                try:
                    totals = calculate_totals(
                        [
                            SimpleNamespace(quantity=item.quantity, unit_net=Decimal(item.unit_net))
                            for item in values["items"]
                        ],
                        Decimal(values["vatRate"]),
                        values["currency"],
                    )
                    declared = values["declaredTotals"]
                    for field in ("net", "vat", "gross"):
                        amount = getattr(declared, field)
                        if amount is not None and Decimal(amount) != getattr(totals, field):
                            warnings.append(
                                f"declaredTotals.{field} does not match calculated total"
                            )
                except (TypeError, ValueError):
                    warnings.append("Unable to calculate proposed totals")
            previous = self.suggestions.latest(document_id)
            response = SuggestionsResponse(
                document_id=document_id,
                version=previous.version + 1 if previous else 1,
                status="completed",
                proposals=proposals,
                warnings=warnings,
            )
            self.suggestions.add(
                IntakeSuggestion(
                    id=str(uuid4()),
                    document_id=document_id,
                    version=response.version,
                    payload=response.model_dump(mode="json"),
                )
            )
            self.session.commit()
            return response
        except Exception:
            self.session.rollback()
            raise
