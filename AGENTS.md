# InvoiceAI — repository instructions for Codex

Goal: build a coherent, accessible, testable Angular/FastAPI portfolio application. **Current phase: backend foundation (Task 01), alongside the existing Angular UI prototype.** Keep tasks small and implement only the assigned task; invoice APIs, AI and deployment require later tasks.

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

## Code Review Rules

- Preserve correctness, security, financial integrity and compatibility. Flag only concrete bugs or important regressions introduced by the diff; explain a reproducible trigger and impact, and propose the smallest safe correction with a relevant regression test when warranted.
- Preserve established API contracts and documented architecture/ADR decisions. Flag changes that break callers, data invariants or ownership boundaries; follow the existing contract and responsible layer, or require an explicit compatible migration rather than an incidental redesign.
- Preserve high-signal review: report only high-confidence, actionable findings supported by changed code and relevant callers. Omit formatting, naming preferences, deterministic lint output and speculative or unrelated issues; prefer no findings when evidence is insufficient.

## Handoff for each task

Briefly return: changed files, test commands/results, architecture deviations (if any), remaining limitations, next suggested task. Do not dump full source code or long reasoning into chat.
