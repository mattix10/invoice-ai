# 05c — Integrate Copilot in existing Angular Investigation UI

**Depends on:** verified 05a and 05b or demo-only compatible API.
**Goal:** make existing AI Investigation screen useful without rebuilding its layout.

**Contract and ownership:** consume generated `EvidenceReference` from `docs/architecture/api-contract.md`, including kind, invoice ID, optional reconciliation revision/line position, stable evidence ID and label. Backend validates references against persisted data; Angular's feature data-access resolver maps invoice refs to `/invoices/:id`, PO snapshot refs to the **existing** workspace comparison section, and reconciliation refs to `/invoices/:id/investigation?revision=...`. For line references, validate position and use an implemented anchor/focus parameter on that screen. The current routes have no standalone PO page; never create `/purchase-orders/...` or accept a model-provided URL. Missing/invalid/unsupported destinations render a non-clickable source label. A delivery receipt string is not a verified document link. Current-evidence answers require `is_current=true`; historical refs are marked historical and cannot support a current claim.

**Expected files/responsibilities:** existing investigation route page, focused panel/widgets with separate TS/HTML/SCSS/spec files, feature data-access client/reference resolver and tests, generated OpenAPI types and route/focus handling only where required. The page owns request cancellation and route state; the resolver owns safe navigation, widgets own display. No new dependencies anticipated; exact file list before editing.

## Discover the implementation

Read root/frontend `AGENTS.md`, Angular skill and unit-test skill, current investigation components and routing. Identify existing data-access adapters, generated OpenAPI types and shared UI elements. **Do not generate another standalone application or duplicate shell/sidebar/topbar**. New components each require their own folder, separate TS/HTML/styles and colocated Vitest tests (project convention).

## Functional behavior

- Contextual panel on existing `:invoice_id` route; question composer, accessible Send action, result text, source links to actual invoice/PO/reconciliation records and mode tag (`Demo` / `Live`).
- Suggested prompts: “Explain this discrepancy”, “Which invoices need review?”, “What evidence supports this difference?”; disable suggestions if unsupported by backend.
- Use generated OpenAPI wire models and small adapters, not competing manual types. Existing designs remain. No global chatbot overlay at MVP.
- Loading/error/unavailable/retry, empty answer and no reconciliation should have honest UI states; render safe text, not unsanitized model-generated HTML. Preserve existing demo content only if clearly labelled.
- Respect route changes and stale requests; don't show previous invoice's answer under a new invoice id.

## Tests and Definition of Done

Vitest/Angular TestBed tests for sent question payload and selected invoice id; loading/response/error; demo vs live distinction; real evidence links; route change/cancellation; missing citation, escaped text and no arbitrary HTML; follow-up buttons. Mock API via HttpTestingController, not live model. `npm run lint`, `npm run arch:test`, `npm run typecheck`, `npm test -- --watch=false`, `npm run build` must pass; backend suite if API altered.

Also test missing/stale revision and unavailable current evidence, forged evidence IDs, unsupported destinations, selected revision navigation, line focus, concurrent route changes and no navigation to model URLs. No client write/reconciliation POST is triggered by viewing a source. API failures remain visible and retryable; no cached answer from an old invoice is shown after navigation. No PostgreSQL change is owned by 05c; smoke the existing read API against local PostgreSQL and run backend integration gates only if changed. Done when generated types and real source destinations work with the existing shell and all frontend gates pass.

**Scope:** existing Investigation feature and its data-access/tests, no design overhaul or new library without approval. **Model:** Terra for UI; Sol Medium for contract mismatches. **Stop after 05c.**
