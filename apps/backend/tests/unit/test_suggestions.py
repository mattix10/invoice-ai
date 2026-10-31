from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from invoiceflow.modules.intake.suggestion_parser import parse_suggestions
from invoiceflow.modules.intake.suggestion_schemas import FieldProposal


def test_demo_parser_returns_values_with_exact_source_spans():
    text = "Vendor: Example Ltd\nInvoice number: INV-5\nCurrency: PLN\nVAT rate: 0.23"
    page = SimpleNamespace(text=text, page_number=2, extraction_method="ocr")

    proposals = parse_suggestions([page], 3)

    assert {proposal.field: proposal.value for proposal in proposals} == {
        "vendor": "Example Ltd",
        "supplierInvoiceNumber": "INV-5",
        "currency": "PLN",
        "vatRate": "0.23",
    }
    for proposal in proposals:
        source = proposal.source
        assert source.page_number == 2
        assert source.extraction_version == 3
        assert source.extraction_method == "ocr"
        assert text[source.start : source.end] == source.excerpt == proposal.value


def test_demo_parser_does_not_propose_invalid_dates_currency_or_vat():
    page = SimpleNamespace(
        text="Issued: 2026-02-30\nDue: tomorrow\nCurrency: pln\nVAT rate: 1.5",
        page_number=1,
        extraction_method="pdf_text",
    )

    proposals = parse_suggestions([page], 1)

    assert proposals == []


@pytest.mark.parametrize(("count", "offered"), [(1000, True), (1001, False)])
def test_demo_parser_obeys_draft_item_limit(count, offered):
    page = SimpleNamespace(
        text="\n".join(f"Item: {i} | Paper | 1 | 12.00" for i in range(1, count + 1)),
        page_number=1,
        extraction_method="pdf_text",
    )

    proposals = parse_suggestions([page], 1)

    items = [proposal for proposal in proposals if proposal.field == "items"]
    assert bool(items) is offered
    if offered:
        assert len(items[0].value) == count


def test_suggestion_schema_rejects_unsupported_fields():
    proposal = {
        "field": "paymentApproved",
        "value": "true",
        "source": {
            "pageNumber": 1,
            "start": 0,
            "end": 4,
            "excerpt": "true",
            "extractionMethod": "pdf_text",
            "extractionVersion": 1,
        },
        "warnings": [],
    }

    with pytest.raises(ValidationError):
        FieldProposal.model_validate(proposal)


@pytest.mark.parametrize(
    ("gross", "expected_warnings"),
    [
        ("29.52", []),
        ("29.53", ["declaredTotals.gross does not match calculated total"]),
    ],
)
def test_suggestions_compare_declared_totals_using_exact_money(gross, expected_warnings):
    from unittest.mock import Mock

    from invoiceflow.modules.intake.suggestion_service import SuggestionService

    page = SimpleNamespace(
        text=(
            "Currency: PLN\nVAT rate: 0.23\nItem: 1 | Paper | 2 | 12.00\n"
            f"Net: 24.00\nVAT: 5.52\nGross: {gross}"
        ),
        page_number=1,
        extraction_method="pdf_text",
    )
    session = Mock()
    service = SuggestionService(session, "unused", "demo")
    service.documents = Mock()
    service.documents.get.return_value = SimpleNamespace(status="draft")
    service.extractions = Mock()
    service.extractions.latest.return_value = SimpleNamespace(id="extraction", version=1)
    service.extractions.pages.return_value = [page]
    service.suggestions = Mock()
    service.suggestions.latest.return_value = None

    response = service.start("document")

    assert response.warnings == expected_warnings
    session.commit.assert_called_once()


def test_save_preserves_draft_history_and_explicit_suggestion_decisions():
    from unittest.mock import Mock

    from invoiceflow.modules.intake.schemas import DraftRequest
    from invoiceflow.modules.intake.service import IntakeService, blank_draft

    session = Mock()
    service = IntakeService(session, "unused")
    previous = blank_draft().model_dump(mode="json")
    document = SimpleNamespace(status="draft", revision=1, draft=previous)
    service.get = Mock(return_value=document)
    page = SimpleNamespace(text="Vendor: Suggested", page_number=1, extraction_method="pdf_text")
    proposal = parse_suggestions([page], 1)[0]
    session.scalar.return_value = SimpleNamespace(
        payload={
            "document_id": "doc",
            "version": 1,
            "status": "completed",
            "proposals": [proposal.model_dump(mode="json")],
            "warnings": [],
        }
    )
    new_draft = blank_draft().model_dump(mode="json")
    new_draft["vendor"] = "Suggested"
    request = DraftRequest.model_validate(
        {
            "expectedRevision": 1,
            "draft": new_draft,
            "suggestionDecisions": {
                "suggestionVersion": 1,
                "decisions": [{"field": "vendor", "decision": "applied"}],
            },
        }
    )

    result = service.save("doc", request)

    record = session.add.call_args.args[0]
    assert record.previous_draft == previous
    assert record.draft["vendor"] == "Suggested"
    assert record.suggestion_decisions == {
        "suggestion_version": 1,
        "decisions": [{"field": "vendor", "decision": "applied"}],
    }
    assert result.revision == 2
    session.commit.assert_called_once()


def test_save_rejects_claimed_applied_suggestion_when_draft_differs():
    from unittest.mock import Mock

    from invoiceflow.modules.intake.errors import IntakeError
    from invoiceflow.modules.intake.schemas import DraftRequest
    from invoiceflow.modules.intake.service import IntakeService, blank_draft

    session = Mock()
    service = IntakeService(session, "unused")
    service.get = Mock(return_value=SimpleNamespace(status="draft", revision=0, draft={}))
    page = SimpleNamespace(text="Vendor: Suggested", page_number=1, extraction_method="pdf_text")
    proposal = parse_suggestions([page], 1)[0]
    session.scalar.return_value = SimpleNamespace(
        payload={
            "document_id": "doc",
            "version": 1,
            "status": "completed",
            "proposals": [proposal.model_dump(mode="json")],
            "warnings": [],
        }
    )
    new_draft = blank_draft().model_dump(mode="json")
    new_draft["vendor"] = "Manual correction"
    request = DraftRequest.model_validate(
        {
            "expectedRevision": 0,
            "draft": new_draft,
            "suggestionDecisions": {
                "suggestionVersion": 1,
                "decisions": [{"field": "vendor", "decision": "applied"}],
            },
        }
    )

    with pytest.raises(IntakeError) as error:
        service.save("doc", request)

    assert error.value.code == "invalid_suggestion_decisions"
    session.add.assert_not_called()
    session.commit.assert_not_called()


def test_save_audits_decisions_from_multiple_suggestion_versions():
    from unittest.mock import Mock

    from invoiceflow.modules.intake.schemas import DraftRequest
    from invoiceflow.modules.intake.service import IntakeService, blank_draft

    session = Mock()
    service = IntakeService(session, "unused")
    service.get = Mock(return_value=SimpleNamespace(status="draft", revision=0, draft={}))
    first_page = SimpleNamespace(text="Vendor: First", page_number=1, extraction_method="pdf_text")
    second_page = SimpleNamespace(
        text="Vendor: Second\nCurrency: PLN", page_number=1, extraction_method="pdf_text"
    )
    session.scalar.side_effect = [
        SimpleNamespace(
            payload={
                "document_id": "doc",
                "version": version,
                "status": "completed",
                "proposals": [
                    p.model_dump(mode="json") for p in parse_suggestions([page], version)
                ],
                "warnings": [],
            }
        )
        for version, page in [(1, first_page), (2, second_page)]
    ]
    draft = blank_draft().model_dump(mode="json")
    draft["vendor"] = "Second"
    request = DraftRequest.model_validate(
        {
            "expectedRevision": 0,
            "draft": draft,
            "suggestionDecisionBatches": [
                {"suggestionVersion": 1, "decisions": [{"field": "vendor", "decision": "applied"}]},
                {
                    "suggestionVersion": 2,
                    "decisions": [
                        {"field": "vendor", "decision": "applied"},
                        {"field": "currency", "decision": "rejected"},
                    ],
                },
            ],
        }
    )

    result = service.save("doc", request)

    assert result.revision == 1
    audit = session.add.call_args.args[0]
    assert [batch["suggestion_version"] for batch in audit.suggestion_decisions] == [1, 2]
    assert audit.suggestion_decisions[1]["decisions"][1] == {
        "field": "currency",
        "decision": "rejected",
    }
