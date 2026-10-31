"""Validate an image and generate a metadata-free preview in a child process."""

import subprocess
import sys
from pathlib import Path

from invoiceflow.modules.intake.errors import IntakeError

MAX_PREVIEW_BYTES = 5 * 1024 * 1024


def image_preview(path: Path, expected_format: str) -> bytes:
    if expected_format not in {"JPEG", "PNG"}:
        raise ValueError("Unsupported image format")
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "invoiceflow.modules.intake.image_worker",
                str(path),
                expected_format,
                "preview",
            ],
            capture_output=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise IntakeError(
            503, "image_processing_unavailable", "Image processing unavailable"
        ) from None
    if result.returncode == 2:
        raise IntakeError(413, "document_limit_exceeded", "Image exceeds pixel limit")
    if result.returncode == 3:
        raise IntakeError(422, "invalid_document", "Invalid image document")
    if (
        result.returncode != 0
        or not result.stdout.startswith(b"\xff\xd8\xff")
        or len(result.stdout) > MAX_PREVIEW_BYTES
    ):
        raise IntakeError(503, "image_processing_unavailable", "Image processing unavailable")
    return result.stdout
