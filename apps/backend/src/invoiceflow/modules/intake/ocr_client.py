"""Submit a bounded job to the isolated, offline document worker."""

import json
import shutil
import tempfile
import time
from pathlib import Path

from invoiceflow.modules.intake.errors import IntakeError

MAX_RESULT_BYTES = 5 * 1024 * 1024
JOB_TIMEOUT_SECONDS = 75


def _run_job(path: Path, document_type: str, operation: str, spool: str) -> bytes:
    if document_type not in {"pdf", "jpeg", "png"}:
        raise ValueError("Unsupported document type")
    try:
        root = Path(spool)
        with tempfile.TemporaryDirectory(prefix="job-", dir=root) as directory:
            job = Path(directory)
            shutil.copyfile(path, job / "input")
            request = job / "request.tmp"
            request.write_text(json.dumps({"type": document_type, "operation": operation}))
            request.rename(job / "request.json")
            deadline = time.monotonic() + JOB_TIMEOUT_SECONDS
            while time.monotonic() < deadline:
                result = job / "result"
                if result.is_file():
                    if result.stat().st_size > MAX_RESULT_BYTES:
                        break
                    return result.read_bytes()
                if (job / "error").exists():
                    break
                time.sleep(0.1)
    except OSError:
        pass
    code = "preview_unavailable" if operation == "preview" else "extraction_unavailable"
    raise IntakeError(503, code, "Document processing unavailable")


def extract_ocr(path: Path, document_type: str, spool: str) -> list[str]:
    return _read_pages(path, document_type, "ocr", spool)


def extract_text_layer(path: Path, spool: str) -> list[str]:
    return _read_pages(path, "pdf", "text-layer", spool)


def _read_pages(path: Path, document_type: str, operation: str, spool: str) -> list[str]:
    try:
        pages = json.loads(_run_job(path, document_type, operation, spool))
        if (
            not isinstance(pages, list)
            or not 1 <= len(pages) <= 20
            or any(not isinstance(page, str) for page in pages)
            or sum(len(page.encode("utf-8")) for page in pages) > 1_000_000
        ):
            raise ValueError("Invalid result")
        return pages
    except (ValueError, UnicodeError):
        raise IntakeError(
            503, "extraction_unavailable", "Document processing unavailable"
        ) from None


def render_pdf_preview(path: Path, spool: str) -> bytes:
    result = _run_job(path, "pdf", "preview", spool)
    if not result.startswith(b"\xff\xd8\xff"):
        raise IntakeError(503, "preview_unavailable", "Document preview unavailable")
    return result
