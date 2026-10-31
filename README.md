# InvoiceAI

InvoiceAI is an Angular UI prototype with a FastAPI/PostgreSQL backend foundation for invoice review. It uses fictional sample data and requires a human to make financial decisions.

## Current application

- **Overview:** a dashboard with synthetic metrics, a review queue, processing charts and invoices requiring attention.
- **Invoice workspace:** a sample invoice PDF, extracted fields represented by static data, and an invoice-to-purchase-order comparison.
- **AI investigation:** a prepared explanation, three evidence records, an illustrative application-event trail and a recommendation to request supplier confirmation.
- **Shared interface:** responsive navigation and reusable panels across the application.

The investigation is prepared demonstration content, not a live AI response. The prototype does not perform OCR, contact suppliers, approve invoices or make payments. The backend currently exposes health/readiness only; Angular still uses its existing fixtures. Invoice APIs and frontend integration are future tasks.

Backend architecture, setup, tests and safe database lifecycle commands are in [local development](docs/architecture/local-development.md). See [project progress](docs/PROGRESS.md) for actual verification results and [backend architecture](docs/architecture/backend.md) for task boundaries.

## Run locally

Install Node.js and npm, then run:

```bash
cd apps/frontend
npm ci
npm start
```

Open [http://localhost:4200](http://localhost:4200). The development server reloads when source files change.

## Verify

From `apps/frontend`, run:

```bash
npm run lint
npm run arch:test
npm run typecheck
npm test -- --watch=false
npm run build
```
