"""Bounded text extraction, run only inside the isolated document worker."""

import json
import resource
import sys


def main():
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    from pypdf import PdfReader

    reader = PdfReader(sys.argv[1], strict=True)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 20:
        raise ValueError("Invalid PDF")
    pages = []
    size = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        size += len(text.encode("utf-8"))
        if size > 1_000_000:
            raise ValueError("Text limit exceeded")
        pages.append(text)
    print(json.dumps(pages, ensure_ascii=True))


if __name__ == "__main__":
    main()
