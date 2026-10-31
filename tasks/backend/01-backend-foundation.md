# Backend 01 — Backend foundation

Status: complete and locally verified. See `docs/PROGRESS.md` for exact commands/results and the changed-file manifest. Remote CI execution and branch protection remain unverified, without any push/deployment.

## 1. Business objective

Provide a reproducible local/CI backend foundation that serves health checks and connects to real PostgreSQL without prematurely implementing invoice features.

## 2. Technical scope

Implement Task 01 only, after audit 00. FastAPI factory/lifespan, validated settings, sync SQLAlchemy/psycopg, explicit Alembic baseline, unit/API/PostgreSQL tests, Docker/Compose, CI and agent instructions. Track execution in `docs/PROGRESS.md`.

## 3. Components and dependencies

Python 3.13; FastAPI/Pydantic v2; SQLAlchemy 2.0; psycopg binary; PostgreSQL 17; Alembic; uvicorn; uv; pytest/HTTPX; Ruff. Every dependency supplies a required capability. No speculative type-checking/testing framework.

## 4. Expected files / implementation manifest

- Modify root `.gitignore`, `AGENTS.md`, `README.md` for trackable instructions, phase and accurate startup.
- Add root `.prettierignore` for the unchanged upstream FastAPI skill and let `apps/frontend/scripts/check-staged-format.mjs` honor it alongside its existing ignore path. This tooling-only exception prevents the existing hook from requiring edits to vendor instructions; owned code remains checked.
- Create `apps/backend/AGENTS.md`, `pyproject.toml`, `uv.lock`, `.python-version`, `.env.example`, `.dockerignore`, `Dockerfile`, `alembic.ini`.
- Create `src/invoiceflow/__init__.py`, `main.py`, `health.py`, `core/config.py`, `core/database.py` under backend.
- Create `alembic/env.py`, `script.py.mako`, `versions/0001_foundation.py`.
- Create `tests/unit/{conftest.py,test_config.py,test_health.py}` and `tests/integration/{conftest.py,test_database.py,test_migrations.py,test_readiness.py}`.
- Create root `compose.yaml`, `.github/workflows/ci.yml`.
- Create `.agents/skills/{fastapi-feature,backend-unit-tests,backend-architecture-review}/SKILL.md`; vendor official `fastapi` skill and referenced files unchanged from pinned upstream commit; record provenance in backend architecture.
- Create/complete architecture documents and Tasks 00–06 listed by audit 00; create/update `docs/PROGRESS.md` with actual results. No frontend source or lockfile changes.

## 5. Architecture constraints

Follow `apps/backend/AGENTS.md` and architecture decisions. No module scaffolding, fake domain tables, generic repository, import-time connection, startup migration/create_all, auth stub or global session. Baseline is deliberately domain-empty; invoice schema belongs to 02. Liveness independent of database; readiness queries PostgreSQL with generic failure response. Credentials in ignored environment files, not real secrets.

## 6. Acceptance criteria

- App starts locally, `GET /health` returns 200/ok; readiness returns 200/ok with PostgreSQL and 503/unavailable without it; OpenAPI declares these responses.
- Settings reject unsupported/missing database URL and hide secrets. App lifecycle disposes engine and request sessions are closed.
- `uv.lock` supports locked install. Explicit baseline upgrades a clean PostgreSQL database; metadata check finds no drift; downgrade/reapply works in an isolated test schema.
- Real PostgreSQL integration verifies readiness, exact NUMERIC round trip and uncommitted-write rollback. No skips or SQLite fallback.
- Docker image runs non-root; Compose supplies persistent dev PostgreSQL, health checks and separate ephemeral test PostgreSQL. Startup/reset never destroys existing dev data.
- CI triggers PRs/pushes to main and existing master; minimal permissions, cached locked installs; frontend existing architecture/lint/type/Vitest/build gates and backend Ruff/unit/PostgreSQL/migration/image-build gates all fail on failure.
- Backend instructions/skills, local commands, protection guidance, architecture and progress are accurate. Existing Angular behavior preserved.

## 7. Required unit tests

Live process independent of DB, readiness success/failure without error leakage, implemented OpenAPI response contracts, settings environment loading/secret representation and malformed/missing/unsupported URL rejection.

## 8. Required integration tests

Real PostgreSQL readiness through HTTP, Decimal/NUMERIC persistence, session close rollback, isolated clean-schema Alembic upgrade/check/downgrade/reapply. Require explicit TEST_DATABASE_URL ending `_test`; fail instead of skipping unavailable infrastructure.

## 9. Verification commands

From backend: `uv sync --locked --python 3.13`; `uv run ruff check .`; `uv run ruff format --check .`; `uv run pytest tests/unit`; configured `uv run alembic upgrade head`; `uv run alembic check`; configured `uv run pytest tests/integration`. From root: `docker compose --env-file apps/backend/.env config --quiet`, `docker compose --env-file apps/backend/.env up -d --build --wait postgres backend`, GET both health paths. Verify 503 during isolated database outage and recovery without touching unrelated services. From frontend: `npm ci`, `npm run arch:test`, `npm run lint`, `npm run typecheck`, `npm test -- --watch=false`, `npm run build`. Parse workflow YAML/validate action configuration; build image; review all new files/final diff. See local-development doc for exact environment and disposable database commands.

## 10. Explicitly out of scope

Task 02 invoice routes/models/seed, frontend integration/design changes, OCR, AI, suppliers/payments/approvals, authentication, Azure provisioning/deployment, paid calls and visual regression. Do not commit/push.

## 11. Definition of Done

All acceptance criteria implemented; actual quality checks pass where infrastructure is available; exact blockers and unverified gates recorded rather than claimed green. Review architecture/final diff, update progress and stop. Do not begin 02.

## 12. Model recommendation

GPT-6.1 Sol Medium for implementation; Sol High only for difficult architecture/debugging. Terra for small defined follow-ups, Luna for mechanical fixes. No Astra or assumed automatic switching.
