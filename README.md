# InvoiceAI

InvoiceAI is an Angular UI prototype with a FastAPI/PostgreSQL backend foundation for invoice review. It uses fictional sample data and requires a human to make financial decisions.

## Current application

- **Overview:** a dashboard with synthetic metrics, a review queue, processing charts and invoices requiring attention.
- **Invoice workspace:** a sample invoice PDF, extracted fields represented by static data, and an invoice-to-purchase-order comparison.
- **AI investigation:** a prepared explanation, three evidence records, an illustrative application-event trail and a recommendation to request supplier confirmation.
- **Shared interface:** responsive navigation and reusable panels across the application.

The application uses fictional data and does not contact suppliers, approve invoices or make payments. See [project progress](docs/PROGRESS.md) for the current implementation and verification status.

Backend architecture, setup, tests and safe database lifecycle commands are in [local development](docs/architecture/local-development.md). See [project progress](docs/PROGRESS.md) for actual verification results and [backend architecture](docs/architecture/backend.md) for task boundaries.

## MCP server demonstration

<video controls width="960" src="docs/media/mcp-inspector-demo.webm"></video>

The demonstration uses MCP Inspector and a synthetic local PostgreSQL dataset to exercise all three tools:

- **`search_invoices`** — filters invoices and returns a paginated result, including the total and an `incomplete` flag.
- **`get_invoice`** — retrieves invoice details, including line items and gross amount. The example reads `INV-2026-1042` for PLN 12,915.00.
- **`get_reconciliation_evidence`** — retrieves a previously completed reconciliation and its revision, calculated differences and evidence references. The optional `require_current` parameter rejects stale evidence.

The server runs locally over **stdio** and uses read-only database transactions. It does not run reconciliation or AI inference, and it has no network listener or authentication. Use synthetic data. For configuration and limitations, see the [MCP server documentation](docs/architecture/mcp-server.md) and [example client configuration](mcp-client.example.json).

## Run locally

Install Node.js and npm, then run:

```bash
cd apps/frontend
npm ci
npm start
```

Open [http://localhost:4200](http://localhost:4200). The development server reloads when source files change.

## Verify

For native Codex PR review setup and repository review rules, see [Code review](docs/engineering/CODE_REVIEW.md). Existing CI remains the deterministic quality gate.

From `apps/frontend`, run:

```bash
npm run lint
npm run arch:test
npm run typecheck
npm test -- --watch=false
npm run build
```
