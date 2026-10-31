from pathlib import Path

import pytest

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.ocr_client import extract_ocr, render_pdf_preview


def test_timeout_removes_spooled_input_and_reports_unavailable(tmp_path, monkeypatch):
    # Arrange
    source = tmp_path / "private.png"
    source.write_bytes(b"private document")
    spool = tmp_path / "spool"
    spool.mkdir()
    times = iter([0, 100])
    monkeypatch.setattr("invoiceflow.modules.intake.ocr_client.time.monotonic", lambda: next(times))

    # Act
    with pytest.raises(IntakeError) as caught:
        extract_ocr(source, "pdf", str(spool))

    # Assert
    assert caught.value.status == 503
    assert caught.value.code == "extraction_unavailable"
    assert "private" not in caught.value.message
    assert list(spool.iterdir()) == []


@pytest.mark.parametrize("result", [b"not json", b"[]", b"[1]", b'["' + b"x" * 1_000_001 + b'"]'])
def test_invalid_worker_response_is_unavailable(monkeypatch, result):
    # Arrange
    monkeypatch.setattr("invoiceflow.modules.intake.ocr_client._run_job", lambda *args: result)

    # Act
    with pytest.raises(IntakeError) as caught:
        extract_ocr(Path("document"), "png", "spool")

    # Assert
    assert caught.value.status == 503
    assert caught.value.code == "extraction_unavailable"


def test_invalid_preview_response_is_unavailable(monkeypatch):
    # Arrange
    monkeypatch.setattr("invoiceflow.modules.intake.ocr_client._run_job", lambda *args: b"not jpeg")

    # Act
    with pytest.raises(IntakeError) as caught:
        render_pdf_preview(Path("document"), "spool")

    # Assert
    assert caught.value.status == 503
    assert caught.value.code == "preview_unavailable"
