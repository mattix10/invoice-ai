# 05b — Cloudflare provider + bounded tool/function calling

**Depends on:** approved 05a schemas and tests.
**Goal:** real but *opt-in local* model inference that uses read-only application tools and produces source-checked results.

**Expected files/responsibilities:** extend the 05a Copilot provider/tool validation files and focused unit/integration tests; update server config, OpenAPI/API docs and lockfile only for an approved HTTP client addition. Router validates HTTP, service owns tool budgets and current-evidence rules, provider owns outbound HTTP, application read service owns reconciliation facts. Exact manifest is fixed before implementation. No general LLM framework. Existing `httpx` is currently dev-only: assess promoting it to runtime (BSD-3-Clause, Python >=3.8, pure Python/Windows/Docker compatible, no system binary) for bounded HTTP calls and mock transport; stdlib HTTP is the fallback if it meets timeouts/error handling. FastAPI/SQLAlchemy do not supply a Cloudflare client. Review TLS, token redaction, timeout/response limits and CI's mocked transport. List the exact approved manifest/lock additions in this implementation task before installation; repository dependency approval applies. See `docs/architecture/api-contract.md` for shared evidence DTO and [HTTPX package metadata](https://pypi.org/project/httpx/).

## Provider decision and capability verification

Use Cloudflare Workers AI REST with candidate model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. **Before code:** verify current official model docs support traditional function calling and selected JSON output behavior; verify model availability under Workers Free and correct REST payload. If unsupported or paid-only, **stop/raise blocker; do not silently substitute a different provider or paid model**. No model selection by client request.

Configuration on server: `AI_PROVIDER=demo|cloudflare|disabled`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_MODEL` (allowlisted), prompt/schema versions, bounded timeouts and budgets. Default `demo`. Secrets stored only in ignored local environment; not in Git/frontend/CI.

## Tool contracts

- `search_invoices`: validated filters limited to *currently supported actual API*, page 1–N, page size ≤20, status and bounded text; never invent date filtering not implemented.
- `get_invoice_details`: a single existing ID; preserve known missing fields and decimal-string money.
- `get_reconciliation_evidence`: completed reconciliation for a valid invoice/revision; return source IDs, currency, authoritative totals/deltas and relevant line differences.

The evidence tool calls the 05a read service, never POST reconciliation. Default to latest completed revision but require `is_current=true` for current financial claims; specified historical revisions may be displayed only as historical. Missing current result/invalid current inputs/stale fingerprint become `reconciliation_required`/`reconciliation_unavailable`/`reconciliation_stale` conflicts, not a generated answer. Validate structured evidence IDs against persisted records; reject invalid or unsupported destination IDs. Recheck the fingerprint just before returning current evidence; a race with input writes must return conflict or explicitly non-current evidence. No tool may change row counts or financial data.

All tools are **read-only wrappers over existing services**, not SQL exposed to model. No payment, approval, status modification, email dispatch, file access or arbitrary code execution. Unknown tool, invalid args or an unexpected next round → hard fail. Model controls only selection, not execution permissions. Per turn: max 3 tool calls, max 2 LLM rounds, strict response token budget and context truncation *with visible incomplete-coverage flag*.

## Validation / provenance

Use Pydantic schema output when provider supports it, then independently validate: allowed references, cited facts and currency/amounts against deterministic backend. Do not let model-generated arithmetic become authoritative. Document text is untrusted data; system instructions and tool policy must not be editable by document contents. No private reasoning or raw sensitive payload in logs. Provider response/status uses safe typed errors: invalid JSON/schema, unsupported claims, timeout, quota (`429`), authentication (`401/403`), upstream error and missing configuration. No silent fallback `cloudflare→demo`.

## Cache and concurrency

A persisted *investigation of a specific reconciliation revision* may be cached by `(invoice_id, revision, evidence fingerprint, provider, model, prompt version)` with an immutable result; conversational questions generally are **not** cached as equivalent. Implement in-flight deduplication only if demonstrably necessary; do not hold SQL transactions during HTTP inference. Check input revision still valid before saving. No speculative queue/broker.

## Tests and acceptance

- Mock Cloudflare HTTP at transport boundary, including tool invocation, correct tool selection, unknown tool, malformed args, invalid JSON, missing citations, fabricated money, 429/403/timeouts, wrong model capability and prompt injection in invoice text.
- Test missing/stale/historical reconciliation revisions, forged evidence references, model-generated URLs, concurrent input changes and zero write side effects from all read tools. PostgreSQL integration verifies currentness after a PO/invoice input change and no new reconciliation revision; no live inference in tests.
- Actual API responses never show unsupported “AI certainty” or false evidence; no external calls on tests/startup.
- Integration tests use actual PostgreSQL for any saved result, revision/caching/idempotency/rollback; no provider calls in CI.
- No public unauthenticated live inference until Task 09 security is implemented. Local live smoke is **not** part of this subtask (05e).
- Existing Ruff/pytest/real PostgreSQL/CI and OpenAPI pass. Review diff; stop after 05b.
- Verify with `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest tests/unit`, `uv run pytest tests/integration` on `_test` PostgreSQL, `uv run alembic upgrade head`, `uv run alembic check`, and actual OpenAPI. Done when bounded Cloudflare calls and all errors/evidence checks pass without paid calls or fallback. Out of scope: reconciliation writes from tools, public inference, email and general agent frameworks.

**Model:** Sol High for trust boundary; Sol Medium for implementation. **Files:** existing chosen module and tests, config, docs; exact list after inspection; no broad refactor.
