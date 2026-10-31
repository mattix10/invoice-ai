"""Smoke test an already running isolated worker with fictional documents."""

import json
import subprocess
import sys
import time
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject


def docker(*args, data=None):
    return subprocess.run(["docker", *args], input=data, capture_output=True, check=True).stdout


def job(container, data, kind, operation):
    name = "job-" + uuid4().hex
    directory = "/spool/" + name
    docker("exec", container, "mkdir", directory)
    try:
        writer = "import sys; open(sys.argv[1], 'wb').write(sys.stdin.buffer.read())"
        docker("exec", "-i", container, "python", "-c", writer, directory + "/input", data=data)
        request = json.dumps({"type": kind, "operation": operation}).encode()
        docker(
            "exec",
            "-i",
            container,
            "python",
            "-c",
            writer,
            directory + "/request.tmp",
            data=request,
        )
        docker("exec", container, "mv", directory + "/request.tmp", directory + "/request.json")
        deadline = time.monotonic() + 75
        while time.monotonic() < deadline:
            result = subprocess.run(
                ["docker", "exec", container, "cat", directory + "/result"], capture_output=True
            )
            if result.returncode == 0:
                return json.loads(result.stdout)
            failed = subprocess.run(
                ["docker", "exec", container, "test", "-f", directory + "/error"],
                capture_output=True,
            )
            if failed.returncode == 0:
                raise AssertionError(f"Worker rejected {kind} {operation}")
            time.sleep(0.2)
        raise AssertionError(f"Worker timed out for {kind} {operation}")
    finally:
        docker("exec", container, "rm", "-rf", directory)


def digital_pdf():
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=200)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    content = DecodedStreamObject()
    content.set_data(b"BT /F1 20 Tf 20 100 Td (Fictional invoice) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(content)
    result = BytesIO()
    writer.write(result)
    return result.getvalue()


def main(container):
    font_path = next(
        path
        for path in [
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ]
        if path.exists()
    )
    image = Image.new("RGB", (1200, 300), "white")
    ImageDraw.Draw(image).text(
        (40, 70), "FAKTURA INVOICE 12345", font=ImageFont.truetype(str(font_path), 60), fill="black"
    )
    assert "Fictional invoice" in job(container, digital_pdf(), "pdf", "text-layer")[0]
    for kind, fmt in (("png", "PNG"), ("jpeg", "JPEG"), ("pdf", "PDF")):
        data = BytesIO()
        image.save(data, format=fmt)
        result = job(container, data.getvalue(), kind, "ocr")
        assert len(result) == 1 and "12345" in result[0], (kind, result)
        print(f"{kind} OCR: {result[0].strip()}")
    print("Digital PDF and scan OCR smoke passed")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Pass the ID of an already running OCR worker container")
    main(sys.argv[1])
