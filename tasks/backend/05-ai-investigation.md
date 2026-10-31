# Task 05 — Context-aware AI Financial Copilot (revised parent task)

**Status:** specification, not implemented. **Priority:** next after verified Task 04.
**Business objective:** reduce manual navigation and communication preparation across invoice data; **do not** use LLM to recalculate discrepancies the deterministic engine already explains.

## Use cases

1. **Ask Your Invoices:** user asks plain-language questions (e.g. “Show invoices needing review” or “What is wrong with INV-2026-1042?”). Model chooses from approved read-only tools; API returns only real, available records.
2. **Investigate Discrepancy:** for a chosen invoice/reconciliation revision, model assembles a concise explanation with verified evidence links and possible next human actions; it does not decide approval.
3. **Draft Supplier Inquiry:** a **draft** that cites verified discrepancies and requests clarification, for human copy/edit only; no mail API, sending, or contact automation.

**Do not fabricate:** historical vendor analysis, document confidence percentages, PO/delivery records, decisions, accounting conclusions, or source IDs that are not present in persisted data.

## Provider decision and operational modes

- `AI_PROVIDER=demo` (default): deterministic, explicitly labelled demo; never represented as live inference.
- `AI_PROVIDER=cloudflare` (explicit local-only opt-in): Cloudflare Workers AI REST API using `@cf/meta/llama-3.3-70b-instruct-fp8-fast` as the *initial model candidate*; verify current model's function-calling, request/response and JSON support before implementation. Configuration via server-only environment variables.
- `AI_PROVIDER=disabled`: a documented unavailable state; **no silent fallback** to demo.
- No payment method/paid fallback, no inference in CI, no real customer data, no logging full prompts, no raw reasoning. Account Free limits are not guaranteed: handle 403/429/timeouts explicitly.
- This FastAPI backend currently lacks production auth: **do not allow unauthenticated remote/public live inference**. Constrain local execution to loopback + intentional opt-in; Task 09 is a production prerequisite.

## Architecture

`Angular contextual panel` → `FastAPI Copilot API` → `CopilotService` → allowlisted `ToolRegistry` → existing invoice/reconciliation services → PostgreSQL. Provider boundary translates model tool call/result into internal typed commands. LLM sees only minimal bounded tool outputs. Validation verifies source IDs and all monetary facts against deterministic service results.

- Read-only tools: `search_invoices`, `get_invoice_details`, `get_reconciliation_evidence` (only if a valid revision/result exists). The same application services later power MCP.
- Task 05a first adds the read-only latest/by-revision reconciliation service and structured `EvidenceReference` contract in `docs/architecture/api-contract.md`. `latest` may be historical/stale; an AI claim about current facts requires `is_current=true` and a final recheck. Missing/stale current evidence produces an explicit conflict, never an implicit POST reconciliation. Angular resolves validated refs to existing invoice, comparison and investigation routes; the model never supplies URLs.
- Per-turn budget: **max 3 tool calls**, **max 2 model rounds**, **max 20 rows returned per search**, and bounded answer/context lengths. Treat these as initial limits; document adjustments if empirical tests require.
- `CopilotAnswer` uses `answer`, `citations`, `suggested_questions`, `generation_mode`, `provider`, `model`, `prompt_version`, `incomplete_context`, `human_review_required`, and `unavailable_reason` as appropriate; use validated Pydantic types, not free-form arbitrary JSON.
- If there is no supporting evidence, respond with a grounded “not available” answer. Do not fill gaps from pretrained model knowledge.

## API contracts (proposals; implement in OpenAPI before wiring UI)

- `POST /api/v1/copilot/queries`: `{ question: string, invoice_id?: string }` with strict max length, optional selected context; returns `CopilotAnswer` or documented 400/404/422/429/503 errors. Should not automatically persist all user conversations; memory/history optional and bounded.
- `POST /api/v1/invoices/{invoice_id}/investigations`: `{ reconciliation_revision?: integer }`, returns evidence-backed `InvestigationResult`; if a completed reconciliation is missing, return a clear prerequisite error (e.g. 409) rather than synthesizing facts.
- `GET /api/v1/invoices/{invoice_id}/investigations/{investigation_id}` if persisting investigation results is actually justified in 05a/05b; demonstrate deterministic idempotency tied to revision + provider + prompt_version, and declare retention. Do not create a table merely because this endpoint is mentioned here.
- `POST /api/v1/invoices/{invoice_id}/supplier-inquiry-drafts`: generates `SupplierInquiryDraft` (subject/body/evidence references/`send_enabled=false`); does not send email or change invoice status. Gate by correct reconciliation facts.

## Subtasks — execute ONE per Codex session

- **05a** [`05a-copilot-contracts.md`](05a-copilot-contracts.md): schemas, grounded evidence context, deterministic demo provider and tests (no remote inference).
- **05b** [`05b-cloudflare-tool-calling.md`](05b-cloudflare-tool-calling.md): tool loop, provider adapter, quotas/security, structured outputs and unit/integration tests.
- **05c** [`05c-angular-copilot.md`](05c-angular-copilot.md): wire existing Angular Investigation to API; no shell redesign.
- **05d** [`05d-supplier-inquiry.md`](05d-supplier-inquiry.md): draft with confirmed facts, copy/edit but never send.
- **05e** [`05e-ai-evals-and-smoke.md`](05e-ai-evals-and-smoke.md): golden scenarios, cost/error telemetry and opt-in live smoke.

## Global acceptance and negative tests

- For `INV-2026-1042`, facts: invoice `12915.00` PLN, PO `12300.00` PLN, difference `615.00` gross (net `500.00`, VAT `115.00`), 10 monitors at 820 vs 770 net; recommendation is supplier confirmation, not approval.
- Data-based questions return actual persisted records, not an invented vendor history; empty results explicitly reported.
- Valid outputs cite exact invoice/reconciliation IDs; invalid citations, model-invented numbers, wrong currencies and unsupported suggestions fail validation or are replaced with deterministic facts, never silently accepted.
- Reject unknown tools, invalid arguments, attempts to modify DB, prompt injection embedded in invoice data, quota/timeouts and missing credentials safely.
- Deterministic unit tests + real PostgreSQL tests for changed persistence; mocked provider HTTP. No real model calls in GitHub Actions.
- All existing CI checks pass and source code diff is limited to this task's subscope. No automatic public deployment.

## Out of scope

OCR/upload, broad BI analytics, RAG/vector DB, arbitrary SQL, model-managed tool execution, sending emails, MCP, payment and approval APIs, Azure provisioning, new auth stubs.

## Recommended models

Sol High for 05a design, 05b safety and 05e review; Sol Medium for backend implementation; Terra for 05c frontend under existing Angular rules; Luna for low-risk mechanical fixes only. **No Astra.**
