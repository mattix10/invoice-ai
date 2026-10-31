# Task 08 — InvoiceFlow MCP Server (read-only, local-first)

**Status:** planning. **Business goal:** let external AI clients, such as Codex, query the *existing* InvoiceFlow business services without duplicating SQL or business rules. This demonstrates MCP interoperability and reduces friction for technical users, but is not a replacement for the app's UI.

**Dependencies:** verified Tasks 02/04 and the 05a reconciliation **read** service/evidence DTO. 05b–05e live provider and UI work are optional; MCP does not need model inference. Task 09 is required only before remote/public MCP, which remains out of scope here.

## Runtime and SDK

- Use **official Python MCP SDK v2** (`mcp`), with pinned compatible version verified at implementation time; do not copy v1-only `FastMCP` examples blindly. Current SDK docs: https://py.sdk.modelcontextprotocol.io/ .
- Dependency approval candidate: `mcp` v2 runtime (MIT; Python >=3.10 per [package metadata](https://pypi.org/project/mcp/)), to supply MCP transport/handshake/tool schemas that the existing FastAPI/HTTPX stack does not provide. Pure Python package, with no intended OCR/system binary; verify the selected version and transitive dependencies on Python 3.13, Windows and Docker. Pin in `pyproject.toml`/`uv.lock` only after listing exact additions for user approval. CI uses an in-memory/stdio client and no external service; limit process lifetime, stdout output and exposed env. No dependency is installed by this plan.
- Implement local **stdio** transport first; MCP client spawns a child process with restricted environment, no HTTP listener. CLI stdout must carry MCP protocol only (logs to stderr); no secrets in logs.
- No external/public Streamable HTTP transport yet; remote transport requires Task 09 auth, network security, threat model, rate limits and explicit approval.
- CLI should reuse existing FastAPI/application service functions through a thin adapter or a narrowly scoped **local** API with service credentials. Do **not** create new ORM queries and do not let the model run SQL.

## Tools (read-only)

1. `search_invoices(status?, q?, page?, page_size?)` — existing filters only, `page_size ≤ 20`, stable response, explicit currency and result-count/incomplete state.
2. `get_invoice(invoice_id)` — existing invoice detail; summary-only fields stay nullable.
3. `get_reconciliation_evidence(invoice_id, revision?)` — call the planned 05a **read** service for latest or specified completed revision, never `POST .../reconciliation`; return `ReconciliationRead` facts and validated `EvidenceReference` values. A historical revision remains readable with `is_current=false`; missing invoice/revision/result is explicit. Requests demanding current evidence reject missing/stale/unverifiable results. Read tools must not create a revision or modify financial data.
4. `get_investigation_result(invoice_id, investigation_id?)` — **read persisted result only when Task 05 supplies one**. If Task 05 did not persist, omit tool and document it; never fabricate a result or trigger billable generation from a read tool.

## Required safety policy

- No create/update/delete/approve/reject/payment, no calling suppliers, no arbitrary code/SQL, no raw invoice document contents or secrets.
- Validate tool args and output limits with Pydantic; consistent typed errors, restricted local sample data and bounded query duration.
- Local stdio is not authentication. Do not claim tenant isolation until Task 09. Document how remote auth and tenant scope would work, but do not implement anonymous public MCP.
- Do not make MCP call the LLM by default; MCP exposes data/tools, Copilot uses provider in a separate boundary. Share application services, not model prompts.

## Expected files (confirm after repo audit)

`apps/backend/src/invoiceflow/mcp_server/` small entrypoint and tools module, a few typed wrappers, `tests/unit/` MCP contract tests, `tests/integration/` tool/service integration, `docs/architecture/mcp-server.md`, local client config example (no secrets), and this task. No speculative SDK server fleet, no container deployment.

## Acceptance criteria

- Compatible MCP client discovers tools with correct JSON schemas and can invoke two real read-only tools against the seeded local dataset.
- Canonical invoice returns same `12915.00` PLN fact and reconciliation `615.00` difference as REST API; tests compare service results, not copied mock output.
- Wrong tool name, malformed id, excessive paging, unknown invoice/revision and unsupported write-tool attempts result in safe errors. A stale **completed** revision is readable with `is_current=false`; a request requiring current evidence fails explicitly.
- Local Codex/Claude client demo uses restricted env, does not expose secrets, server logs don't corrupt stdout.
- No AI inference, no paid provider calls, no insecure network listener; frontend is unchanged.
- Invalid evidence kind/ID, unsupported destination, and a receipt string masquerading as a document are rejected. Tests prove GET/MCP reads leave reconciliation count, revision and amounts unchanged, including with stale current inputs. A concurrent writer can make `is_current` obsolete after the response; MCP reports it as a point-in-time status and never promises transactional currentness across later client actions.

## Verification

Pin SDK, run MCP client integration tests (in-memory/stdio), pytest unit and real PostgreSQL integration; ensure feature works when read-only and rejects writes; Ruff/format and existing backend CI green. Test with MCP Inspector/compatible client only locally and document actual results, no fabricated success.

Run `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest tests/unit`, `uv run pytest tests/integration` against `_test` PostgreSQL, `uv run alembic upgrade head`, `uv run alembic check` and generated OpenAPI comparison. Service wrappers own bounds/validation, existing services own facts, SDK entrypoint owns protocol only. Done when discovery and two seeded read tools work, all error/currentness/no-write tests pass and local client output is protocol clean. Exact manifest remains the small server/tools/wrappers/tests/docs set above, fixed before implementation; no migration is expected. Do not add remote/public transport.

## Out of scope

Remote public MCP, OAuth implementation, multi-tenant clients, arbitrary tools/agents, payment or supplier write actions, MCP portal frontend, Azure hosting, vector DB. **Model:** Sol Medium backend; Sol High trust-boundary review. **Stop after 08.**
