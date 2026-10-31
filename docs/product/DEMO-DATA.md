# Canonical demonstration invoice (single source of truth)

All names and figures are fictional. The preview's `DEMO` object in `ui-prototype/app.js` is the machine-readable initial copy. When porting to Angular, keep **one** immutable fixture instead of manually duplicating totals in three components.

| Field | Value |
|---|---|
| Invoice ID | `INV-2026-1042` |
| Vendor | Northline Office Sp. z o.o. (fictional) |
| Purchase order | `PO-2026-0871` |
| Issued | 2026-10-22 |
| Due | 2026-11-21 |
| Currency | PLN |
| Status | Needs review |
| VAT rate | 23% |

| Line item | Quantity | Invoice unit net | PO unit net | Invoice net | PO net |
|---|---:|---:|---:|---:|---:|
| 27-inch monitor | 10 | 820.00 | 770.00 | 8,200.00 | 7,700.00 |
| Keyboard | 10 | 110.00 | 110.00 | 1,100.00 | 1,100.00 |
| USB-C docking station | 5 | 240.00 | 240.00 | 1,200.00 | 1,200.00 |
| **Net total** | | | | **10,500.00** | **10,000.00** |
| VAT 23% | | | | 2,415.00 | 2,300.00 |
| **Gross total** | | | | **12,915.00** | **12,300.00** |

Difference: **500.00 PLN net**, **115.00 PLN VAT**, **615.00 PLN gross** = **5.0%** of PO gross. The entire price deviation is explained by **10 × (820−770) = 500 PLN net** for monitors. Quantities match the invoice, PO and synthetic delivery receipt.

Do NOT invent processing confidence percentages for this demo. “AI investigation” is a prepared text display, not a live model inference. Future generated outputs must be explicitly labeled and linked to auditable evidence. Do NOT store sensitive real user/vendor information in a public repository.

Dashboard-only synthetic records (not to be treated as the same invoice):

- `INV-2026-1041` — Riverton Cloud Ltd. — PLN 3,444.00 — Approved.
- `INV-2026-1040` — Baltic Logistics Sp. z o.o. — PLN 1,845.00 — Processing.
- `INV-2026-1039` — Fieldstone Services — PLN 5,166.00 — Needs review.

October dashboard aggregates (synthetic): 124 processed, 96 approved, 8 awaiting review, PLN 318,740 invoice value. Do not assume these aggregates are the sum of the four visible queue rows.
