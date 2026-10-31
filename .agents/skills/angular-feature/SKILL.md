---
name: angular-feature
description: Implement or refactor one Angular UI feature task in the existing InvoiceFlow frontend with strict component separation, Angular CLI, tests, and architecture checks. Use when adding or modifying an Angular feature; excludes new apps, backend work, and future phases.
---

# InvoiceFlow Angular feature

Use this skill for one focused task in the existing `apps/frontend` application. Read the official `.agents/skills/angular-developer/SKILL.md` for Angular APIs and CLI behavior, then `AGENTS.md`, `apps/frontend/AGENTS.md`, the assigned `tasks/*.md`, relevant design documents, and target code. The official `angular-new-app` skill applies only when creating a new application. Keep vendor skills unmodified; the frontend instructions and assigned task define this project's stricter rules.

## 1. Analyze

Inspect the Angular version, existing feature, shared components, and naming conventions. Identify the page or orchestration component, independently maintained business widgets, models and data transformations, and any existing data access. Do not invent a service for static fixtures or create duplicate components or abstractions.

## 2. Define the component tree

Before editing, write a concise component tree and planned list of new and modified files. For each component, specify its responsibility, inputs and outputs, whether it accesses an existing service, and its directory and files. Check the assigned task's allowed paths. Treat file-count targets as estimates: explain a necessary overrun before editing, and never combine independently meaningful responsibilities to stay under a target. Do not start coding until the component boundaries are internally consistent and the route page composes focused widgets.

Reuse the single AppShell, Sidebar, Topbar, global tokens, and canonical invoice fixture. Keep route pages focused on composition and orchestration; prepare fixture and derived data outside presentational components.

## 3. Implement

Use the configured Angular CLI schematics for new components. Each component must have its own directory with separate TypeScript, HTML, SCSS, and colocated meaningful unit test files. The root `App` component is the sole directory exception: its files live directly in `src/app`. Keep components focused and accessible. Keep API access and data transformations outside presentational components.

Stay within the assigned UI task. Do not add unrelated backend, AI, deployment, state-management libraries, Playwright visual regression, speculative services or helpers, or future features.

## 4. Verify

Run Prettier on every modified file after each stage. Run the architecture checks, ESLint, relevant unit tests, type checking, and production build required by `apps/frontend/AGENTS.md`. Inspect the changes for unnecessary files, duplicate logic, oversized page components, inline templates or styles, missing tests, and feature-boundary violations. Fix failures caused by the changes; never hide or bypass a failing check.

## 5. Report

Report the component tree, created/modified/removed files, factual verification results, deviations, remaining limitations, and the next assigned task. Never claim an unverified result as successful. Stop after the single assigned task.
