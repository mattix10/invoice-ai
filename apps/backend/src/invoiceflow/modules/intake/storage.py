import contextlib
import hashlib
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from uuid import uuid4

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.image_format import image_preview

LIMIT = 10 * 1024 * 1024


def store(stream, directory: str, document_type: str = "pdf"):
    root = Path(directory)
    temporary = None
    final = None
    try:
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        with tempfile.NamedTemporaryFile(dir=root, delete=False) as output:
            temporary = Path(output.name)
            digest = hashlib.sha256()
            size = 0
            while chunk := stream.read(65536):
                size += len(chunk)
                if size > LIMIT:
                    raise IntakeError(413, "document_limit_exceeded", "Document exceeds size limit")
                digest.update(chunk)
                output.write(chunk)
        if size == 0:
            raise IntakeError(422, "invalid_document", "Invalid document")
        if document_type in {"jpeg", "png"}:
            image_preview(temporary, document_type.upper())
            final = root / (uuid4().hex + "." + document_type)
            os.replace(temporary, final)
            temporary = None
            return final, size, digest.hexdigest()
        with temporary.open("rb") as source:
            if source.read(5) != b"%PDF-":
                raise IntakeError(422, "invalid_document", "Invalid PDF document")
        try:
            result = subprocess.run(
                [sys.executable, "-m", "invoiceflow.modules.intake.pdf_check", str(temporary)],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise IntakeError(
                422, "invalid_document", "PDF validation exceeded resource limits"
            ) from None
        code = result.stdout.strip()
        if result.returncode or code not in {"ok", "encrypted_document", "document_limit_exceeded"}:
            raise IntakeError(422, "invalid_document", "Invalid PDF document")
        if code != "ok":
            status = 413 if code == "document_limit_exceeded" else 422
            raise IntakeError(status, code, "PDF cannot be accepted")
        final = root / (uuid4().hex + ".pdf")
        os.replace(temporary, final)
        temporary = None
        return final, size, digest.hexdigest()
    except OSError:
        raise IntakeError(503, "storage_unavailable", "Document storage unavailable") from None
    finally:
        if temporary is not None:
            with contextlib.suppress(OSError):
                temporary.unlink(missing_ok=True)
