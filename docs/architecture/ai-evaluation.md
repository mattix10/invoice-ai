# AI evaluation

`apps/backend/tests/fixtures/ai_golden.json` contains fictional cases and expected routes,
evidence and failure states. The executable evaluator is
`apps/backend/tests/integration/test_ai_evals.py`; from `apps/backend`, set
`TEST_DATABASE_URL` to a disposable PostgreSQL database ending in `_test`, then run
`uv run pytest tests/integration/test_ai_evals.py`. Tests use isolated schemas and a
scripted provider; no live inference occurs. They are contract checks, not an estimate of
model accuracy. The dataset contains no customer data or credentials.

The supplier inquiry uses a deterministic template. In Cloudflare mode, the model selects
one of the permitted opening phrases and supplies evidence IDs; the server validates both,
renders all monetary facts itself, and rechecks the reconciliation after inference. It does
not accept arbitrary model prose, recipients or instructions. Demo mode makes no model call.
Draft edits and copying are local; no message is sent.

## Optional manual live smoke

**Not performed.** Live inference is never enabled by this evaluator or CI. A user must
manually configure fictional local fixtures and the ignored backend `.env`, set
`AI_PROVIDER=cloudflare`, enable the local Cloudflare guard, set its independent secret and
credentials, and bind the backend to `127.0.0.1`. Do not paste tokens into chat or commit
them. Before any call, check current official Workers AI model availability and Workers Free
quota. Make at most one small bounded canonical request; on quota failure report unavailable,
never switch to paid inference. Afterwards restore demo or disabled mode.

For a live comparison, label each result live or mocked and record date, model, mode,
selected tool calls, validated evidence and monetary facts, status, latency and actual
provider cost if available. Calculate tool-selection, citation, monetary-fact and safe
refusal rates as passed applicable cases divided by applicable cases; report denominators
and unavailable measurements. Never log raw prompts, tokens, customer data, or an invented
confidence percentage. One smoke request cannot establish general model accuracy.
