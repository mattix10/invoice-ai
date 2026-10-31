"""Offline document worker. The deployment must isolate this process and its spool."""

import json
import re
import shutil
import subprocess
import tempfile
import time
from contextlib import suppress
from pathlib import Path

SPOOL = Path("/spool")
MAX_TEXT = 1_000_000
MAX_RESULT = 5 * 1024 * 1024
PROCESS_ENV = {
    "PATH": "/usr/local/bin:/usr/bin:/bin",
    "OMP_THREAD_LIMIT": "1",
    "TESSDATA_PREFIX": "/usr/share/tesseract-ocr/5/tessdata",
    "PYTHONPATH": "/app",
}


def run(command, deadline, output=None):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError
    subprocess.run(
        command,
        stdin=subprocess.DEVNULL,
        stdout=output if output is not None else subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=PROCESS_ENV,
        timeout=remaining,
        check=True,
    )


def process(source: Path, kind: str, operation: str, scratch: Path) -> bytes:
    deadline = time.monotonic() + 60
    if kind not in {"pdf", "jpeg", "png"} or operation not in {"preview", "ocr", "text-layer"}:
        raise ValueError
    if source.stat().st_size > 10 * 1024 * 1024:
        raise ValueError
    if operation == "preview" and kind != "pdf":
        raise ValueError
    if operation == "text-layer":
        if kind != "pdf":
            raise ValueError
        output_path = scratch / "text-layer"
        with output_path.open("wb") as output:
            run(["python", "/app/ocr_text_layer.py", str(source)], deadline, output)
        if output_path.stat().st_size > MAX_RESULT:
            raise ValueError
        return output_path.read_bytes()
    if kind in {"jpeg", "png"}:
        sanitized = scratch / "sanitized.jpg"
        with sanitized.open("wb") as output:
            run(
                [
                    "python",
                    "-m",
                    "invoiceflow.modules.intake.image_worker",
                    str(source),
                    kind.upper(),
                    "ocr",
                ],
                deadline,
                output,
            )
        if sanitized.stat().st_size > 32 * 1024 * 1024:
            raise ValueError
        source = sanitized
    pages = 1
    if kind == "pdf":
        info = scratch / "info"
        with info.open("wb") as output:
            run(["pdfinfo", str(source)], deadline, output)
        match = re.search(rb"(?m)^Pages:\s*(\d+)\s*$", info.read_bytes())
        if match is None or not 1 <= (pages := int(match.group(1))) <= 20:
            raise ValueError
    texts = []
    for page in range(1, pages + 1):
        image = source
        if kind == "pdf":
            prefix = scratch / "page"
            run(
                [
                    "pdftoppm",
                    "-f",
                    str(page),
                    "-l",
                    str(page),
                    "-singlefile",
                    "-scale-to",
                    "1600",
                    "-jpeg",
                    str(source),
                    str(prefix),
                ],
                deadline,
            )
            image = prefix.with_suffix(".jpg")
        if operation == "preview":
            if image.stat().st_size > MAX_RESULT:
                raise ValueError
            return image.read_bytes()
        text_file = scratch / "text"
        with text_file.open("wb") as output:
            run(["tesseract", str(image), "stdout", "-l", "pol+eng"], deadline, output)
        if text_file.stat().st_size > MAX_TEXT:
            raise ValueError
        texts.append(text_file.read_text(encoding="utf-8"))
        if sum(len(text.encode("utf-8")) for text in texts) > MAX_TEXT:
            raise ValueError
    result = json.dumps(texts, ensure_ascii=True).encode("ascii")
    if len(result) > MAX_RESULT:
        raise ValueError
    return result


def handle(job: Path):
    try:
        request_path = job / "request.json"
        claimed = job / "processing.json"
        request_path.rename(claimed)
        if claimed.stat().st_size > 1024:
            raise ValueError
        request = json.loads(claimed.read_text())
        with tempfile.TemporaryDirectory() as temporary:
            scratch = Path(temporary)
            source = scratch / "input"
            shutil.copyfile(job / "input", source)
            result = process(source, request["type"], request["operation"], scratch)
        output = job / "result.tmp"
        output.write_bytes(result)
        output.rename(job / "result")
    except Exception:
        with suppress(OSError):
            (job / "error").touch()


def main():
    while True:
        for job in SPOOL.glob("job-*"):
            try:
                if not job.is_dir() or job.is_symlink():
                    continue
                if time.time() - job.stat().st_mtime > 600:
                    shutil.rmtree(job)
                elif (job / "request.json").is_file():
                    handle(job)
            except OSError:
                continue
        time.sleep(0.1)


if __name__ == "__main__":
    main()
