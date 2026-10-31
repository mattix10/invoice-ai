# Task 02 — Overview dashboard

## Goal

Implement an attractive but restrained review-first dashboard, using the shell created by task 01.

## Allowed paths

- `apps/frontend/src/app/features/overview/**`
- `apps/frontend/src/app/features/invoices/invoice-demo.data.ts` (canonical fixture; if not present, create here)
- Minimal route wiring in `apps/frontend/src/app/app.routes.ts` if necessary
- Relevant unit test in the corresponding feature path

## Requirements

- Four neutral KPI cards, warning strip, review queue, simple six-month bar graph, attention list.
- One primary CTA, “Review next invoice”, links to `INV-2026-1042`.
- Golden invoice amount/variance must come from fixture. No duplicated financial numbers in HTML.
- No new charting library; simple SVG/CSS chart suffices.
- Don’t edit app shell styles/colors except to fix a confirmed shared-shell bug, which must be justified.

## Done when

Build and relevant unit tests pass, dashboard looks consistent with `ui-prototype/`, no page-level horizontal overflow in common viewport widths, and links navigate to placeholder invoice route. Use focused components with separate templates, styles and tests; explain the planned component tree and files before editing.
