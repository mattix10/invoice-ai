---
name: fastapi-feature
description: Implement one scoped InvoiceFlow FastAPI backend capability, including persistence and API contracts. Use for backend implementation; excludes Angular changes and unassigned future tasks.
---

# FastAPI feature workflow

Read `apps/backend/AGENTS.md`, the assigned task and its architecture/API references. Consult the upstream `fastapi` skill for framework details; project choices take precedence, especially SQLAlchemy 2 rather than SQLModel and compatibility with locked dependencies.

Before editing, inspect the existing module and identify reusable dependencies, schemas and database operations. State the exact expected files and each responsibility. Keep routers focused on HTTP, services on use cases/transaction boundaries, repositories on persistence, and schemas separate from ORM models. Create only layers needed by the capability; avoid giant services and generic abstractions.

Implement one business capability within allowed paths. Preserve Decimal money, explicit currencies and timezone-aware events. Validate public input and document response/error contracts in generated OpenAPI. Do not fabricate working external integrations or authentication.

Use `backend-unit-tests` for meaningful behavior tests. Run the assigned verification commands, including real PostgreSQL tests and migration/model checks when applicable. Review the API contract and use `backend-architecture-review` on the final diff. Update project progress and report factual checks, changed files, limitations and next task. Stop at the task boundary.
