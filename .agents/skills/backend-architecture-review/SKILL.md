---
name: backend-architecture-review
description: Review an InvoiceFlow backend task diff for architecture, API and persistence boundaries, security, and task scope. Use before completing a backend task or when explicitly reviewing backend architecture.
---

# Backend architecture review

Read the assigned task and relevant decisions in `docs/architecture/`, then inspect `git diff` and all newly created files (including untracked files). Check:

- Router HTTP contracts and validation; business use cases outside routers; SQL confined to concrete persistence/infrastructure code.
- Separate external schemas and ORM models; explicit injection and transaction/resource ownership; no circular dependencies or shared sessions.
- Exact monetary types, currency/date conventions, database constraints and reviewed migrations where relevant.
- Duplicated logic, oversized routers/services, generic abstractions and unnecessary files/dependencies.
- Safe error responses, environment secrets, test database isolation and no misleading authentication/AI claims.
- Consistency between task, implemented OpenAPI, docs and real frontend needs; no future-task implementation.
- Meaningful unit/API/real PostgreSQL tests and factual execution of required quality gates.

Fix problems inside scope, record justified deviations and unresolved blockers, and review the final diff again. Never weaken a gate to obtain success.
