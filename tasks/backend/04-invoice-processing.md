# Backend 04 — Deterministic invoice reconciliation

## 1. Business objective

Calculate auditable invoice-to-PO discrepancies from validated structured inputs without implying OCR or AI extraction.

## 2. Technical scope

Prerequisites: 02–03 verified. Implement one synchronous reconciliation capability over stored invoice/PO snapshots, using Task 02's exact calculator. Store a reproducible result and explicit processing state. Scope is structured data already in the database; file ingestion/OCR requires a separate approved task.

## 3. Components and dependencies

Existing invoices service/repository/calculator and request sessions; focused reconciliation module only if its responsibility warrants it. No queue/broker, OCR SDK, external provider or new framework. Application-generated OpenAPI remains the contract.

## 4. Expected files

Allowed: target invoice/reconciliation module code and schemas, one migration for result/provenance only if needed, backend unit/integration tests, architecture/API/database/local docs, this task and progress. Define exact file manifest after inspecting Task 02 implementation. No frontend design change.

## 5. Architecture constraints

Keep deterministic calculation separate from orchestration/persistence. Service owns one transaction, repository owns SQL. No automatic approval/payment or arbitrary state update endpoint. Concurrency/idempotency rules must be explicit. Store inputs/revision/provenance sufficient to explain the result; do not store private model reasoning.

## 6. Acceptance criteria

- Define and encode `POST /api/v1/invoices/{invoice_id}/reconciliation` with bounded validated request (no free-form status), success DTO, 404/409/422/503 errors before implementation.
- Canonical result identifies monitors as entire net discrepancy: 10 × (820−770) = 500.00; VAT 115.00; gross 615.00, 5.0%; quantities match.
- Missing PO/invalid data yields a documented failure, never a fabricated match. No float calculations. Same unchanged inputs do not create duplicate results; changed inputs have explicit revision behavior.
- Accepted processing state transitions are independently tested; no human approval is performed. Return structured evidence/provenance, explicitly deterministic.
- Record transaction failure/rollback and concurrent repeated request behavior; update OpenAPI/database docs.

## 7. Required unit tests

Canonical/zero/no-difference/rounding/invalid data, missing PO, valid/invalid transitions, repeated reconciliation and failure handling. Mock only persistence boundaries, not calculator behavior.

## 8. Required integration tests

Real PostgreSQL successful reconciliation/provenance, idempotency/unique constraints, concurrent request behavior, atomic rollback and unknown invoice errors. Migration clean upgrade/check/downgrade/reapply if schema changes.

## 9. Verification commands

Backend locked install, Ruff lint/format, complete unit/integration suites, Alembic upgrade/check, container build and endpoint smoke on seeded local PostgreSQL; inspect generated OpenAPI. Frontend gates only if an explicitly justified frontend change is approved.

## 10. Explicitly out of scope

PDF upload/storage/OCR, LLM calls, autonomous agents, email, vendor contact, approval/payment, queues/Redis/Celery, identity/cloud/deployment. Do not begin 05.

## 11. Definition of Done

One deterministic reconciliation use case works with exact auditable results, documented API/state/idempotency, real database tests and factual progress. No claims of document extraction or AI processing.

## 12. Model recommendation

GPT-6.1 Sol Medium; Sol High for financial/concurrency review. Terra/Luna only for bounded follow-ups. No Astra/automatic switching.
