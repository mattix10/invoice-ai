from io import BytesIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from invoiceflow.core.database import get_session
from invoiceflow.main import create_app

pytestmark = pytest.mark.integration


def pdf(pages=1, encrypted=False):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=100, height=100)
    if encrypted:
        writer.encrypt("password")
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


@pytest.fixture
def client(isolated_connection, session, database_settings, tmp_path):
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    settings = database_settings.model_copy(
        update={"intake_storage_dir": str(tmp_path), "intake_ocr_spool_dir": str(tmp_path)}
    )
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as value:
        yield value
    app.dependency_overrides.clear()


def upload(client, data, name="invoice.pdf", mime="application/pdf"):
    return client.post("/api/v1/intake/documents", files={"file": (name, data, mime)})


def draft():
    return {
        "vendor": "Fictional vendor",
        "supplierInvoiceNumber": "F-10",
        "issued": None,
        "due": "2026-12-20",
        "currency": "PLN",
        "vatRate": "0.23",
        "items": [{"position": 1, "name": "Service", "quantity": 2, "unitNet": "10.00"}],
        "declaredTotals": None,
    }


def test_upload_save_confirm_and_reopen(client):
    # Arrange
    contents = pdf()
    data = draft()

    # Act
    response = upload(client, contents, "../../invoice.pdf")
    doc = response.json()
    url = "/api/v1/intake/documents/" + doc["documentId"]
    saved = client.put(url + "/draft", json={"expectedRevision": 0, "draft": data})
    fetched = client.get(url)
    confirmation = client.post(url + "/confirm", json={"expectedRevision": 1})
    repeated = client.post(url + "/confirm", json={"expectedRevision": 1})
    invoice = client.get("/api/v1/invoices/" + confirmation.json()["invoiceId"])

    # Assert
    assert response.status_code == 201
    assert doc["originalName"] == "invoice.pdf"
    assert client.get(url + "/file").content == contents
    assert saved.json()["validation"]["complete"] is True
    assert fetched.json()["draft"] == data
    assert fetched.json()["revision"] == 1
    assert confirmation.status_code == 200
    assert repeated.json() == confirmation.json()
    assert invoice.json()["status"] == "needs_review"
    assert invoice.json()["purchaseOrder"] is None
    assert invoice.json()["totals"]["gross"] == "24.60"


def test_stale_revision_is_rejected(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    body = {"expectedRevision": 0, "draft": draft()}
    client.put(url + "/draft", json=body)

    # Act
    response = client.put(url + "/draft", json=body)

    # Assert
    assert response.status_code == 409
    assert response.json()["error"]["currentRevision"] == 1
    assert response.json()["error"]["code"] == "draft_revision_conflict"


@pytest.mark.parametrize(
    ("contents", "status", "code"),
    [
        (b"", 422, "invalid_document"),
        (b"not pdf", 422, "invalid_document"),
        (b"%PDF-fake", 422, "invalid_document"),
        (pdf(encrypted=True), 422, "encrypted_document"),
        (pdf(pages=21), 413, "document_limit_exceeded"),
        (b"x" * (10 * 1024 * 1024 + 1), 413, "document_limit_exceeded"),
    ],
)
def test_invalid_documents_leave_no_files(client, tmp_path, contents, status, code):
    # Act
    response = upload(client, contents)

    # Assert
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert list(tmp_path.iterdir()) == []


def test_duplicate_document_is_rejected_without_removing_original(client):
    # Arrange
    contents = pdf()
    first = upload(client, contents).json()

    # Act
    response = upload(client, contents)

    # Assert
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "duplicate_document"
    assert response.json()["error"]["existingDocumentId"] == first["documentId"]
    assert (
        client.get("/api/v1/intake/documents/" + first["documentId"] + "/file").content == contents
    )


def test_declared_totals_mismatch_cannot_create_invoice(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    data = draft()
    data["declaredTotals"] = {"net": "1.00", "vat": None, "gross": None}
    client.put(url + "/draft", json={"expectedRevision": 0, "draft": data})

    # Act
    response = client.post(url + "/confirm", json={"expectedRevision": 1})

    # Assert
    assert response.status_code == 422
    assert client.get(url).json()["status"] == "draft"


def test_concurrent_confirmation_creates_one_invoice(
    isolated_connection, database_settings, tmp_path
):
    # Arrange
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session

    from invoiceflow.modules.intake.schemas import DraftRequest
    from invoiceflow.modules.intake.service import IntakeService

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    schema = isolated_connection.execute(text("SELECT current_schema()")).scalar_one()
    isolated_connection.commit()
    engine = create_engine(
        database_settings.database_url.get_secret_value(),
        connect_args={"options": f"-csearch_path={schema}"},
    )
    from starlette.datastructures import UploadFile

    with Session(engine) as session:
        service = IntakeService(session, str(tmp_path))
        doc = service.upload(
            UploadFile(
                filename="test.pdf",
                file=BytesIO(pdf()),
                headers={"content-type": "application/pdf"},
            )
        )
        service.save(doc.id, DraftRequest(expected_revision=0, draft=draft()))
        document_id = doc.id
    barrier = Barrier(2)

    def confirm():
        with Session(engine) as session:
            barrier.wait(timeout=10)
            return IntakeService(session, str(tmp_path)).confirm(document_id, 1)

    try:
        # Act
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: confirm(), range(2)))

        # Assert
        assert results[0] == results[1]
        with engine.connect() as connection:
            assert connection.execute(text("SELECT count(*) FROM invoices")).scalar_one() == 1
    finally:
        engine.dispose()


def test_incomplete_draft_is_saved_but_cannot_be_confirmed(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    data = draft()
    data["vendor"] = None

    # Act
    saved = client.put(url + "/draft", json={"expectedRevision": 0, "draft": data})
    confirmed = client.post(url + "/confirm", json={"expectedRevision": 1})

    # Assert
    assert saved.status_code == 200
    assert saved.json()["validation"] == {"complete": False, "errors": ["vendor"]}
    assert confirmed.status_code == 422
    assert client.get(url).json()["draft"]["vendor"] is None


def test_draft_missing_key_is_rejected(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    data = draft()
    del data["vendor"]

    # Act
    response = client.put(url + "/draft", json={"expectedRevision": 0, "draft": data})

    # Assert
    assert response.status_code == 422
    assert client.get(url).json()["revision"] == 0


@pytest.mark.parametrize(
    "name,mime", [("invoice.txt", "application/pdf"), ("invoice.pdf", "text/plain")]
)
def test_wrong_extension_or_mime_is_rejected(client, name, mime):
    # Act
    response = upload(client, pdf(), name, mime)

    # Assert
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_document_type"


def test_multipart_body_limit_rejects_before_file_storage(client, tmp_path):
    # Arrange
    contents = b"x" * (10 * 1024 * 1024 + 65536)

    # Act
    response = upload(client, contents)

    # Assert
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "document_limit_exceeded"
    assert list(tmp_path.iterdir()) == []


def test_empty_draft_fields_are_saved_as_null(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    data = draft()
    data.update(currency="", vatRate="", due="")
    data["items"][0]["unitNet"] = ""

    # Act
    response = client.put(url + "/draft", json={"expectedRevision": 0, "draft": data})

    # Assert
    assert response.status_code == 200
    assert response.json()["draft"]["currency"] is None
    assert response.json()["draft"]["items"][0]["unitNet"] is None
    assert response.json()["validation"]["complete"] is False


def test_duplicate_can_be_explicitly_uploaded_as_separate_document(client):
    # Arrange
    contents = pdf()
    original = upload(client, contents).json()

    # Act
    response = client.post(
        "/api/v1/intake/documents",
        files={"file": ("invoice.pdf", contents, "application/pdf")},
        data={"allowDuplicate": "true"},
    )

    # Assert
    assert response.status_code == 201
    assert response.json()["documentId"] != original["documentId"]
    assert (
        client.get("/api/v1/intake/documents/" + original["documentId"] + "/file").content
        == contents
    )


def test_concurrent_duplicate_uploads_require_explicit_resolution(
    isolated_connection, database_settings, tmp_path
):
    # Arrange
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
    from starlette.datastructures import Headers, UploadFile

    from invoiceflow.modules.intake.errors import IntakeError
    from invoiceflow.modules.intake.service import IntakeService

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "head")
    schema = isolated_connection.execute(text("SELECT current_schema()")).scalar_one()
    isolated_connection.commit()
    engine = create_engine(
        database_settings.database_url.get_secret_value(),
        connect_args={"options": f"-csearch_path={schema}"},
    )
    contents = pdf()
    barrier = Barrier(2)

    def run():
        with Session(engine) as session:
            file = UploadFile(
                file=BytesIO(contents),
                filename="invoice.pdf",
                headers=Headers({"content-type": "application/pdf"}),
            )
            barrier.wait(timeout=10)
            try:
                return IntakeService(session, str(tmp_path)).upload(file).id
            except IntakeError as exc:
                return exc.code

    try:
        # Act
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: run(), range(2)))

        # Assert
        assert results.count("duplicate_document") == 1
        with engine.connect() as connection:
            assert (
                connection.execute(text("SELECT count(*) FROM intake_documents")).scalar_one() == 1
            )
        assert len(list(tmp_path.iterdir())) == 1
    finally:
        engine.dispose()


def test_extraction_preserves_draft_and_persists_page_provenance(client, monkeypatch):
    # Arrange
    document = upload(client, pdf()).json()
    document_id = document["documentId"]
    url = "/api/v1/intake/documents/" + document_id
    client.put(url + "/draft", json={"expectedRevision": 0, "draft": draft()})
    before = client.get(url).json()
    monkeypatch.setattr(
        "invoiceflow.modules.intake.extraction_service.extract_text_layer",
        lambda path, spool: ["Fictional invoice"],
    )

    # Act
    first = client.post(url + "/text-extractions")
    second = client.post(url + "/text-extractions")
    latest = client.get(url + "/text-extractions/latest")
    after = client.get(url).json()

    # Assert
    assert first.status_code == 200, first.text
    assert first.json()["pages"] == [
        {
            "documentId": document_id,
            "pageNumber": 1,
            "extractionMethod": "pdf_text",
            "extractionVersion": 1,
            "text": "Fictional invoice",
        }
    ]
    assert second.json()["version"] == 2
    assert latest.json() == second.json()
    assert after == before
    assert after["invoiceId"] is None


def test_unavailable_extraction_leaves_document_unchanged_and_can_be_retried(client, monkeypatch):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    before = client.get(url).json()
    from invoiceflow.modules.intake.errors import IntakeError

    def unavailable(path, spool):
        raise IntakeError(503, "extraction_unavailable", "Document processing unavailable")

    monkeypatch.setattr(
        "invoiceflow.modules.intake.extraction_service.extract_text_layer", unavailable
    )

    # Act
    failed = client.post(url + "/text-extractions")
    missing = client.get(url + "/text-extractions/latest")
    monkeypatch.setattr(
        "invoiceflow.modules.intake.extraction_service.extract_text_layer",
        lambda path, spool: ["Text"],
    )
    retry = client.post(url + "/text-extractions")

    # Assert
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "extraction_unavailable"
    assert missing.status_code == 404
    assert retry.status_code == 200, retry.text
    assert retry.json()["version"] == 1
    assert client.get(url).json() == before


@pytest.mark.parametrize("kind,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg")])
def test_image_upload_returns_original_and_safe_preview(client, kind, mime):
    # Arrange
    from PIL import Image

    stream = BytesIO()
    Image.new("RGB", (20, 10), "white").save(stream, format=kind)
    original = stream.getvalue()
    name = "invoice." + kind.lower()

    # Act
    response = upload(client, original, name, mime)
    url = "/api/v1/intake/documents/" + response.json()["documentId"]
    file_response = client.get(url + "/file")
    preview = client.get(url + "/preview")

    # Assert
    assert response.status_code == 201
    assert file_response.content == original
    assert file_response.headers["content-type"] == mime
    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/jpeg"
    with Image.open(BytesIO(preview.content)) as image:
        assert image.format == "JPEG"
        assert not image.getexif()
    assert client.get(url).json()["invoiceId"] is None


@pytest.mark.parametrize(
    "name,mime,contents,status",
    [
        ("invoice.png", "image/png", b"\x89PNG\r\n\x1a\n", 422),
        ("invoice.jpeg", "image/jpeg", b"\xff\xd8\xff", 422),
        ("invoice.png", "image/jpeg", b"data", 415),
        ("invoice.svg", "image/svg+xml", b"<svg/>", 415),
        ("invoice.png", "image/png", b"x" * (10 * 1024 * 1024 + 1), 413),
    ],
)
def test_invalid_image_upload_is_rejected_without_storage(
    client, tmp_path, name, mime, contents, status
):
    # Act
    response = upload(client, contents, name, mime)

    # Assert
    assert response.status_code == status
    assert list(tmp_path.iterdir()) == []


def test_suggestions_reruns_preserve_draft_revision_and_manual_values(client, monkeypatch):
    # Arrange
    client.app.state.settings.ai_provider = "demo"
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    manual = draft()
    manual["vendor"] = "Human correction"
    client.put(url + "/draft", json={"expectedRevision": 0, "draft": manual})
    monkeypatch.setattr(
        "invoiceflow.modules.intake.extraction_service.extract_text_layer",
        lambda path, spool: ["Vendor: Proposed vendor\nInvoice number: F-10\nCurrency: PLN"],
    )
    assert client.post(url + "/text-extractions").status_code == 200
    before = client.get(url).json()

    # Act
    first = client.post(url + "/suggestions")
    second = client.post(url + "/suggestions")
    latest = client.get(url + "/suggestions/latest")
    after = client.get(url).json()

    # Assert
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json()["version"] == 1
    assert second.json()["version"] == 2
    assert latest.json() == second.json()
    assert after == before
    assert after["revision"] == 1
    assert after["draft"]["vendor"] == "Human correction"
    vendor = next(p for p in first.json()["proposals"] if p["field"] == "vendor")
    assert vendor["value"] == "Proposed vendor"
    assert vendor["source"]["excerpt"] == "Proposed vendor"
    assert vendor["source"]["pageNumber"] == 1


def test_disabled_suggestions_leave_draft_and_previous_state_unchanged(client):
    # Arrange
    client.app.state.settings.ai_provider = "disabled"
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    before = client.get(url).json()

    # Act
    response = client.post(url + "/suggestions")
    latest = client.get(url + "/suggestions/latest")

    # Assert
    assert response.status_code == 503
    assert latest.status_code == 404
    assert client.get(url).json() == before


def test_suggestions_warn_when_declared_financial_totals_do_not_match(client, monkeypatch):
    # Arrange
    client.app.state.settings.ai_provider = "demo"
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    monkeypatch.setattr(
        "invoiceflow.modules.intake.extraction_service.extract_text_layer",
        lambda path, spool: [
            "Currency: PLN\nVAT rate: 0.23\nItem: 1 | Paper | 2 | 12.00\n"
            "Net: 24.00\nVAT: 5.52\nGross: 30.00"
        ],
    )
    assert client.post(url + "/text-extractions").status_code == 200

    # Act
    response = client.post(url + "/suggestions")

    # Assert
    assert response.status_code == 200, response.text
    assert response.json()["warnings"] == ["declaredTotals.gross does not match calculated total"]
    assert client.get(url).json()["revision"] == 0


def test_invalid_suggestion_evidence_is_rejected_without_persistence(client, monkeypatch):
    # Arrange
    from invoiceflow.modules.intake.suggestion_schemas import FieldProposal, SuggestionSource

    client.app.state.settings.ai_provider = "demo"
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["documentId"]
    monkeypatch.setattr(
        "invoiceflow.modules.intake.extraction_service.extract_text_layer",
        lambda path, spool: ["Vendor: Real vendor"],
    )
    assert client.post(url + "/text-extractions").status_code == 200
    forged = FieldProposal(
        field="vendor",
        value="Fake",
        source=SuggestionSource(
            page_number=1,
            start=0,
            end=4,
            excerpt="Fake",
            extraction_method="pdf_text",
            extraction_version=1,
        ),
        warnings=[],
    )
    monkeypatch.setattr(
        "invoiceflow.modules.intake.suggestion_service.parse_suggestions",
        lambda pages, version: [forged],
    )

    # Act
    response = client.post(url + "/suggestions")

    # Assert
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_suggestion"
    assert client.get(url + "/suggestions/latest").status_code == 404
    assert client.get(url).json()["revision"] == 0


def test_suggestion_decisions_and_draft_are_audited_atomically(client, session, monkeypatch):
    from sqlalchemy import select

    from invoiceflow.modules.intake.models import IntakeDraftAudit

    # Arrange
    client.app.state.settings.ai_provider = "demo"
    document_id = upload(client, pdf()).json()["documentId"]
    url = "/api/v1/intake/documents/" + document_id
    monkeypatch.setattr(
        "invoiceflow.modules.intake.extraction_service.extract_text_layer",
        lambda path, spool: ["Vendor: Suggested\nCurrency: PLN"],
    )
    assert client.post(url + "/text-extractions").status_code == 200
    assert client.post(url + "/suggestions").status_code == 200
    original = client.get(url).json()["draft"]
    corrected = draft()
    corrected["vendor"] = "Suggested"
    corrected["currency"] = "EUR"
    body = {
        "expectedRevision": 0,
        "draft": corrected,
        "suggestionDecisionBatches": [
            {
                "suggestionVersion": 1,
                "decisions": [
                    {"field": "vendor", "decision": "applied"},
                    {"field": "currency", "decision": "rejected"},
                ],
            }
        ],
    }

    # Act
    saved = client.put(url + "/draft", json=body)
    conflict = client.put(url + "/draft", json=body)
    records = session.scalars(
        select(IntakeDraftAudit).where(IntakeDraftAudit.document_id == document_id)
    ).all()

    # Assert
    assert saved.status_code == 200, saved.text
    assert conflict.status_code == 409
    assert len(records) == 1
    assert records[0].previous_draft["vendor"] == original["vendor"]
    assert records[0].draft["vendor"] == "Suggested"
    assert records[0].draft["currency"] == "EUR"
    assert records[0].suggestion_decisions[0]["decisions"] == [
        {"field": "vendor", "decision": "applied"},
        {"field": "currency", "decision": "rejected"},
    ]
