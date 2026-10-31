from datetime import UTC, datetime
from types import SimpleNamespace

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.router import get_service
from invoiceflow.modules.intake.schemas import DraftResponse, Validation


def test_upload_uses_camel_case_multipart_and_response(client):
    class Service:
        def upload(self, file, allow_duplicate):
            assert file.filename == "invoice.pdf"
            assert allow_duplicate is True
            return SimpleNamespace(
                id="document-1",
                status="uploaded",
                original_name="invoice.pdf",
                size_bytes=3,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )

    client.app.dependency_overrides[get_service] = lambda: Service()
    response = client.post(
        "/api/v1/intake/documents",
        files={"file": ("invoice.pdf", b"pdf", "application/pdf")},
        data={"allowDuplicate": "true"},
    )

    assert response.status_code == 201
    assert response.json()["documentId"] == "document-1"
    assert response.json()["originalName"] == "invoice.pdf"


def test_save_draft_accepts_camel_case_and_returns_it(client):
    class Service:
        def save(self, document_id, body):
            assert body.expected_revision == 2
            assert body.draft.supplier_invoice_number == "A1"
            return DraftResponse(
                draft=body.draft, revision=3, validation=Validation(complete=False, errors=[])
            )

    client.app.dependency_overrides[get_service] = lambda: Service()
    response = client.put(
        "/api/v1/intake/documents/00000000-0000-0000-0000-000000000001/draft",
        json={
            "expectedRevision": 2,
            "draft": {
                "vendor": "Example",
                "supplierInvoiceNumber": "A1",
                "issued": None,
                "due": None,
                "currency": None,
                "vatRate": None,
                "items": [],
                "declaredTotals": None,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["draft"]["supplierInvoiceNumber"] == "A1"


def test_duplicate_error_uses_camel_case_detail(client):
    class Service:
        def upload(self, file, allow_duplicate):
            raise IntakeError(409, "duplicate_document", "Duplicate", existing_document_id="doc-1")

    client.app.dependency_overrides[get_service] = lambda: Service()
    response = client.post(
        "/api/v1/intake/documents",
        files={"file": ("invoice.pdf", b"pdf", "application/pdf")},
    )

    assert response.status_code == 409
    assert response.json()["error"]["existingDocumentId"] == "doc-1"
