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
    settings = database_settings.model_copy(update={"intake_storage_dir": str(tmp_path)})
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
        "supplier_invoice_number": "F-10",
        "issued": None,
        "due": "2026-12-20",
        "currency": "PLN",
        "vat_rate": "0.23",
        "items": [{"position": 1, "name": "Service", "quantity": 2, "unit_net": "10.00"}],
        "declared_totals": None,
    }


def test_upload_save_confirm_and_reopen(client):
    # Arrange
    contents = pdf()
    data = draft()

    # Act
    response = upload(client, contents, "../../invoice.pdf")
    doc = response.json()
    url = "/api/v1/intake/documents/" + doc["document_id"]
    saved = client.put(url + "/draft", json={"expected_revision": 0, "draft": data})
    fetched = client.get(url)
    confirmation = client.post(url + "/confirm", json={"expected_revision": 1})
    repeated = client.post(url + "/confirm", json={"expected_revision": 1})
    invoice = client.get("/api/v1/invoices/" + confirmation.json()["invoice_id"])

    # Assert
    assert response.status_code == 201
    assert doc["original_name"] == "invoice.pdf"
    assert client.get(url + "/file").content == contents
    assert saved.json()["validation"]["complete"] is True
    assert fetched.json()["draft"] == data
    assert fetched.json()["revision"] == 1
    assert confirmation.status_code == 200
    assert repeated.json() == confirmation.json()
    assert invoice.json()["status"] == "needs_review"
    assert invoice.json()["purchase_order"] is None
    assert invoice.json()["totals"]["gross"] == "24.60"


def test_stale_revision_is_rejected(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["document_id"]
    body = {"expected_revision": 0, "draft": draft()}
    client.put(url + "/draft", json=body)

    # Act
    response = client.put(url + "/draft", json=body)

    # Assert
    assert response.status_code == 409
    assert response.json()["error"]["current_revision"] == 1
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
    assert response.json()["error"]["existing_document_id"] == first["document_id"]
    assert (
        client.get("/api/v1/intake/documents/" + first["document_id"] + "/file").content == contents
    )


def test_declared_totals_mismatch_cannot_create_invoice(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["document_id"]
    data = draft()
    data["declared_totals"] = {"net": "1.00", "vat": None, "gross": None}
    client.put(url + "/draft", json={"expected_revision": 0, "draft": data})

    # Act
    response = client.post(url + "/confirm", json={"expected_revision": 1})

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
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["document_id"]
    data = draft()
    data["vendor"] = None

    # Act
    saved = client.put(url + "/draft", json={"expected_revision": 0, "draft": data})
    confirmed = client.post(url + "/confirm", json={"expected_revision": 1})

    # Assert
    assert saved.status_code == 200
    assert saved.json()["validation"] == {"complete": False, "errors": ["vendor"]}
    assert confirmed.status_code == 422
    assert client.get(url).json()["draft"]["vendor"] is None


def test_draft_missing_key_is_rejected(client):
    # Arrange
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["document_id"]
    data = draft()
    del data["vendor"]

    # Act
    response = client.put(url + "/draft", json={"expected_revision": 0, "draft": data})

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
    url = "/api/v1/intake/documents/" + upload(client, pdf()).json()["document_id"]
    data = draft()
    data.update(currency="", vat_rate="", due="")
    data["items"][0]["unit_net"] = ""

    # Act
    response = client.put(url + "/draft", json={"expected_revision": 0, "draft": data})

    # Assert
    assert response.status_code == 200
    assert response.json()["draft"]["currency"] is None
    assert response.json()["draft"]["items"][0]["unit_net"] is None
    assert response.json()["validation"]["complete"] is False


def test_duplicate_can_be_explicitly_uploaded_as_separate_document(client):
    # Arrange
    contents = pdf()
    original = upload(client, contents).json()

    # Act
    response = client.post(
        "/api/v1/intake/documents",
        files={"file": ("invoice.pdf", contents, "application/pdf")},
        data={"allow_duplicate": "true"},
    )

    # Assert
    assert response.status_code == 201
    assert response.json()["document_id"] != original["document_id"]
    assert (
        client.get("/api/v1/intake/documents/" + original["document_id"] + "/file").content
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
