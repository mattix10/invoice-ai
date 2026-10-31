# ADR-006: Local-first OCR with human-confirmed structured extraction

- **Status:** Proposed — approve before 07a.
- **Context:** Deterministic reconciliation accepts structured invoice/PO data, but manual transcription remains. OCR output can be inaccurate; PDF images cannot be read by plain text extraction.
- **Decision:** Safe upload into private local storage → pypdf text extraction or sandboxed renderer/Tesseract OCR → validated structured *draft* → Angular user correction → explicit confirmed persistence → real PO link → deterministic reconciliation. LLM may map text into fields optionally, but cannot serve as authority for amounts or infer missing documents.
- **Alternatives:** (a) always use paid cloud OCR rejected for initial zero-cost scope; (b) pure regex extraction too brittle alone; (c) fully autonomous OCR→approval rejected for financial correctness; (d) uploading direct to public SPA/static folders rejected for security.
- **Consequences:** More UI steps and OCR packaging, but auditable control; need page, memory, file and time limits. A new invoice without actual PO remains awaiting match, rather than being assigned fake purchase-order data.
