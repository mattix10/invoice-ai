# Backend architecture

## Decision and scope

InvoiceFlow is a modular monolith: Angular remains in `apps/frontend`; FastAPI lives in `apps/backend`. Tasks 01–04 now provide health, invoice reads, Angular integration and deterministic reconciliation. AI investigation, document intake, MCP, authentication and Azure remain separate planned tasks. See [the audit](../../tasks/backend/00-repository-audit.md) and [progress](../PROGRESS.md).

Use Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0, psycopg 3, PostgreSQL 17, Alembic, pytest, Ruff and uv. Python 3.13 has Windows wheels for the selected dependencies; `uv.lock` resolves exact versions. SQLAlchemy 2.0 is explicitly retained rather than adopting the upstream skill's SQLModel preference. Runtime dependencies implement the required HTTP, configuration, SQL, driver, migration and server capabilities. Test dependencies are pytest and HTTPX; Ruff supplies lint/format checks. No type checker is introduced for this small typed foundation; add one only with a concrete need and consistent CI configuration.

## Responsibilities

- `main.py`: application factory and lifespan. Each app owns its engine/session factory. Importing the module does not connect to PostgreSQL. Startup does not create tables or run migrations.
- `core/config.py`: validated environment settings, PostgreSQL-only URL, secret-safe representation. Configuration is loaded at startup, not cached globally.
- `core/database.py`: SQLAlchemy metadata, engine creation, request session lifecycle and infrastructure readiness query. Sessions close/rollback on request completion; future business services explicitly own commits/transactions.
- `health.py`: small HTTP-only infrastructure router and Pydantic health response. A health business service/repository would add no useful responsibility.
- `modules/invoices/`: router for HTTP and schemas, service for use cases and transactions, repository for concrete SQL, models for persistence. No generic repository, speculative facade or empty module scaffolds. Planned reconciliation reads belong to this service boundary; PO linking in 07d extends it without changing historical results.

The synchronous psycopg stack uses synchronous routes/dependencies, which FastAPI runs in its threadpool. The async lifespan owns only resource setup/cleanup. Connections use pre-ping, bounded connect/pool timeouts and hidden bound parameters. There is no mutable global engine/session.

## Contracts and errors

Application-generated `/openapi.json` is the implemented API source of truth. The [API contract](api-contract.md) marks existing health/invoice/reconciliation routes and future 05–08 contracts separately. Task 03 generates TypeScript types from that schema instead of maintaining a second handwritten wire contract. UI view models remain separate adapters.

Liveness does not depend on PostgreSQL. Readiness executes `SELECT 1`; unavailable PostgreSQL yields a generic 503 without driver messages, SQL, credentials or stack traces. No invoice error middleware is created before invoice endpoints exist.

## Persistence and financial rules

See [database.md](database.md). The initial Alembic baseline intentionally has no domain tables; its only persistent artifact is Alembic's version table. There is no justified Task 01 business entity. This establishes migration history and validates clean-schema upgrade/downgrade/check behavior without implementing Task 02.

Current calculations use Decimal and NUMERIC, explicit ISO currency and ISO dates; future event timestamps are aware UTC. Task 02 implemented the separately tested rounding policy (line net first; invoice net is sum of rounded line nets; VAT is rounded on invoice net; ROUND_HALF_UP to two decimal places). Task 04 stores deterministic reconciliation revisions. No binary float for financial computation, no formatting in services and no generated financial decisions.

## Security and extension points

The current application has no authentication. Compose exposes development services on loopback. Do not expose this application publicly until Task 09 identity/tenant authorization exists; no placeholder identity should be mistaken for protection.

Future authentication belongs in explicit router dependencies, with tenant-scoped repository queries and authorization tests. File storage/processing adapters belong behind application use cases; introduce a queue only after durable asynchronous work is needed. Deterministic reconciliation remains separate from any AI provider. AI outputs must cite persisted evidence and remain labelled, auditable recommendations requiring human decisions. Azure configuration, managed identity/secrets and deployment are future work; no cloud resources or paid calls are part of this foundation.

## Quality and upstream instructions

CI runs frontend architecture, lint, type checks, Vitest and production build; backend locked sync, Ruff, unit/API tests, migrations, metadata consistency, real PostgreSQL integration tests and image build. No visual snapshots or paid services. See [local development](local-development.md) and [GitHub protection](github-quality-gates.md).

The vendor FastAPI skill and its references are copied unchanged from `fastapi/fastapi`, commit `45cb2252c737906f37544f5ba6bee0295fb81468`, path `fastapi/.agents/skills/fastapi`. Project skills and `apps/backend/AGENTS.md` specify stricter architecture and selected dependencies. Update vendor files deliberately rather than following moving `master` automatically.

The root `.prettierignore` excludes only that vendor directory; the staged-format hook honors both root and frontend ignore files. Project-owned files retain formatting checks. The original upstream license is included.

Primary references: [FastAPI application structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/), [SQLAlchemy session ownership](https://docs.sqlalchemy.org/en/20/orm/session_basics.html), [Alembic reviewed autogeneration](https://alembic.sqlalchemy.org/en/latest/autogenerate.html), [uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/).
