# Task 07 — Invoice Document Intake + OCR + deterministic reconciliation

**Status:** plan; do not infer that these features already exist. **Purpose:** turn an unfamiliar uploaded invoice into an auditable, validated invoice record, then optionally reconcile it with a *real* stored purchase order. **Execution:** one child task per Codex session.

## Business flows — do not conflate them

**A. Review existing invoice:** Overview → **Review next invoice** → select actual `needs_review` invoice from persisted API (bounded, deterministic sort) → existing `/invoices/:id` Invoice Workspace → optional investigation. Never route this CTA to upload, never hardcode the golden ID as the next invoice. Empty review queue has explicit empty state; network failure is not an empty queue.

**B. Add new invoice:** Overview → **Upload invoice** → `/invoices/new` → choose PDF and upload → real persisted *intake document* and server-generated ID → editable draft/preview → save draft → human confirms complete/correct fields → persist a **new invoice** → `/invoices/:id`. If a real PO is not linked, show **Awaiting PO** / “Comparison unavailable”; never invent a PO, show wrong sample PDF, or imply a successful reconciliation. Once linking is available, run the existing deterministic comparison and use AI Copilot only for optional evidence-backed explanation/drafts.

## Milestones and exact deliverables

| Task | Shipping result | Do NOT imply |
|---|---|---|
| [07a — upload/manual-confirm](07a-upload-and-manual-confirm.md) | **Working upload button, private stored PDF, persistent editable draft, manual confirmation producing an actual invoice; dynamic Review next invoice** | No OCR, AI extraction, PO matching or automatic payment |
| [07b — OCR/text](07b-ocr-and-document-provenance.md) | Extend the same intake domain to JPEG/PNG, extract digital PDF text and local OCR on scans/images with page/source metadata | Not structured/verified financial values |
| [07c — structured extraction](07c-structured-extraction-review.md) | AI/local parser proposes typed fields separately; user selectively applies them in **the existing 07a** draft form through revision-protected PUT | Never auto-confirm, overwrite human edits or duplicate a form |
| [07d — PO/reconciliation](07d-confirmation-po-linking-reconciliation.md) | Independent stored PO and explicit line mapping/link, immutable snapshot version, deterministic reconciliation and honest missing-PO state | No invoice approval, paid inference, generic ERP |

### Critical sequencing note

07a includes **manual confirmation and invoice persistence**. It must be independently demonstrable without OCR and without an existing PO. 07d **does not reimplement confirmation**; it extends the existing confirmed invoice workflow with genuine PO linking and reconciles only once source data exist. Any older task plan that assigned all confirmation to 07d is superseded by this document.

## Existing architecture / source of truth

Read actual code before edits. Existing FastAPI uses SQLAlchemy 2, Pydantic v2, PostgreSQL, Alembic, `InvoiceService`, `InvoiceRepository`, deterministic `ReconciliationService`; Angular uses feature folders, signal inputs and typed API client generated from FastAPI OpenAPI. Keep `AppShell`/`Sidebar`/`Topbar` unchanged. Current canonical `INV-2026-1042`: gross invoice `12915.00` PLN, gross PO `12300.00` PLN, discrepancy `615.00` gross (`500.00` net, `115.00` VAT). Other demo invoices may be summary-only. Do not attach golden sample PDF or PO to newly uploaded invoice IDs.

## Proposed state model (approve during 07a implementation)

Document intake: `uploaded` → `draft` → `confirmed`; `failed` for rejected processing; same document ID persists across refresh. An `uploaded` file is not a confirmed invoice. The invoice's existing `needs_review` status remains separate from intake status. An additional `awaiting_po` state should be a **comparison/link status**, not a new invoice lifecycle enum without contract review.

## Cross-cutting constraints

- Local dev only before Task 09 authentication and authorization. Do not expose unauthenticated file upload, read or LLM endpoints to the public Internet.
- 07a accepts PDF only: maximum 10 MiB and 20 pages, with bounded structure/encryption validation. 07b alone adds JPEG/PNG, each maximum 10 MiB and 20 decoded megapixels, with safe preview/OCR. Reject fake MIME/extensions, malformed/encrypted and over-limit documents, avoid path traversal/unsafe temp paths, bound CPU/memory/processing time, store outside SPA webroot. No claim that MIME + PDF magic provides full malware detection.
- 07a full-draft `PUT` with `expected_revision` remains the sole draft write contract through 07c. Extraction suggestions are separate and never overwrite human-edited values. 07d adds independent POs while preserving legacy invoice-owned snapshots and reconciliation history; see `docs/architecture/database.md` and ADR-009.
- Use SHA-256 plus confirmed business identifier `(vendor, supplier_invoice_number)` for **duplicate warnings and guarded conflict policy**. A repeated request must not create duplicate invoices. Never silently drop or overwrite a legitimate document only because its hash matches another.
- `Decimal` for money and existing rounding policy, not client totals or LLM arithmetic. `Pydantic` input validation, errors with stable API codes and meaningful HTTP statuses. Preserve session/transaction ownership and migrations.
- No automatic supplier communication, approval/payment or unsupported confidence numbers. Do not store personal financial documents in public GitHub; fixtures fictional. No paid AI calls in CI; Cloudflare only with local opt-in and synthetic data.

## Quality gates / acceptance

Each task requires root/nested `AGENTS.md`, its exact-file manifest before edits, unit tests including failures, real PostgreSQL integration for persistence/migrations, Angular Vitest for changed components, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest tests/unit`, `uv run pytest tests/integration` against `_test` DB, `uv run alembic upgrade head`, `uv run alembic check`, existing Angular architecture/lint/typecheck/test/build, Docker smoke where relevant. No Playwright visual regression. Verify behavior manually with a new fictional PDF. Do not invent successes or silently weaken checks. Keep task-scope changes only. No git push/merge/deploy without request.

## Model usage

Sol Medium for routine backend and DTO implementation; Sol High for financial transactions, upload security and trust-boundary review; Terra for Angular components from approved design; Luna for safe mechanical fixes. No Astra or model-switching assumption.
