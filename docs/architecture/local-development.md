# Local development (PowerShell)

## Requirements

Docker Desktop running with Linux containers; uv 0.13.6 or compatible; Python 3.13 (uv can install it); supported Node.js (CI uses 24) and npm. Run Compose commands from the repository root. Backend commands below run from `apps/backend`. Existing frontend commands run from `apps/frontend`.

## Start the database and backend

Create the ignored local environment file once; do not overwrite an existing one:

```powershell
if (-not (Test-Path apps/backend/.env)) { Copy-Item apps/backend/.env.example apps/backend/.env }
docker compose --env-file apps/backend/.env up -d --build --wait postgres backend
docker compose --env-file apps/backend/.env exec backend alembic upgrade head
docker compose --env-file apps/backend/.env exec backend alembic check
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/health/ready
```

Both health endpoints return `{"status":"ok"}` when PostgreSQL is available. `/health` is process liveness; `/health/ready` checks PostgreSQL and returns 503 when unavailable. Readiness does not assert schema version; apply migrations explicitly before using business APIs. Open `http://localhost:8000/docs` or `/openapi.json` for the read-only invoice routes. The container runs as a non-root user; only the backend and PostgreSQL development ports are exposed on loopback.

`.env.example` contains fictional local-only credentials, not production secrets. Change credentials before creating a fresh volume if desired. Compose interpolation assumes URL-safe username/password; percent-encode credentials in a manually provided DATABASE_URL if special characters are needed. Changing POSTGRES_PASSWORD after initializing a volume does not rotate the existing database role password.

## Backend without an application container

From root start only PostgreSQL, then run Python locally:

```powershell
docker compose --env-file apps/backend/.env up -d --wait postgres
cd apps/backend
uv sync --locked --python 3.13
uv run alembic upgrade head
uv run alembic check
uv run uvicorn invoiceflow.main:app --reload --host 127.0.0.1 --port 8000
```

Local settings read `apps/backend/.env` when that is the working directory; environment variables override it. Required DATABASE_URL must use `postgresql+psycopg` and name a database. No database connection is created at import. The app can serve liveness during a database outage; readiness reports the failure.

## Backend tests and migration checks

From repository root start the separate disposable database:

```powershell
docker compose --env-file apps/backend/.env --profile test up -d --wait postgres-test
cd apps/backend
uv sync --locked
uv run ruff check .
uv run ruff format --check .
uv run pytest tests/unit
$env:TEST_DATABASE_URL = 'postgresql+psycopg://invoiceflow_test:test_only@localhost:5433/invoiceflow_test'
uv run pytest tests/integration
```

Unit/API tests require no database. Integration tests fail clearly if TEST_DATABASE_URL is missing, unreachable or does not end in `_test`; no skipped tests/SQLite fallback. Tests create random isolated schemas, verify exact NUMERIC persistence and rollback, migration upgrade/check/downgrade/reapply, and real HTTP readiness.

To exercise the migration CLI against this disposable database without modifying `.env`:

```powershell
$taskPreviousDatabaseUrl = $env:DATABASE_URL
try {
  $env:DATABASE_URL = $env:TEST_DATABASE_URL
  uv run alembic upgrade head
  uv run alembic check
} finally {
  $env:DATABASE_URL = $taskPreviousDatabaseUrl
}
```

Task 01 baseline intentionally creates only Alembic's version table; domain schema starts in Task 02. To create future revisions: `uv run alembic revision --autogenerate -m "describe change"`; review both directions before applying. Do not generate empty revisions for nonexistent features.

## Frontend and complete checks

```powershell
cd apps/frontend
npm ci
npm start
```

Open `http://localhost:4200`. The development proxy forwards `/api` requests to the backend on port 8000. The sample PDF and investigation remain demonstration content. Regenerate frontend wire types from the running backend's actual OpenAPI with `npm run api:generate`; the pinned `openapi-typescript` generator avoids a handwritten duplicate contract. From the same directory:

```powershell
npm run arch:test
npm run lint
npm run typecheck
npm test -- --watch=false
npm run build
```

If a running Angular server locks `esbuild.exe`, stop that server in its own terminal before `npm ci`, or verify in a separate checkout; do not terminate unrelated user processes.

## Demo data

After applying migrations, explicitly seed the local database from `apps/backend` with `uv run python -m invoiceflow.modules.invoices.seed` and `INVOICEFLOW_ENV=local`. The command requires a loopback database host, preserves existing records and is not run automatically. See [database.md](database.md).

## Stop and deliberate reset

From repository root:

```powershell
docker compose --env-file apps/backend/.env --profile test down
```

This stops the environment and preserves the development volume. Stopping/removing `postgres-test` discards only its ephemeral test data.

Only when intentionally discarding all development database data, first inspect the actual volume and confirm it belongs to this project:

```powershell
docker volume inspect invoiceflow_postgres-data
```

After backup and explicit confirmation, stop the environment with the previous command and run `docker volume rm invoiceflow_postgres-data`. This is a manual destructive step, never an agent startup/test command. Start again and apply migrations to recreate an empty database. Never run a general prune or automatic `down -v`.

## CI and review

See [GitHub quality gates](github-quality-gates.md). Local verification outcomes and limitations are recorded in [progress](../PROGRESS.md). No commit, push, cloud provisioning or deployment is needed for these commands.
