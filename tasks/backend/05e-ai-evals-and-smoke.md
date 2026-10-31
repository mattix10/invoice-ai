# 05e — Evaluation harness and optional manual Cloudflare smoke

**Depends on:** 05a–05d green checks.
**Objective:** demonstrate that AI isn't just wired; it selects valid tools, cites real data and fails safely.

## Evaluation suite (zero live model calls in CI)

Create a small source-controlled fictional JSON/JSONL golden dataset (at least 12 scenarios). Each case has `question`, `context_invoice`, `allowed_tools`, `expected_tool_or_route`, `required_evidence_ids`, `prohibited_claims`, and expected failure/availability status—not exact generated prose. Include:

1. canonical 615.00 PLN difference; 2. no PO; 3. unknown invoice; 4. invalid currency; 5. empty search; 6. multiple invoice filter; 7. untrusted invoice text containing fake instructions; 8. unknown tool; 9. extra tool arguments; 10. model invents a receipt; 11. missing credentials/quota; 12. supplier draft not sent.

Run deterministic provider validation/contract/tool tests in pytest. For optional live manual comparison, score tool-call selection, valid citation rate, verified monetary fact rate, safe refusal/error rate and provider cost/latency, identifying each result as live vs mocked. No falsely precise model “confidence”. Keep raw prompts and customer data out of logs/CI artifacts.

## Optional live smoke (requires explicit user action)

- Only fictional local fixtures; backend bound to loopback.
- User manually configures Cloudflare **Workers Free**, account id/token in ignored `.env`, explicit `AI_PROVIDER=cloudflare`. No user-supplied token in chat, no secrets in repo or Angular.
- Verify model availability, free tier and current quotas; one small bounded request for canonical question; record exact date, model, mode, tool calls, validated facts and response status—not token contents or credentials.
- Disable live mode afterward by restoring demo/disabled. Never turn on in startup, test, PR, or public deployment.
- On quota error, show provider unavailable. Do not switch to paid or claim live verification succeeded.

## Done

All deterministic quality gates pass, documented evaluator is runnable and manual smoke is clearly marked performed/not performed. Report actual metrics and limitations. **Model:** Sol Medium implementation, Sol High final evidence/safety review. **Stop after 05e.**
