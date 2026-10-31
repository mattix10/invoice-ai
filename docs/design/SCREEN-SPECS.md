# Three screen specifications

## 1. Overview dashboard

**Primary question:** “Which invoices require my attention?”

Content:
- Shared shell: 232px neutral dark sidebar + 66px topbar.
- Page title and one primary CTA: “Review next invoice”.
- Four neutral KPI cards: Awaiting review, Approved this month, Processed this month, Invoice value. Only the first KPI receives a subtle indigo border accent.
- A restrained warning strip for the golden demo invoice; the explanation and amount must agree with `DEMO-DATA.md`.
- Review queue table with invoice, vendor, due date, amount, status and explicit action.
- Right column: simple single-series processing volume chart and attention list.

Avoid color-coded KPI icons, unrelated growth metrics, decorative charts, upsell cards. Chart data in the preview is synthetic and must be labeled as such. Real implementation later receives data from API.

Acceptance: clicking the golden invoice opens Invoice Workspace; clicking its exception opens AI Investigation; shared shell remains unchanged.

## 2. Invoice Workspace

**Primary question:** “What does the invoice say, and what does it disagree with?”

Content:
- Header: `INV-2026-1042`, status Needs review, supplier, issued date, total, “Investigate with AI” action.
- Left panel: clearly labeled *sample* document preview. For future MVP, use generated PDF or source file; now the HTML representation is sufficient.
- Right panel: extracted fields, line-item table, PO-unit comparison, deterministic mismatch breakdown.
- Explicit disclosure that controls are prototype only and no actual OCR/extraction has occurred.
- Primary CTA links to investigation, not immediate approval.

Rules:
- Human review required for price variances.
- Do not enable payment/approve action in a design-only demo.
- Money is formatted consistently in PLN.
- Long supplier names wrap/truncate without overlapping other controls.
- At narrower widths, document and details stack vertically.

## 3. AI Investigation

**Primary question:** “What caused the discrepancy, what is the evidence, and what should I do?”

Content:
- Summary strip with invoice ID, vendor, invoice/PO totals and review status.
- Prepared explanatory narrative, explicitly marked as demo (not a live LLM response).
- Three evidence blocks: invoice, purchase order, delivery receipt.
- Right panel: exact net/VAT/gross discrepancy numbers and a human-readable trail of processing steps.
- Suggested next step: request supplier confirmation; avoid automatic approval.

Rules:
- Keep the main explanation short and prominent.
- Cite evidence IDs and figures, not a fictitious “AI confidence” number.
- Don't display private model reasoning / chain-of-thought. Display an auditable application event trail instead.
- No generic chatbot in the first implementation; a real AI question interface comes after the backend and permission model exist.

## Responsive behavior

Desktop >1250px: full dashboard grid, two-panel invoice view, two-column investigation.
Tablet 851–1250px: stack complex grids; retain one shared sidebar.
Narrow <=850px: common 68px icon sidebar; retain labels as tooltips/accessible names.
Small <=580px: fewer KPI columns and one-column forms, no horizontal overflow of the main page; tables scroll within their own card.

## UX review focus

1. Do I instantly recognize the invoice requiring attention?
2. Can I read the discrepancy without AI jargon?
3. Does color represent meaning rather than decoration?
4. Is the same sidebar/topbar identical on all routes?
5. Do all financial numbers reconcile?
6. Are destructive or approval-related actions guarded and truthful?
