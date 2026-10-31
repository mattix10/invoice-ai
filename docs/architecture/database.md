# Database design

## Foundation

PostgreSQL 17, synchronous psycopg 3 and SQLAlchemy 2.0. `Base.metadata` defines stable constraint naming. Alembic gets the same metadata and runtime URL through validated environment configuration. Baseline revision `0001_foundation` establishes version history only: there is no justified persistent business entity in the foundation. Alembic owns `alembic_version`; no health table or fake invoice tables are created.

Migrations are explicit commands, never startup side effects or `metadata.create_all()`. Review every generated revision, run it against a clean database/schema, test downgrade/reapply and run `alembic check` to detect model drift. Invoice models are registered in Alembic metadata.

Application engine resources belong to app lifespan. One session per request, closed in a dependency; use cases own transaction commits. Connection pre-ping and timeouts bound readiness failures. Close sessions to roll back uncommitted writes. Integration tests use a real explicitly configured `_test` database and random per-test schemas. Cleanup drops only each fixture's own schema, never a development database.

## Implemented in Task 02

- `invoices`: public invoice ID primary key (bounded 64), fictional vendor name, nullable issue date, due date, currency, checked status code, gross amount NUMERIC(18,2). Nullable VAT rate/net/VAT represent summary-only dashboard rows without fabricated extraction data. Complete canonical records must have consistent totals and positive line quantities.
- `invoice_items`: invoice FK, positive ordered position with unique `(invoice_id, position)`, description, quantity integer, unit net NUMERIC(18,2). Stored line net, if used, must match the deterministic calculator; avoid maintaining redundant values without a constraint/use case.
- `invoice_po_snapshots`: at most one matched PO snapshot per invoice, invoice FK unique/primary key, PO reference, nullable delivery receipt reference, explicit currency/VAT rate. This is an invoice-specific comparison snapshot, not a speculative reusable purchasing subsystem.
- `invoice_po_items`: snapshot FK plus matching invoice line position, quantity and PO unit net NUMERIC(18,2). Enforce matching relationships and reject inconsistent currencies. Task 02 validates matching quantities for the canonical demo; general reconciliation is later work.

Vendor remains a display string until a vendor-management use case exists. Do not introduce tenant/user/master-data tables before real identity and tenancy requirements. For the four visible summaries use only actually known fields; canonical INV-2026-1042 has three items and PO-2026-0871 / DR-2026-1042. Derived totals/comparison should be calculated by one independently tested financial module, not duplicated in repository and router.

Currency is explicit ISO code, money uses Decimal with two-place NUMERIC storage. Reject negative prices, nonpositive quantity and unsupported precision rather than silently truncating. ROUND_HALF_UP: line net first, sum for invoice net, then VAT on net and gross as net + VAT. UTC-aware timestamps use TIMESTAMPTZ when events are introduced; issue/due use DATE. Index due/status only when corresponding query patterns justify them. Sorting always has a stable ID tie-breaker.

## Development data and safety

Compose's `postgres-data` volume persists development data. `docker compose down` preserves it. The `postgres-test` profile has a separate ephemeral tmpfs database on port 5433. CI uses its own disposable PostgreSQL service. Never point integration tests at production/development databases or silently substitute SQLite.

The seed is explicit and uses one transaction with PostgreSQL conflict-safe inserts keyed by stable IDs. Existing invoices and their children are preserved. It requires `INVOICEFLOW_ENV=local` and a loopback database host (`localhost`, `127.0.0.1`, or `::1`); all other environments and hosts are rejected. Migrate the intended local database first, then run from `apps/backend`:

```powershell
$env:INVOICEFLOW_ENV = 'local'
uv run python -m invoiceflow.modules.invoices.seed
```

There is no startup or production seeding. See [local development](local-development.md) for safe database lifecycle commands.

## Reconciliation results

`invoice_reconciliations` stores the algorithm version, canonical input snapshot, SHA-256 input hash and calculated evidence in JSON, with an invoice foreign key, positive revision and a unique invoice/hash pair. Revisions are allocated while holding the invoice row lock. The processing-to-completed transition is atomic; failures leave no result. Future writers must acquire that same lock before changing invoice or PO inputs. Historical results remain available after inputs change.
