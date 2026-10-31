# InvoiceAI — repository instructions for Codex

Goal: build a coherent, accessible, testable Angular/FastAPI portfolio application. **Current phase: Angular UI prototype only.** Keep tasks small and do not implement backend/AI/deployment unless a later task explicitly requests it.

## Read narrowly

For UI work, read ONLY: `docs/design/TOKENS.md`, `docs/design/UI-CONTRACT.md`, `docs/design/SCREEN-SPECS.md`, `docs/product/DEMO-DATA.md`, the assigned `tasks/*.md`, and existing code in the target feature. Open other documents only when required. Do not import the full chat history or replan the product.

## Constraints

- One AppShell, Sidebar, Topbar across all routes. Never duplicate shell components.
- Feature-first Angular source layout; one responsibility per component. No generic `utils/helpers` dumping ground, no speculative services/facades/stores.
- Respect task allowed paths. File-count targets are estimates, never a reason to merge distinct component responsibilities; explain any necessary budget overrun before editing.
- No new external dependencies unless necessary; request approval before adding.
- Do not make up working features, API/AI calls or passing test results.
- No Playwright visual regression, screenshot snapshots or visual CI in MVP.
- Avoid real vendor data, secrets, paid model calls, cloud resource provisioning and deployments.
- Validate relevant changes via available build / unit tests / lint and report factual results.
- Stop after the single assigned task. Do not move to another task automatically.

## Handoff for each task

Briefly return: changed files, test commands/results, architecture deviations (if any), remaining limitations, next suggested task. Do not dump full source code or long reasoning into chat.
