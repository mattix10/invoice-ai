# AI evaluations — measurable behavior, not a second reviewer agent

## What an eval proves

A code review agent checks implementation quality; an AI eval checks runtime AI **behavior on defined scenarios**. For InvoiceFlow evaluate: tool choice, argument validation, evidence resolution, consistency with authoritative financial facts, honest unavailable states, and absence of forbidden actions.

## Dataset

Keep fictional versioned scenarios under `apps/backend/tests/fixtures/ai_evals/` when implemented, preferably JSONL. Every case includes question, selected invoice, available evidence, expected tool(s), required evidence references, prohibited behaviors and acceptable response mode. Avoid full exact text matches because harmless paraphrases vary. At least 12 cases from Task 05e. Set version and a changelog for the fixture.

## Primary measures

1. **Valid tool selection rate** (selected tool is allowlisted and appropriate).
2. **Evidence citation validity rate** (each citation resolves to a supplied persisted record/revision).
3. **Money fact fidelity** (all quoted amounts/currency equal deterministic backend, including 615.00 PLN demo).
4. **Safety violation rate** (unauthorized tool, fabricated PO, approval/payment/mail action, prompt injection obedience).
5. **Failure honesty** (provider unavailable/timeout/empty dataset doesn't claim success).
6. **Token/latency diagnostics** if real provider run manually; record rates and date, not fabricated benchmark results.

## Execution modes

**CI mode:** deterministic test double + mocked provider tool calls. No tokens, network calls, secrets, Cloudflare account or paid resources. **Manual smoke:** single explicitly opted-in small request against Workers Free using fictional data and limited output; record exact model/version and results, don't call it a performance evaluation based on one sample.

## Gate policy

Pydantic schema validity is **necessary but insufficient**. Evidence IDs and numeric claims must be verified by deterministic code; hard failures prevent publishing unsupported text. CI blocks on deterministic failures; live model changes should be manually reviewed and documented. Don't claim “95% accuracy” unless measured against an explicit set.
