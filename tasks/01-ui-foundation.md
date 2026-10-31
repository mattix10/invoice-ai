# Task 01 — Angular UI foundation and shared shell

## Goal

Turn the static design contract into a minimal Angular application. Create the project once; define the central global tokens, shared `AppShell`, `Sidebar` and `Topbar`, and route placeholders for the three screens.

## Context

Read `TOKENS.md`, `UI-CONTRACT.md`, `SCREEN-SPECS.md`; inspect `ui-prototype/` only as a visual reference. Do not copy the vanilla JS DOM renderer into Angular.

## Allowed paths

- `apps/frontend/**` (Angular CLI scaffold and initial components only)
- Root package manager files only when required by the chosen Angular workspace setup
- `README.md` only for accurately documented run commands

## Required work

- Check installed Node/Angular tools, choose a currently supported Angular/TS combination, and use strict mode.
- Use Angular Router. One shell with one sidebar/topbar across the three routes. Stub route content can be a heading only **during this task**.
- Implement brand token palette, typography, spacing, borders, shared buttons and responsive shell.
- Persist sidebar menu data exactly once.
- Make `/` redirect to `/overview`; routes should work on refresh with dev server.
- Add an appropriate smoke/unit test for a stable shared component if the CLI supplies test tooling.

## Out of scope

No dashboard content, invoice content, AI, backend, PostgreSQL, authentication, cloud, PDF parser, Playwright, third-party chart library, new state management library.

## Component structure

Use the files needed to keep shell and navigation components focused, with separate templates, styles and tests. Explain the component tree and planned files before editing.

## Done when

Angular dev server starts; three URLs render the **same shell** and different placeholder titles; build and configured tests pass; no duplicate sidebar/topbar. Return `git diff --stat` and changed files.
