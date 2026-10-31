# 07b — OCR on scans and page-level provenance

**Prerequisite:** 07a safe intake.

**Business objective:** make the same private intake document readable when it is a digital PDF, scanned PDF, JPEG or PNG, while preserving manual confirmation and honest unreadable states. This task owns image intake; 07a remains PDF-only. No new invoice or confirmation path.

## Deliverables

- OCR adapter for scanned PDF/JPEG/PNG using Tesseract 5. For PDF pages, use a sandboxed renderer/rasterizer (e.g. Poppler or equivalent after validating packaging/license and bounded resources). pypdf alone cannot recognize scan text.
- Extend `POST /api/v1/intake/documents` and private file/metadata/preview reads for JPEG and PNG via format-specific validators within the **same** document/status/draft domain. Each image is at most 10 MiB and 20 decoded megapixels. Verify decoded JPEG/PNG type, reject truncated/invalid images and decompression bombs, normalize EXIF orientation, discard untrusted metadata from generated previews, and generate bounded safe previews outside public static paths. Original filenames are display data only. Reject SVG and remote URL imports. PDFs retain 10 MiB/20-page validation from 07a.
- Preserve extracted text with source `{document_id, page_number, extraction_method, extraction_version}`; no fabricated field confidence. If OCR engine provides confidence, label its provenance clearly and do not claim calibrated semantic correctness.
- Bounded runtime, pixel dimensions, temporary file lifetime, language packs (pol+eng only if included/tested), no automatic network requests, safe path handling.
- Security requirement: pin Tesseract to a patched release at least 5.5.4; use only trusted, pinned `pol`/`eng` traineddata mounted read-only. OCR and PDF rasterization must run in an isolated non-root execution environment with no network or secrets, narrowly scoped input/output, and CPU, memory, process, output and time limits. Fail closed with 503 when that isolation is unavailable. A subprocess timeout alone is not a sandbox.
- Container/dev instructions for Windows/VS Code with repeatable Docker installation, no unapproved paid services.

## Planned API, ownership and dependencies

Keep 07a's document IDs, states (`uploaded`, `draft`, `confirmed`, `failed`), draft PUT and confirm unchanged. A format-specific adapter validates the upload before the shared storage use case commits it. `POST /api/v1/intake/documents/{document_id}/text-extractions` explicitly starts a bounded extraction; `GET /api/v1/intake/documents/{document_id}/text-extractions/latest` reads version/status and page records `{document_id, page_number, extraction_method, extraction_version, text}`; `GET /api/v1/intake/documents/{document_id}/preview` serves a bounded private preview. No extraction operation updates financial draft fields. Errors retain `ApiError`: 415 unsupported type, 422 malformed/truncated image, 413 byte/pixel/page limit, 404 missing document/extraction, 409 wrong processing state, 503 OCR/renderer unavailable; timeouts are explicit unavailable errors. A blank page returns no invented text. Use bounded subprocess time and process isolation for rendering/OCR; preserve privacy and delete temporary rasters. Implement these schemas/operation IDs in OpenAPI before UI wiring.

Expected files: intake format adapters, page text/provenance persistence if needed, explicit migration, Docker/system package instructions, focused backend unit/PostgreSQL tests and Angular preview changes/tests. Service owns state/transaction, adapters own decode/render/OCR, repository owns persistence, UI renders safe previews/text. Exact manifest before implementation. No new draft form.

Approved additions: `Pillow` 13.0.0 for image validation and previews, Tesseract 5.5.4 or later pinned to a specific patched version, trusted pinned `eng`/`pol` language data, and Poppler for PDF rendering. Tesseract 5.5.4 fixes security advisories affecting earlier releases; Debian Trixie's 5.5.0-1 is not an acceptable substitute. Check decoder and renderer advisories and transitive libraries, and document the exact artifact versions and provenance. CI must exercise the isolated worker, not just install binaries. [Pillow metadata](https://pypi.org/project/pillow/), [Tesseract releases](https://github.com/tesseract-ocr/tesseract/releases), [Tesseract security advisories](https://github.com/tesseract-ocr/tesseract/security/advisories).

## Acceptance and tests

- Digital PDF still uses text layer; scanned PDF uses OCR; image input works. Each test fixture is fictional and included with suitable licenses.
- Blank/rotated/noisy scan may fail honestly and remain manual; unreadable values aren't invented.
- Tests include corrupted rasterization, missing Tesseract binary, language pack missing, timeouts, page limit and text size cap.
- Security tests verify the worker's effective isolation, read-only trusted language data, pinned OCR version, resource limits and failure behavior, including PDF rasterization. Do not treat mocked configuration assertions as proof of runtime isolation.
- Tests include invalid/truncated JPEG/PNG, forged extensions/MIME, decompression bomb, >20 megapixels, EXIF rotation and safe preview output; encrypted/malformed/>20-page PDFs remain rejected. Test consistent document state/errors, retries and no draft or invoice mutation. PostgreSQL tests cover provenance and restart persistence when stored.
- Existing invoice data unaffected; no automatic writes or LLM calls. Ruff, pytest, Docker, migration checks if changed. Stop after 07b.
- Verify `uv sync --locked`, Ruff check/format, unit and real `_test` PostgreSQL integration pytest, Alembic upgrade/check and migration round trip if changed, Docker OCR smoke, generated OpenAPI, plus Angular arch/lint/type/Vitest/build for changed UI. Done when digital and scanned PDF plus JPEG/PNG fixtures yield source-labelled text or explicit unavailable state, with manual 07a draft/confirm still working. No structured extraction, AI, PO linking or automatic invoice writes. Stop after 07b.

**Model:** Sol Medium, Sol High on security edge cases.
