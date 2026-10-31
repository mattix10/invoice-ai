---
name: backend-unit-tests
description: Write and review InvoiceFlow backend unit, API and PostgreSQL integration tests with pytest. Use whenever backend tests are created or changed.
---

# Backend behavior tests

Inspect `apps/backend/AGENTS.md`, pytest configuration, existing fixtures and the assigned task. Use pytest and Arrange, Act, Assert; name tests for observable behavior. Parameterize meaningful variations. Cover success, invalid input, failures and boundaries relevant to the change, especially exact financial calculations and error contracts.

Test public behavior, not private implementation. Mock external services or persistence boundaries in unit tests, never the behavior under test. Use FastAPI dependency overrides for API isolation and clear them afterward. Exercise app lifespan with TestClient when resources depend on startup.

Database integration tests use real PostgreSQL, not SQLite or mocked SQLAlchemy sessions. Require an explicitly configured disposable `_test` database. Isolate temporary schemas/tables and transactions; never reset a developer database implicitly. Exercise actual persistence, rollback and Alembic upgrade/downgrade/model consistency where relevant. Keep fixtures deterministic and clean resources even on failure.

Run affected tests, then required unit and integration suites. No silent skips, disabled assertions, arbitrary sleeps, coverage-only tests or production changes to satisfy incorrect tests. Report exact passed/failed/skipped counts and any infrastructure blocker; unexecuted tests are not passing tests.
