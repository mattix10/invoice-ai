# 05a — Copilot contracts, context builder and deterministic demo (no live calls)

**Depends on:** actual verified Task 04 code and passing reconciliation test.
**Goal:** build a small trustworthy interface that can be tested without LLM credentials.

## Exact reconciliation read and evidence contract

Implement the planned `GET /api/v1/invoices/{invoice_id}/reconciliations/latest` and `/{revision}` service/router contract in `docs/architecture/api-contract.md` before Copilot uses reconciliation evidence. Latest means greatest completed stored revision, even if stale. Return `ReconciliationRead` with revision, input hash, algorithm version, existing result DTO, validated `EvidenceReference[]`, and `is_current`. Extract and reuse Task 04 canonical hash calculation. No GET or Copilot tool may invoke `POST .../reconciliation`, write a revision, or change money. A missing invoice/result/revision returns the documented 404; invalid path 422; unavailable DB 503. A historical revision remains readable after inputs change, marked non-current. Missing/invalid current inputs also mean non-current. Currentness is observed at read time; recheck under the invoice lock before persisting any current-evidence claim. For an investigation requiring current facts, missing result is 409 `reconciliation_required`, stale result 409 `reconciliation_stale`, and unverifiable inputs 409 `reconciliation_unavailable`.

Register the literal `/latest` route before `/{revision}` and validate revision as a positive integer. Do not allow `latest` to be parsed as a revision or to run reconciliation as a fallback.

`EvidenceReference` has validated kind, invoice ID, optional revision/line position, stable evidence ID and label. Initial kinds are invoice, invoice line, invoice-owned PO snapshot/line, and reconciliation/discrepancy line. Resolve each ID against persisted sources; a receipt reference string alone is not a stored document. No model URL is accepted. Demo answers can use only these references. Source and error schemas in this document are planned until generated OpenAPI confirms them.

**Expected additions:** focused read-service/repository methods and router/schema additions in the existing invoices module, the Copilot module's minimal orchestration/provider/tool/context files, unit/API tests, real PostgreSQL read/no-write tests, and API/DB docs. Keep Task 04 POST payload and old rows compatible. No new dependency is required for 05a. Exact file list is confirmed before implementation.

## Before touching code

Read root/backend `AGENTS.md`, `05-ai-investigation.md`, `docs/architecture/api-contract.md`, `database.md`, `docs/product/DEMO-DATA.md`; inspect actual invoice/reconciliation modules and generated OpenAPI. Write a concise exact file manifest. Do not add a new persistence table unless a concrete stored result requires it.

## Deliverables

- Minimal `CopilotService` orchestration boundary and `InvestigationProvider` Protocol (existing module paths/conventions first; proposed `apps/backend/src/invoiceflow/modules/copilot/`).
- Pydantic v2 request/response models: bounded questions, optional real invoice id, evidence references, `CopilotAnswer`, validated factual findings, error shape, generation mode (`demo`, `live`, `disabled`) and provenance.
- Typed, allowlisted tool definitions and a context builder reading **existing** invoice/reconciliation services (not new SQL); enforce row limits and select only relevant fields.
- A deterministic `DemoInvestigationProvider` that yields **labelled** demonstration output for canonical fixture; for unrelated ids, return only actually known data or explicit unavailable state.
- OpenAPI proposals encoded in FastAPI (do not claim future endpoints implemented).
- No new frontend page, no cloud requests, no agent framework and no prompt versions scattered across components.

## Acceptance criteria / tests

- `INV-2026-1042` explanation is grounded in exact net `500.00`, VAT `115.00`, gross `615.00` PLN and monitor unit price differences; quantities match. Quote no invented confidence score.
- Invalid invoice id, missing reconciliation, malformed question, prompt-like invoice text and extra request fields have deterministic validation/error responses.
- Structured evidence IDs resolve to supplied real documents/results; no hallucinated evidence IDs.
- Missing/latest/stale/historical revision cases have exact error/currentness behavior; repeated GET and Copilot read tools leave reconciliation row count, invoice amounts and revisions unchanged. Test invalid evidence kind/line/revision and a concurrent input change; final current-evidence claims are rechecked.
- Provider mode clearly shown as `demo`; `disabled` is a distinct unavailable error (never success).
- A small local golden dataset (at least 6 questions including missing/empty context and canonical discrepancy) documents expected evidence, not exact prose.
- pytest unit and HTTP tests, including negative path; real PostgreSQL tests if modifying persistence. Existing Ruff/migrations tests and frontend checks (if touched) run.

## Required verification

From `apps/backend`: `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest tests/unit`, `uv run pytest tests/integration` against `_test` PostgreSQL, `uv run alembic upgrade head`, `uv run alembic check`, and OpenAPI smoke. Unit tests cover invalid paths/evidence, missing inputs and hash reuse; PostgreSQL tests cover historical revision access, concurrency and zero write side effects. No migrations are expected unless inspection reveals a concrete need. Report exact results, no placeholders. **Done when GETs, errors, Copilot demo grounding and all applicable gates match generated OpenAPI; stop after 05a.**

**Scope:** only focused copilot backend, tests and relevant docs. **Model:** Sol High plan; Sol Medium implementation. No Cloudflare call, frontend redesign or MCP.
