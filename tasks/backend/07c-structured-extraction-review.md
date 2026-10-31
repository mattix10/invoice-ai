# 07c — Structured extraction and editable review draft

**Prerequisite:** 07a/07b document+text provenance.

**Business objective:** reduce manual transcription by offering source-backed field suggestions inside the already working 07a draft editor. Human confirmation remains the only path to invoice creation.

## Deliverables

- Pydantic **suggestion** schema with field-level `value | null`, source page/evidence span, extraction method and validation warnings; 07a remains the owner of the full editable draft schema and human correction data. Explicit constraints for invoice number, ISO currency, dates, VAT and integer quantities; monetary values are Decimal/decimal strings.
- Deterministic demo parser for known test fixtures; optional Cloudflare provider for **text-to-fields** in local opt-in mode using the existing `AI_PROVIDER` architecture. Strict schema validation and deterministic cross-check of line sums/totals; no LLM authoritative arithmetic.
- Enhance the **existing 07a Angular intake/review feature and editable draft form** (each component in own folder with TS/HTML/SCSS/spec). Show proposals with source excerpts/page and differences; let the user select which suggestions to apply locally. Never automatically replace human-edited values. Preserve existing preview, real Save draft and real Confirm invoice from 07a; do not create a second confirmation endpoint or duplicate pages. No unrelated redesign.
- Draft API: fetch the draft and **separately fetch extraction suggestions** with `GET /api/v1/intake/documents/{document_id}/suggestions/latest` (version, typed field proposals, source spans, validation warnings; 404 if none). `POST /api/v1/intake/documents/{document_id}/suggestions` deliberately reruns extraction and returns a new suggestion version/status. Define operation IDs and schemas in generated OpenAPI. There is **no PATCH**. Merge selected suggestions into the complete local draft and save through 07a `PUT /api/v1/intake/documents/{document_id}/draft` with `expected_revision`. Each successful PUT increments revision; 409 returns current revision, requiring refetch and visible conflict resolution. Preserve rejected/manual fields and their correction provenance.

If extraction finishes while a user edits, it updates only suggestions and their version; it never updates draft fields or draft revision. Show new suggestions/differences without applying them. If another editor saves first, the user's next PUT conflicts; present current server draft alongside local edits. Do not silently merge or overwrite. A proposal with missing/invalid evidence span is unavailable for application. `uploaded/draft/confirmed/failed` document states and 07a error codes remain; suggestion read/rerun uses 404 missing document, 409 wrong state, 422 invalid proposal/request and 503 provider/parser unavailable. AI disabled is an explicit unavailable state; no silent Cloudflare fallback.

**Expected files/responsibilities:** focused intake suggestion schemas/service/provider adapter and storage only if necessary; existing intake route/repository extensions, reviewed migration for persisted suggestions/audit if needed, existing Angular draft editor plus focused suggestion widget/data-access, and unit/PostgreSQL/Vitest tests. The provider proposes fields, the service validates provenance and amounts, the UI controls selected merge, and 07a PUT owns persistence. Exact manifest before implementation. Optional Cloudflare reuses the approved 05b HTTP client and server-only configuration; no new LLM framework or dependency without separate approval.

## Acceptance and tests

- Known digital/scanned fixtures produce draft, user corrects one wrong amount and sees recalculated deterministic validation, errors on missing invoice ID/currency or inconsistent totals.
- Reject unsupported invented fields, no confidence percentages without a calibrated source, no prompt-injection-induced tool calls and no silent Cloudflare fallback.
- Test revision conflict, extraction completion during active edits, selected/rejected suggestions, manual correction protection, invalid source spans, provider failure, and duplicate rerun/idempotency. Unit tests validate schemas/calculations and HTTP errors; PostgreSQL tests verify suggestion/draft revision independence, rollback and confirm using only approved fields.
- UI tests for editing, validation, loading/error, keyboard operation, source display, route state and safe text; backend tests for Pydantic, financial rules, provider failure and correction audit. CI no live provider.
- `Confirm` uses the already implemented 07a human-confirmation endpoint and stores only validated user-approved fields. It does not approve/payment the invoice. New PO linking and reconciliation happen later in 07d. Stop after 07c.
- Verify `uv sync --locked`, Ruff check/format, unit and `_test` PostgreSQL integration pytest, Alembic upgrade/check and migration round trip if changed, generated OpenAPI, and Angular arch/lint/type/Vitest/build. Done when suggestions can be reviewed and selectively saved through the existing PUT/Confirm flow without erasing manual edits. No auto-confirm, PO link, payment or public AI calls. Stop after 07c.

**Model:** Sol Medium structured backend, Terra Angular, Sol High review of financial assertions.
