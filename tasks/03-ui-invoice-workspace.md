# Task 03 — Invoice workspace

## Allowed paths

- `apps/frontend/src/app/features/invoices/**` (except investigation page)
- Existing route wiring if essential

## Requirements

- Render invoice document illustration on left and extracted fields/PO comparison on right.
- Use canonical fixture from Task 02 and exact numbers in `DEMO-DATA.md`.
- Present Needs review; explicit mismatch of 10 monitors × PLN 50 = PLN 500 net (+PLN 115 VAT).
- No actual OCR or upload; clearly label as static sample source data.
- Primary CTA routes to AI Investigation placeholder. Save/Export/Request actions are disabled or clearly demo-only.
- Mobile and narrower layout stack; no duplicate AppShell.

## Done when

Build/relevant unit tests pass, all totals reconcile, routing works, shell remains unchanged. Separate the document preview, invoice fields and PO comparison into focused components with their own templates, styles and meaningful tests. Explain the component tree and planned files before editing; do not constrain the architecture to a file-count target.
