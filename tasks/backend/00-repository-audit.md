# Backend 00 — Repository audit

## 1. Business objective

Establish backend requirements from the actual Angular application without rewriting working UI.

## 2. Technical scope

Read-only audit preceding Task 01. Status: audit completed; implementation verification is recorded in `docs/PROGRESS.md`.

## 3. Components and dependencies

Root/frontend AGENTS, installed Angular skills, feature fixtures/components, routes, package scripts, architecture checker and existing documentation.

## 4. Expected files

Create this report, architecture documents (`backend.md`, `api-contract.md`, `database.md`, `local-development.md`, `github-quality-gates.md`), backend task documents 01–06 and `docs/PROGRESS.md`. Task 01 creates only the files listed in its own manifest.

## 5. Architecture constraints

Preserve the shared shell, feature-first structure and frontend. No backend, CI or Python toolchain existed before this task. No frontend services/HTTP calls exist. Initial working tree was clean; branch `master`, commit `f560fe5`.

## 6. Findings / acceptance criteria

- Angular 21.2, standalone OnPush components with separate templates/styles/tests; feature pages compose widgets. One AppShell/Sidebar/Topbar. Routes: overview, invoice workspace `invoices/:id`, investigation `invoices/:id/investigation`.
- `DemoInvoice` and `DEMO_INVOICE` in `features/invoices/invoice-demo.data.ts` are canonical. Existing workspace/investigation ignore route ID and render this one fixture. Monetary source fields use integer grosz; presentation derives numbers. Do not copy that float presentation pattern into backend finance.
- `RecentInvoice`, `OverviewKpi`, `ProcessingVolume`, `InvoiceStatus` in `overview-demo.data.ts`; `RecentInvoicesTable`, `AttentionQueue`, workspace fields/comparison and investigation evidence/audit consume prepared values. No mock service, HttpClient, fetch or persistence layer exists.
- Four visible queue summaries, one complete invoice, three line items, one PO reference and a synthetic delivery receipt. Status labels: Needs review, Approved, Processing. Other three rows have no full invoice/PO data and no detail navigation.
- Current queue has no user filtering/sorting/pagination controls. Task 02 specifies bounded server pagination, explicit optional filters and deterministic sorting as a documented API addition, not existing UI behavior.
- Canonical invoice totals PLN 10500.00 / 2415.00 / 12915.00; PO 10000.00 / 2300.00 / 12300.00; difference 500.00 / 115.00 / 615.00 = 5.0%. Dashboard historical aggregates are synthetic and independent of the four rows.
- Investigation explanation/evidence/event trail are prepared demo templates, not an actual agent trace or model call. PDF is a frontend static asset.
- Existing npm scripts provide lint (ESLint/architecture/Prettier), architecture checker tests, app/spec typecheck, Vitest and production build. npm lockfile exists. No `.github` workflow, backend, Compose or project progress document existed.
- `.gitignore` excluded new `.agents`, tasks and AGENTS files despite some already being tracked. Task 01 narrows those exclusions to allow required backend instructions/tasks while preserving existing local-only files, and adds root Python/secret/tool-output exclusions.

## 7. Required unit tests

No code changes in audit; inventory existing tests. Task 01 owns actual execution/results, not inferred successes.

## 8. Required integration tests

Audit identifies real PostgreSQL as required. No existing backend tests to reuse.

## 9. Verification commands

`git status --short`, `git ls-files`, `rg --files --hidden` excluding generated/vendor output; targeted reads of the above sources. See progress for runtime commands/results.

## 10. Out of scope

Frontend changes, live APIs/AI, vendor data, cloud provisioning and deployment.

## 11. Definition of Done

Findings and actual DTO mappings documented, Tasks 01–06 executable, no assumed existing functionality. Audit is complete; Task 01 must still satisfy its own checks.

## 12. Model recommendation

GPT-6.1 Sol High for architecture/audit. No automatic model switching or Astra. Avoid unnecessary parallel agents.
