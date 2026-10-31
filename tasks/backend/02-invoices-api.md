# Backend 02 — Read-only invoices API

## 1. Business objective

Expose the real invoice/PO demo data through a persisted API usable by the existing review queue and workspace.

## 2. Technical scope

Prerequisite: Task 01 verified. Implement only list, detail and comparison reads specified by `docs/architecture/api-contract.md`, plus minimal domain schema, deterministic calculations and explicit idempotent local seeding. Do not add write/status endpoints.

## 3. Components and dependencies

Reuse settings, request sessions, Base and Alembic. Add one invoices module: HTTP router, API schemas, SQLAlchemy models, use-case service, concrete repository, financial calculator and explicit seed entrypoint. Use existing dependencies.

## 4. Expected files

Allowed: `apps/backend/src/invoiceflow/modules/invoices/{router.py,schemas.py,models.py,service.py,repository.py,calculations.py,seed.py}`; `main.py` only to include router; `alembic/env.py` to register models; one reviewed migration; focused unit/integration test files; contract/database docs for implementation clarification, this task and `docs/PROGRESS.md`. Explain any necessary file addition before editing. No frontend source changes.

## 5. Architecture constraints

HTTP → use case → repository; API DTOs distinct from models; explicit transaction ownership. NUMERIC/Decimal and the documented rounding policy. No generic repository, speculative tenant/vendor subsystem or fake complete data for summary-only rows. Encode only actual demo facts. OpenAPI is implemented contract source of truth. Test fixture seeding is explicit and guarded for local use; no startup/production seed.

## 6. Acceptance criteria

- Implement all three GET operations and DTOs, status enum, documented errors, nullable summary-only data and stable operation IDs.
- Enforce page/page_size, allowed sort fields/tie-breaker, literal case-insensitive search, status and inclusive due-date bounds; reject invalid/unknown parameters with 422. Empty/out-of-range results have accurate filtered total.
- Persist four real demo summaries; canonical invoice has three items, complete amounts and matching PO snapshot. Other rows do not gain invented issue dates/items/PO data. Unknown detail/comparison returns documented 404.
- Canonical totals and exact 615.00 gross / 5.0% comparison match frontend; zero PO gross yields null percentage; reject invalid quantity/price/precision/currency combinations.
- Seed command runs only explicitly in local mode and is repeatable without duplicates or silent overwrite of edits; reject production execution. Document the actual safety guard and command.
- One reviewed migration enforces FKs, uniqueness, numeric and status constraints; generated OpenAPI describes success/error/query schemas.

## 7. Required unit tests

Calculator canonical amounts, half-cent rounding, zero baseline, invalid values and boundary precision. Service missing invoice/comparison, summary-only detail and mapping without presentation formatting. API validation/error schemas and OpenAPI fields.

## 8. Required integration tests

Real PostgreSQL migrated schema, FK/uniqueness/check constraints, exact money round-trip, all filters combined, literal `%`/`_` search, stable tie sorting, pagination totals/empty pages, detail/comparison 404, seed twice/no overwrite and production guard. Migration clean upgrade/check/downgrade/reapply; API requests using real repository/session.

## 9. Verification commands

Run `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest tests/unit`, configured `uv run alembic upgrade head`, `uv run alembic check`, configured `uv run pytest tests/integration`, `uv run python -m invoiceflow.modules.invoices.seed` twice against an isolated local database and check row counts. Run full backend suite, container build and health/readiness smoke. Verify actual `/openapi.json`; no hand-edited schema as evidence.

## 10. Explicitly out of scope

Angular integration, upload/OCR/processing, investigation/AI, authentication, write/status/approval/payment endpoints, Azure, cloud calls or deployment. Do not start 03.

## 11. Definition of Done

All acceptance tests pass on real PostgreSQL; documented API matches generated OpenAPI; reviewed migration/models/calculations and final diff; progress records actual commands/results. Stop after this task.

## 12. Model recommendation

GPT-6.1 Sol Medium; Sol High for financial rule review or difficult debugging. Terra for small isolated follow-ups, Luna for mechanical changes. No Astra/automatic switching.
