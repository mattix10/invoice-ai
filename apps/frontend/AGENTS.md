# Angular-specific instructions

## Code Review Rules

- Preserve reactive state and subscription lifecycles. Flag stale Signals/computed state, missing dependency tracking, leaked subscriptions or races that render an older request's result; use existing signal derivations and lifecycle-aware RxJS cancellation/cleanup rather than adding parallel state.
- Preserve the generated OpenAPI wire contract and exact monetary view mapping. Flag request/response, nullability or enum mismatches and lossy decimal conversions; use the existing typed API client and explicit validated adapters, keeping display models separate.
- Preserve usable asynchronous interactions. Flag missing loading, empty or error handling when it causes duplicate actions, stale invoice data or invisible failures; model those states explicitly in the responsible feature component and verify the affected interaction.
- Preserve feature-based architecture, component responsibilities and existing inputs, outputs and user interactions. Flag presentation-embedded business logic or boundary changes only when they cause a concrete correctness or maintenance risk; keep views compositional, move rules to the established owner and retain the public component contract.

## Skills for this workspace

The skill paths below are relative to the repository root.

- For work in this existing frontend, use the upstream `.agents/skills/angular-developer/SKILL.md` for Angular guidance and the project-owned `.agents/skills/angular-feature/SKILL.md` for InvoiceFlow decisions.
- Use the upstream `.agents/skills/angular-new-app/SKILL.md` only when a task explicitly creates another Angular application. Keep upstream skills vendor-owned and unchanged; project requirements here and in the assigned task take precedence when their defaults differ.
- At the end of the implementation, use `.agents/skills/angular-readable-code/SKILL.md` to improve readability of the code.

- Use supported standalone Angular components, Angular Router and TypeScript strict.
- Every component must have separate `.ts`, `.html`, and `.scss` files; reference the template and styles with `templateUrl` and `styleUrl`. Do not use inline component templates or styles, including for small components.
- Give every component its own named folder, containing its TypeScript, template, styles, and component-specific tests. The root `App` component is the sole exception: keep its files directly in `src/app`.
- Generate components with the Angular CLI using the project schematics in `angular.json`; keep their default standalone mode and `ChangeDetectionStrategy.OnPush`.
- Keep route pages focused on composing feature widgets and passing prepared data. Split independently meaningful sections into focused components with their own templates, styles and tests; never combine them merely to meet a file-count target. Put demo fixtures and derived data outside presentational components; do not add a service for static data.
- During analysis and review, look for repeated UI structures and styles, such as tables with the same presentation. Extract a focused reusable component when the shared structure and behavior support a clear contract; preserve semantic HTML, accessibility and feature-specific content. Do not introduce a generic component solely because isolated CSS declarations match.
- Never add an unstyled browser-default form control. Every new or modified input, textarea, select and button must use the existing design system or have explicit CSS consistent with the design tokens, including appropriate hover, visible keyboard focus, disabled and error states. Keep semantic native HTML and accessible labels; do not replace it with inaccessible custom elements merely to avoid browser-default styling.
- Give each component a meaningful test of rendered behavior or input changes. Keep tests beside the component and avoid creation-only tests.
- Run `npm run lint` (Angular ESLint, architecture check, and Prettier), `npm run arch:test`, `npm run typecheck`, focused unit tests, and a production build for architecture changes. Fix failures rather than suppressing checks.
- After each work stage, run Prettier on all modified files it supports before validation and handoff. The pre-commit hook checks formatting of staged files.
- Follow https://angular.dev/style-guide for naming and feature-first organization.
- Components handle view interactions; do not place complex business logic or remote calls in templates.
- Use one typed fixture for `INV-2026-1042` until the API exists. Monetary totals must remain exact on every screen.
- Keep CSS variables centralized. Shared navigation belongs only to AppShell/Sidebar/Topbar.
- Prefer signals for local state; avoid adding NgRx or unnecessary RxJS for static demo views.
- Component unit tests should cover calculations and meaningful behavior, not arbitrary implementation details.
- Any chart in MVP can be done with HTML/CSS/SVG; no need to add a charting library purely for the static volume view.
- Do not add Playwright visual-regression tests or baselines.

- Before adding UI styles, review existing shared panels and recurring structures across the application. Reuse or extract a shared component with content projection when structure and responsibility match; preserve semantic elements, accessibility and intentional variants. Do not create components solely for unrelated matching CSS declarations.
