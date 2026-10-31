from io import BytesIO
from subprocess import TimeoutExpired

import pytest

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.storage import store


def test_parser_timeout_removes_temporary_file(tmp_path, monkeypatch):
    # Arrange
    def timeout(*args, **kwargs):
        raise TimeoutExpired(cmd="parser", timeout=8)

    monkeypatch.setattr("invoiceflow.modules.intake.storage.subprocess.run", timeout)

    # Act
    with pytest.raises(IntakeError) as caught:
        store(BytesIO(b"%PDF-fake"), str(tmp_path))

    # Assert
    assert caught.value.code == "invalid_document"
    assert list(tmp_path.iterdir()) == []


def test_storage_failure_returns_sanitized_error(tmp_path):
    # Arrange
    parent = tmp_path / "not-a-directory"
    parent.write_text("x")

    # Act
    with pytest.raises(IntakeError) as caught:
        store(BytesIO(b"%PDF-fake"), str(parent / "documents"))

    # Assert
    assert caught.value.status == 503
    assert caught.value.code == "storage_unavailable"
    assert str(tmp_path) not in caught.value.message


def test_oversized_multipart_closes_spooled_files(monkeypatch):
    # Arrange
    import asyncio
    import tempfile

    from starlette.datastructures import Headers
    from starlette.formparsers import MultiPartParser

    from invoiceflow.modules.intake.request_limit import BodyLimitExceeded

    files = []

    def temporary_file(*args, **kwargs):
        file = tempfile.SpooledTemporaryFile(*args, **kwargs)  # noqa: SIM115
        files.append(file)
        return file

    monkeypatch.setattr("starlette.formparsers.SpooledTemporaryFile", temporary_file)

    async def body():
        yield (
            b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="x.pdf"\r\n'
            b"Content-Type: application/pdf\r\n\r\n%PDF-"
        )
        raise BodyLimitExceeded

    async def parse():
        parser = MultiPartParser(
            Headers({"content-type": "multipart/form-data; boundary=boundary"}), body()
        )
        await parser.parse()

    # Act
    with pytest.raises(BodyLimitExceeded):
        asyncio.run(parse())

    # Assert
    assert len(files) == 1
    assert files[0].closed
