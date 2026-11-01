# Local development (PowerShell)

## Requirements

Docker Desktop running with Linux containers; uv 0.13.6 or compatible; Python 3.13 (uv can install it); supported Node.js (CI uses 24) and npm. Run Compose commands from the repository root. Backend commands below run from `apps/backend`. Existing frontend commands run from `apps/frontend`.

## Start the database and backend

Create the ignored local environment file once; do not overwrite an existing one:

```powershell
if (-not (Test-Path apps/backend/.env)) { Copy-Item apps/backend/.env.example apps/backend/.env }
docker compose --env-file apps/backend/.env up -d --build --wait postgres backend ocr-worker
docker compose --env-file apps/backend/.env exec backend alembic upgrade head
docker compose --env-file apps/backend/.env exec backend alembic check
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/health/ready
```

The repair migration for early `0008_purchase_orders` schemas preserves existing data. If legacy purchase orders exist without recorded provenance, it stops without guessing their source; resolve their provenance with a reviewed migration before retrying. It does not reset the database.

Both health endpoints return `{"status":"ok"}` when PostgreSQL is available. `/health` is process liveness; `/health/ready` checks PostgreSQL and returns 503 when unavailable. Readiness does not assert schema version; apply migrations explicitly before using business APIs. Open `http://localhost:8000/docs` or `/openapi.json` for the invoice and reconciliation routes. The container runs as a non-root user; only the backend and PostgreSQL development ports are exposed on loopback.

Document intake is for local development only until Task 09 adds authorization. Compose stores uploaded PDFs in the private `intake-data` volume; it survives container restarts. Local non-container runs use `.invoiceflow-storage` in the backend working directory by default; `INTAKE_STORAGE_DIR` overrides it. Keep this directory private and outside static hosting. Do not commit documents or expose the unauthenticated application publicly.

The upload accepts PDF files up to 10 MiB and 20 pages, and JPEG or PNG files up to 10 MiB and 20 decoded megapixels. It validates the file, but is not a malware scanner. Duplicate file content produces a conflict offering the existing document or explicit creation of a separate one; duplicate supplier invoice numbers are rejected at confirmation. Drafts use revision checks and confirmation creates a `needs_review` invoice without inventing a purchase order.

## Local field suggestions

`AI_PROVIDER=demo` enables the offline deterministic parser by default in a new local environment. Set `AI_PROVIDER=disabled` to turn suggestions off; manual editing remains available. If your existing `.env` uses `disabled`, change it to `demo` and recreate the backend container:

```powershell
docker compose --env-file apps/backend/.env up -d --force-recreate backend
```

Compose passes this setting to the backend. An existing shell environment variable takes precedence over the environment file. No external provider or network fallback is configured; values other than `demo` are unavailable. For a backend run outside Compose, set the same variable in `apps/backend/.env` or the process environment and restart it.

First upload a fictional document, run text extraction in the review screen, and inspect the extracted text. Then request suggestions. The demo parser recognizes the following exact line labels (case-insensitive) and format on the same page for the item and totals blocks:

```text
Vendor: Example Company
Invoice number: DEMO-100
Issued: 2026-10-01
Due: 2026-10-31
Currency: PLN
VAT rate: 0.23
Item: 1 | Paper | 2 | 12.00
Net: 24.00
VAT: 5.52
Gross: 29.52
```

Each item line contains position, name, integer quantity and decimal-string unit net price; consecutive item lines form one block. Totals must appear in the shown order. Dates use ISO format, currency uses three uppercase letters, and VAT is a decimal rate between 0 and 1. The parser recognizes this demo format and a limited English single-line-item invoice text layout; OCR may alter labels or values, so inspect the extracted text and source spans. Suggestions do not update the draft automatically. Select fields, review and save; mismatched totals produce warnings, and confirmation uses the existing validated draft flow.

## Offline document worker (Windows / VS Code)

Install Docker Desktop with the WSL 2 Linux-container backend, start Docker Desktop, and open this repository in VS Code. Run the Compose commands above from the VS Code PowerShell terminal at the repository root; the first build compiles Tesseract and can take several minutes. No Windows Tesseract, Poppler installation or paid account is required. The document worker is an independent Compose service: the API and worker share only the private `ocr-spool` volume, not the database or document-storage volumes. Both run as UID 10001 so the worker can read the API's private job directories. Do not mount the Docker socket, credentials or additional paths into the worker.

The Compose worker has no network, a read-only root filesystem and language data, no Linux capabilities, `no-new-privileges`, a 512 MiB memory limit, one CPU, a 32-process limit and a 256 MiB temporary filesystem. PDF rendering, text-layer parsing and OCR run there. The worker's binaries get a minimal environment without database credentials. Jobs have a 60-second processing deadline; the API waits at most 75 seconds. The API removes its temporary job directory on completion or timeout; the worker cleans abandoned jobs older than ten minutes. The volume contains sensitive document data while jobs are active, so restrict Docker access and protect its storage. A crash can leave temporary data until cleanup, and the volume itself has no disk quota. These controls depend on the Compose configuration and Docker host; a process with access to the spool can read or impersonate jobs. Do not expose this unauthenticated local prototype publicly.

The worker image builds [Tesseract 5.5.4](https://github.com/tesseract-ocr/tesseract/releases/tag/5.5.4) at commit `7e548e6eff172f38f97664afe7f7ce40db36c8d6` (Apache-2.0), including its security fixes. It installs Debian Trixie `tesseract-ocr-eng` and `tesseract-ocr-pol` version `1:4.1.0-2` (Apache-2.0 traineddata) and `poppler-utils` version `25.03.0-5+deb13u4` (GPL-2.0-or-later; see Debian package copyright for component notices). Tesseract uses Debian Leptonica (BSD-2-Clause and component licenses). PDF text parsing uses the locked pypdf 6.21.4 (BSD-3-Clause); image validation uses Pillow 13.0.0 (HPND/MIT-CMU and component licenses). Debian transitive packages and the base-image digest are not pinned by this Dockerfile; rebuilding can change them or fail if the explicitly pinned packages leave the repository. Review their security updates and licenses when distributing an image.

The [Debian Poppler security tracker](https://security-tracker.debian.org/tracker/source-package/poppler) reports unresolved issues for the pinned package, including CVE-2026-107705 and CVE-2026-93653. Isolation reduces exposure but does not prevent a compromised worker from accessing other active jobs in its shared spool. Use only fictional or trusted local documents while evaluating these vulnerabilities; update the renderer when a suitable fixed release is available.

Uploaded images are decoded, checked for truncation and format, oriented using EXIF, and converted without source metadata. Previews are bounded JPEGs of at most 1600 pixels on the longest side; OCR image input retains its resolution within the 20-megapixel limit. PDF rendering uses the same 1600-pixel maximum. Extracted text is limited to 1,000,000 UTF-8 bytes per document. A blank or unreadable page can yield empty text; OCR is not a source of verified financial values and never fills the draft automatically. If the worker is absent, overloaded, times out or lacks its engine/language files, extraction and PDF preview return a sanitized 503; manual draft editing remains available. When running the API outside Compose, the default has no worker spool and these operations are unavailable: do not point it at an unisolated local process.

For a smoke check, upload a fictional digital PDF, a scanned PDF, and JPEG/PNG samples using the UI or `/docs`, request text extraction, and inspect the page methods and text. Verify a private preview and confirm that the draft has not changed. To inspect the runtime constraints and installed engine without printing document contents:

```powershell
docker compose --env-file apps/backend/.env exec ocr-worker tesseract --version
docker compose --env-file apps/backend/.env exec ocr-worker tesseract --list-langs
docker inspect (docker compose --env-file apps/backend/.env ps -q ocr-worker)
```

Upload failures remove staged files when possible. A process crash between file placement and database commit can leave an orphan in storage; recovery requires an operator to compare generated storage names with `intake_documents.storage_name` before removing any unreferenced file. There is no automatic deletion of stored documents or volumes.

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

After migrations and explicit local seeding, invoke reconciliation with `curl -X POST http://localhost:8000/api/v1/invoices/INV-2026-1042/reconciliation -H "Content-Type: application/json" -d "{}"`. The endpoint records deterministic results and does not change invoice approval status.
