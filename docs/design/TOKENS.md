# Visual tokens — InvoiceAI

## Principles

**Quiet finance workspace.** Visual weight should track business importance, not decorative appeal. The design uses neutral surfaces, a single indigo brand accent and semantic color only where state matters. Avoid gradients, decorative charts, rainbow KPI cards, oversized shadows, excessive badges, and marketing elements inside operational screens.

## Core color tokens

| Token | Value | Meaning |
|---|---|---|
| `--nav` | `#151D2B` | Persistent sidebar |
| `--canvas` | `#F7F9FC` | App background |
| `--surface` | `#FFFFFF` | Cards, inputs, document areas |
| `--text` | `#101828` | Main text |
| `--text-2` | `#475467` | Secondary text |
| `--muted` | `#667085` | Supporting labels |
| `--border` | `#E5EAF1` | Neutral separation |
| `--primary` | `#4F46E5` | One key action/selected interactive state |
| `--primary-bg` | `#EEF2FF` | Low-emphasis branded surface |
| `--success` | `#027A48` | Approved/completed only |
| `--success-bg` | `#ECFDF3` | Success surface |
| `--warning` | `#A15C07` | Needs human attention |
| `--warning-bg` | `#FFFAEB` | Warning surface |
| `--danger` | `#B42318` | Confirmed discrepancy/error |
| `--danger-bg` | `#FEF3F2` | Danger surface |

Do not use color as the **only** signal. Every status includes a label, and where useful an icon. Do not use green for positive business metrics without evidence that positive movement is actually desirable.

## Typography

Font stack: `Inter`, with `system-ui`, `Segoe UI`, `Roboto`, `Arial` fallbacks. Do not require downloading a commercial font. A single type family throughout.

- Page heading: 30px desktop, 25px narrow, weight ~730, line height 1.22.
- Card heading: 16px, weight 700.
- Section label: 12–13px, weight 650–780.
- Body: 14px base, 1.5–1.65 line height.
- Supporting metadata: 12–13px where possible; small dense data labels 10–11px only when the actual UX remains legible. **Avoid reproducing the smallest image-generator labels blindly.**
- Monetary values: tabular numerals to prevent visual jumping.

## Dimensions

- Sidebar: **192px** desktop, 68px icon rail at narrower widths; same across all views.
- Topbar: **54px** desktop; same across all views.
- Content max width: 1550px, centered; 36px desktop horizontal padding.
- Spacing rhythm: 4, 8, 12, 16, 24, 32 (most cards use 20–24px inner padding).
- Card radius: 12px. Button/input radius: 7–9px.
- Border: 1px neutral. Shadows: very subtle (`0 4px 20px rgba(16,24,40,.035)`).
- Tables: clear row separators, fixed numeric alignment, labels at least legible at default 100% zoom.

## Visual hierarchy

1. First focus: invoices requiring **human action**.
2. Second focus: source data, price mismatch and evidence.
3. Third focus: trends and operational analytics.
4. AI is an assistant with cited evidence, **not** the ultimate financial decision maker.

## Accessibility baseline

Aim for WCAG 2.2 AA: sufficient text/element contrast, visible focus, keyboard navigation, semantic buttons/links, clear headings, no color-only status, sufficient touch target size in final Angular implementation, and graceful 200% browser zoom. The static preview is not an accessibility certification.

## Design don'ts

- No separate sidebar designs per screen.
- No purple, blue, cyan, yellow and pink icons in every KPI card.
- No full-screen promotional upsell cards.
- No false precision/confidence percentages for fabricated AI output.
- No generic chatbot panel that lacks evidence/context.
- No fake functional controls without clearly marked demo behavior.
