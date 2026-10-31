# 05d — Draft supplier clarification request (never send)

**Depends on:** verified grounded investigation and 05c UI.
**Business value:** save time writing precise, polite vendor inquiries after a documented mismatch.

## Contract

- `POST /api/v1/invoices/{invoice_id}/supplier-inquiry-drafts`, request references existing reconciliation revision and optional style (`neutral`, `concise`), with bounded text fields and strict validation.
- Response schema: `subject`, `body`, `evidence_refs`, `draft_only: true`, `requires_human_review: true`, `generation_mode`, `provider`, `prompt_version`.
- LLM must use only verified vendor name, invoice/PO ids, line price/quantity and deterministic financial delta. E-mail address is optional and must never be invented. Never generate a promise of refund, admission, payment instruction or unverified legal assertion.
- Angular: show editable draft, Copy action and visually clear **Not sent** status. No Send button masquerading as operational; no mail integration. Human edits are client-side until deliberate save feature separately defined.

## Safety and tests

- If there is no reconciliation or discrepancy, return a clear unavailable/unsupported message rather than a fake dispute.
- Reject unsupported monetary statements/evidence; deterministic facts remain authoritative; preserve natural-language wording without hallucination.
- Test canonical 615.00 PLN fixture; missing vendor email, unsupported evidence, prompt injection, invalid output, provider disabled, no calls to email network or invoice-write endpoints.
- Test Copy/edit flows and not-sent label with Vitest; Ruff/pytest/DB tests as applicable. No real live inference in CI.

**Scope:** one backend endpoint/use case, existing Angular panel and tests; no CRM, email OAuth, approval APIs or background workers. **Model:** Sol Medium backend, Terra frontend. **Stop after 05d.**
