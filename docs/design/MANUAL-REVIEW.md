# Lean visual and UX check (NO automated visual-regression tooling)

**Rationale:** speed, small context, minimal dependencies. We explicitly **do not** add Playwright visual tests, screenshot baselines, browser automation packages, pixel-diff tools or CI visual jobs during the UI MVP.

## Review manually after each feature

Open the running Angular app at 100% browser zoom, then check at about 1440px desktop, 1024px tablet and 390px mobile viewport widths (ordinary browser DevTools are enough):

- [ ] Sidebar and topbar have identical styling across all three routes.
- [ ] Active sidebar state is predictable, and keyboard focus is visible.
- [ ] Titles, totals and CTAs are visible without hunting through decorative cards.
- [ ] No clipped rows, overlapping inputs, unreadable data or unexpected page-level horizontal scroll.
- [ ] Only indigo marks primary actions; warning/error/success colors encode actual statuses.
- [ ] Price discrepancy is PLN 615 gross / PLN 500 net / PLN 115 VAT = 5.0%.
- [ ] Invoice amount is PLN 12,915; purchase order amount is PLN 12,300 everywhere.
- [ ] Navigation between all three routes works; unimplemented operations are visibly marked as demo-only.
- [ ] At 200% zoom, content can still be accessed (some scrolling is fine).
- [ ] No claim of real AI extraction, confidence, OCR or payments when only fixtures exist.

**Optional later**, not in MVP: lightweight automated accessibility checks and separate Playwright E2E for critical functional business flows. These are distinct from screenshot-regression testing.

Ask the reviewer agent to report only confirmed defects, grouped by critical / normal. Avoid open-ended redesign rounds. A human can accept or reject visuals with a small manual review.
