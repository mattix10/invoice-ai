# Backend 03 — Angular invoice API integration

## 1. Business objective

Connect the existing queue/workspace to persisted invoices while preserving design, shared shell and exact financial values.

## 2. Technical scope

Prerequisite: Task 02 passes its gates. Generate wire types from implemented OpenAPI and add focused frontend data access and DTO-to-view adapters. Read real route IDs. Keep historical dashboard metrics and investigation explicitly labelled demo content.

## 3. Components and dependencies

Use `angular-feature`, `angular-developer`, `angular-unit-tests` and frontend AGENTS. Reuse shared widgets and existing HTTP facilities if present. Select a minimal pinned OpenAPI generator; document technical justification and obtain dependency approval if adding one is necessary.

## 4. Expected files

Allowed: generated contract under `apps/frontend/src/app/core/api/`; focused invoice API client/adapter and tests under `features/invoices/data-access/`; invoice/overview route page orchestration/templates/tests; `app.config.ts` for HttpClient, a development proxy configuration and `angular.json` wiring only if required; frontend package scripts/lockfile only for approved code generation; API/local docs, this task and progress. Define exact files/component tree before edits. No redesign of shell/widgets.

## 5. Architecture constraints

Generated wire DTOs, independently meaningful UI view models; no duplicate handwritten API types, remote calls inside presentational widgets or generic state store. Pure exact decimal-string → integer-minor-unit mapping, bounded for JavaScript safe integers. Generation must be reproducible from actual OpenAPI. Prefer dev proxy over permissive CORS.

## 6. Acceptance criteria

- Queue fetches list API; workspace fetches actual `:id` and comparison, reacts to parameter changes and does not always render canonical fixture.
- Explicit loading, empty, 404, absent comparison and recoverable error states; successful data reuses existing presentation/design/accessibility.
- Status labels, ISO dates and money map correctly; canonical amounts remain exact and no unsafe financial float conversion.
- Summary-only invoices show missing data honestly. Keep static PDF canonical-only; do not display it as another invoice's document.
- Demo investigation/historical metrics stay labelled and are not presented as live backend data. Remove fixture use only from the connected flows; preserve needed demo content.
- Document generation/re-generation and verify generated types compile against actual schema.

## 7. Required unit tests

HttpTestingController method/URL/query/error behavior, exact mapping and bounds, route ID changes, loading/empty/success/404/error, summary-only/comparison-absent states and canonical financial display. Use Angular TestBed/Vitest/AAA; no snapshot-only tests.

## 8. Required integration tests

Local frontend proxy → real backend/PostgreSQL smoke for queue/canonical detail/unknown ID and backend outage. Preserve backend integration suite. No Playwright visual regression.

## 9. Verification commands

Actual documented type-generation command selected during implementation; `npm ci`, `npm run arch:test`, `npm run lint`, `npm run typecheck`, `npm test -- --watch=false`, `npm run build`; backend full checks if changed. Run local Compose and Angular, verify real requests and record manual smoke results.

## 10. Explicitly out of scope

New UI features/filter controls not required for existing screens, write endpoints, AI/OCR/authentication/deployment, generic stores and future processing. Do not begin 04.

## 11. Definition of Done

Actual API-backed existing screens and all states tested, generation repeatable, frontend/backend gates pass; architecture/component review and progress updated with factual evidence.

## 12. Model recommendation

GPT-6.1 Terra for defined integration; Sol Medium for contract/debugging difficulties; Luna for mechanical fixes. No Astra/automatic switching.
