# Free advisory AI code review

## Architecture

`.github/workflows/ai-code-review.yml` uses `pull_request_target` for opened,
reopened, synchronized and ready-for-review PRs targeting `main`. Drafts, forks
and PRs with `FREE_AI_REVIEW_ENABLED=false` are skipped at the job boundary.
The Python reviewer uses only the standard library. There are no new packages,
agents, paid subscriptions, OpenAI API calls or GitHub Models integrations.

1. **Analyze:** checkout the immutable event base SHA with credentials disabled;
   execute only the base branch reviewer and prompt. Fetch PR patches through
   the GitHub REST API as data. GitHub access is read only. Only this job receives
   `OPENROUTER_API_KEY`.
2. **Publish:** a separate runner checks out the same trusted base SHA, downloads
   the JSON report from this workflow run/attempt, checks the current PR revision
   and validates findings against freshly fetched diff lines. Only this job has
   `pull-requests: write`; it does not receive the OpenRouter secret. It creates
   or updates one marked `github-actions[bot]` issue comment.

Neither job executes PR code, installs PR dependencies, uses a PR-controlled
workflow/script, interpolates PR text into shell, grants source write access,
pushes or merges. Third-party actions are pinned to release commit SHAs.
Protect `main` and require human review of changes to `.github/` and `prompts/`:
the trusted base is the security boundary. The first PR introducing these files
cannot use its own reviewer; merge the implementation through normal review first.

Concurrency cancels obsolete runs for a PR. Both analysis and publishing verify
the head and base SHAs, open state, draft state and same-repository origin. A final
check happens immediately before the comment write. GitHub provides no atomic
conditional comment write tied to a head SHA; a commit arriving in that final
window may briefly leave an old revision's comment. Each comment shows its SHAs;
the new run replaces it.

## Manual GitHub setup

1. Merge these reviewed files into `main`. Do not enable an unreviewed base script.
2. At **Settings → Actions → General**, enable Actions and allow the pinned
   `actions/checkout`, `actions/upload-artifact`, `actions/download-artifact`
   actions. Organization policy must permit the job's `pull-requests: write`
   permission. No setting to let Actions approve PRs is required: this only posts
   a comment, never a formal approving review.
3. Create an OpenRouter API key at <https://openrouter.ai/settings/keys>. No paid
   OpenAI account, credit purchase or other cloud setup is required. Prefer a
   dedicated key and an account without paid credit/automatic recharge.
4. At **Settings → Secrets and variables → Actions → Secrets**, create repository
   secret **`OPENROUTER_API_KEY`**. Never put the key in a variable, source or PR.
5. Optional repository **Variables**:
   - `FREE_AI_REVIEW_MODEL`: defaults to `openrouter/free`; alternatively use an
     exact catalog ID ending in `:free`.
   - `FREE_AI_REVIEW_ENABLED`: set to `false` to disable; unset or `true` to enable.
6. Open a non-draft same-repository PR to `main` changing a source file. Inspect
   the two jobs and the single advisory comment. Also verify a docs-only PR skips
   inference and a subsequent commit updates the existing comment.
7. Keep **Quality gates** checks required under branch protection. Keep the AI
   review jobs optional: findings and provider failures must not block merging.
   The deterministic reviewer test job can be required like other unit tests.

No GitHub secret, variable, branch protection or external account was changed by
the local implementation. End-to-end GitHub/OpenRouter verification is a manual
step; ordinary tests never send a real inference request.

## Free model enforcement and limits

Before inference, `GET https://openrouter.ai/api/v1/models` must list the selected
model with zero prompt/completion prices and zero for every other advertised
price field. Missing, invalid, paid or unknown prices fail closed. Only
`openrouter/free` and explicit `:free` variants are accepted. The request also sets
provider maximum prompt, completion and per-request prices to zero, disables
provider fallbacks, and supplies no fallback model list, tools or paid plugins.
The free router itself selects among free models; the script never substitutes a
different model when a call fails. Unsupported JSON mode or routing settings
also produce an incomplete review rather than a fallback.

See OpenRouter's [free router documentation](https://openrouter.ai/docs/guides/routing/routers/free-router)
and [maximum provider prices](https://openrouter.ai/docs/guides/routing/provider-selection#max-price).
Catalog checks and a request price cap protect against catalog pricing changes;
they still rely on OpenRouter honoring its API contract.

There is at most one inference POST per normal event revision (head + base SHA).
A marker in the bot comment prevents reopening/ready events from spending another
request on an already attempted revision. Explicit **Actions → Free AI code review
→ select run → Re-run all jobs** bypasses this guard for a deliberate retry.
**Re-run failed jobs** suffices if only publishing failed. A canceled run or failed
comment write may have consumed inference without persisting its marker; a rerun
can then consume another request. There is no durable exactly-once guarantee and
no automatic retry loop. A timeout has the same ambiguous consumption risk.

The serialized source diff is capped at **24,000 UTF-8 bytes**, reduced for smaller
catalog context windows using a conservative one-token-per-byte bound, a 2,048
token framing reserve and **2,048 maximum output tokens**. Truncation keeps whole
patch lines. Omitted patches/lines always produce an explicit incomplete-coverage
warning. Patches with no RIGHT-side lines (including full file deletions) cannot
receive findings. Missing GitHub patches are omitted with a warning. PRs at the
3,000-file API listing ceiling fail closed. Only changed source patches are sent;
there is no full repository context or chunked second pass.

Allowlisted source extensions include Python, TypeScript/JavaScript, HTML, CSS,
SCSS, SQL, shell/PowerShell and Dockerfiles. Documentation, lockfiles, binary
assets, dependency/build directories and common generated filenames (including
the generated frontend API schema) are excluded. Unusually named generated files
may need an explicit filter addition; this is a filename-based policy.

Free quotas are shared across keys/accounts according to provider policy. As
checked on 2026-10-31, the [pricing page](https://openrouter.ai/pricing) advertises
50 free requests/day. Per-minute limits and upstream capacity also apply; consult
the current [rate-limit documentation](https://openrouter.ai/docs/api/reference/limits)
and the authenticated `GET /api/v1/key` counters for the actual account ceiling.
Free capacity is not guaranteed and models can disappear. HTTP 429, quota
exhaustion, timeouts, unavailable models and malformed output produce a distinct
**review could not be completed** comment. There are no automatic retries.

Model inference is $0 within free limits. GitHub-hosted runner minutes and artifact
storage follow the repository's GitHub plan; private repositories may exhaust
their included quota. Artifacts contain only the validated report, not raw diffs
or API responses, and expire after one day. Do not enable paid Actions overages
if strict total zero cost is required. OpenRouter is the only external AI provider
required by this solution; normal CI continues independently if it is unavailable.

## Output and security limits

The trusted prompt requests only actionable P0/P1/P2 issues. Strict JSON validation
rejects extra keys, incorrect types, malformed/truncated output, P3 findings,
unknown files and lines outside the exact submitted RIGHT-side patch lines.
The publisher validates again against GitHub. Model text is escaped before
publication; it is never executed. A human-authored marker cannot impersonate the
bot comment. Subsequent commits update the existing bot comment instead of posting
another. No findings is explicitly reported as
**“No high-confidence issues were detected.”** Failed/skipped reviews use separate
messages and never claim that the code passed review.

PR data and model output remain untrusted. A system prompt reduces prompt
injection risk but cannot guarantee that model conclusions follow instructions.
The model has no tools, credentials in its prompt, or source modification access.
Human review is required before acting on a finding. The GitHub/OpenRouter keys
are HTTP headers only, redirects are refused, and raw errors/responses/diffs are
not logged. Source patches are transmitted to OpenRouter and its selected free
provider: assess their data retention policies before enabling on private code.
Do not submit secrets or real financial/vendor data in PRs. If PR code itself
contains sensitive values, this tool cannot guarantee redaction of model findings.

Disable using `FREE_AI_REVIEW_ENABLED=false`, or **Actions → Free AI code review
→ … → Disable workflow**. Existing comments remain; deterministic CI is unaffected.

## Static analysis decision and local validation

Existing ESLint, architecture checks, Vitest, Ruff, pytest, migrations and build
verification are preserved. No previous Codex review workflow was present to
remove. Reviewdog was evaluated but deferred: adding annotations now would require
new formatter/report plumbing and permissions without improving existing blocking
checks. Semgrep CE was evaluated but deferred: a pinned installation and curated
TypeScript/Python rules would add dependency/rule maintenance and runtime to this
lightweight change. Neither service nor paid feature is required. Revisit either
as a separate scoped task when annotation or security-rule needs are concrete.

Run from the repository root:

```sh
python3 -m unittest discover -s .github/scripts -p 'test_*.py' -v
actionlint .github/workflows/ai-code-review.yml .github/workflows/ci.yml
git diff --check
```

The existing CI runs the same offline reviewer tests in a new small blocking job.
They mock OpenRouter/GitHub and cover filtering, line validation, malformed output,
empty findings, paid model rejection, API/rate-limit failures, oversize warnings,
revision deduplication, stale PRs and comment creation/update. Application lint and
test commands remain in their original jobs without being duplicated here.
