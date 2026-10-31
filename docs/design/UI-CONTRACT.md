# UI contract — Angular implementation

## Single application shell

Every route uses **exactly one** `AppShell` with a shared `Sidebar` and `Topbar`. Do not duplicate HTML or CSS for sidebar/topbar in feature components. Menu entries, icons, branding, dimensions, active styling and typography must not differ across routes.

Proposed routes (Angular Router):

| URL                           | View              | Label in sidebar  |
| ----------------------------- | ----------------- | ----------------- |
| `/overview`                   | Dashboard         | Overview          |
| `/invoices/:id`               | Invoice Workspace | Invoice workspace |
| `/invoices/:id/investigation` | AI Investigation  | AI investigation  |

`/` redirects to `/overview`. Sidebar nav for the invoice/investigation route can link to the single featured demo invoice for MVP; replace when an invoice list exists.

### Allowed component baseline (not a mandate to create empty files)

```text
apps/frontend/src/app/
  app.ts, app.html, app.config.ts, app.routes.ts  # Angular CLI conventions vary by installed version
  core/layout/
    app-shell.ts, app-shell.html, app-shell.scss
    sidebar.ts, sidebar.html, sidebar.scss
    topbar.ts, topbar.html, topbar.scss
  features/overview/
    overview-page.ts, overview-page.html, overview-page.scss
  features/invoices/
    invoice-workspace-page.ts, invoice-workspace-page.html, invoice-workspace-page.scss
    investigation-page.ts, investigation-page.html, investigation-page.scss
    invoice-demo.data.ts
  styles.scss (or other canonical global stylesheet per CLI setup)
```

Choose components by clear responsibilities and maintainability; file-count targets must not prevent necessary separation. Angular component `.ts`, `.html`, `.scss` triplets are acceptable, but do not introduce `core/services/`, `shared/utils/`, facade/store/repository or charting frameworks until a concrete feature needs them. Avoid adding every hypothetical future component.

### Angular ownership

- `AppShell` = shared responsive grid, outlet only; no business data.
- `Sidebar` = stable nav; active state from Router; one set of links.
- `Topbar` = shared breadcrumb/preview indicator/account placeholder.
- `OverviewPage` = overview data presentation (demo only at this phase).
- `InvoiceWorkspacePage` = invoice document mock and deterministic comparison display.
- `InvestigationPage` = prepared human-readable analysis with evidence, not a real LLM.
- `invoice-demo.data.ts` = **one immutable demo invoice**, no duplicative hardcoded numbers in components/templates.
- Money calculations = one pure, tested function if it becomes necessary; do not put financial arithmetic in template markup. Use integer minor units or Decimal on backend. For static UI, the seeded numbers are authoritative.

Use Angular standalone components and the Router. Prefer `inject()` and signals where there is state; do not introduce RxJS pipelines into static views. Do not add `NgRx` for the MVP.

## Scope guard

On each task:

1. Inspect existing files and patterns first.
2. Before creating files, report a concise proposed create/change list and identify the component owning each responsibility.
3. Use the task's **allowed paths**. Any new path outside scope requires an explanation and explicit approval.
4. Treat any task file-count target as an estimate. When focused components require more files, explain the planned overrun before editing; never merge responsibilities to meet the target.
5. No empty placeholder services, repositories, helpers or modules.
6. No backend, migrations, cloud or AI integration in this UI phase.
7. Use existing CSS tokens; no screen-specific recoloring of shared shell.
8. Run Angular build and relevant unit tests where configured; don't claim tests passed unless commands actually ran.
9. Summarize changed files and any deviations, then stop.

## Controls and interaction honesty

In the static prototype, only in-app navigation changes the screen. Buttons for Save, Export, and Request clarification announce demo-only behavior; no persistence occurs. In Angular phase, retain this limitation until real flows are implemented. Never present design-only data as production or AI verified output.

## Source priority

`TOKENS.md` → `UI-CONTRACT.md` → `SCREEN-SPECS.md` → `DEMO-DATA.md` → task file → static prototype. If a visual detail in the prototype conflicts with accessibility requirements, prefer accessibility and document the small deviation.
