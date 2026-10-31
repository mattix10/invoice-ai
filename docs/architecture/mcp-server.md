# InvoiceFlow MCP architecture (Task 08)

## Purpose

MCP enables an external client such as Codex to call InvoiceFlow's **read-only business tools** without duplicating financial logic. The MCP server is *not* the same as the LLM provider; the server does not need Cloudflare credentials or generate text to return invoice data.

## Design

- Official Python MCP SDK v2, pinned after checking installed Python/runtime. Local stdio only. No HTTP listener or public URL in initial MVP.
- Tool layer delegates to existing invoice and planned 05a read-only reconciliation services, and optionally persisted investigation services; it must not create independent SQL, call POST reconciliation or bypass request authorization when auth later exists. Completed historical revisions remain readable with `is_current=false`; current-evidence requests reject missing/stale results.
- Tools: `search_invoices`, `get_invoice`, `get_reconciliation_evidence`; `get_investigation_result` only if actual persisted results exist. Tool definitions use bounded typed args and results, no write primitives.
- CLI launch and MCP examples must use an explicit project-local development environment, not share all machine secrets. Ensure stdout carries only JSON-RPC MCP messages; logs to stderr.

## Security and context

Treat local access as development only, not universal authorization; only fictional data initially. For remote Streamable HTTP, require Task 09 identity/tenant boundaries, OAuth resource server design, secure network/origin configuration, limits and explicit plan. Do not implement old SSE transport; v2 documented default stdio and production choice streamable-http.

## Example session (illustrative)

User in an MCP-enabled client: “Search invoices requiring review and show the evidence for INV-2026-1042.” Client discovers `search_invoices` and `get_reconciliation_evidence`, returns existing data and allows client-side natural-language formatting. The returned amounts must match FastAPI (`615.00 PLN` discrepancy), not MCP-specific arithmetic.

## Test strategy

MCP client integration test: list tools → call read tools with seeded local PostgreSQL; reject malformed/unknown id, too-large result, write-tool attempt; verify no network/cloud call. Document actual tool names, SDK version, local client configuration and observed results rather than claiming success without a client handshake.
