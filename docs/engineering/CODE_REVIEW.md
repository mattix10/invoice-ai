# Code review

## Native Codex integration

Use native Codex Cloud Code Review through the existing ChatGPT/Codex account.
It reviews PR diffs and posts GitHub reviews; no custom AI GitHub Action, API key
or provider service is needed. This repository supplies guidance, not an integration
enablement switch. **Account settings and live reviews have not been verified.**

### Connect and enable

1. Sign in to Codex with the existing account. Connect GitHub through the supported
   Codex setup and grant access to `mattix10/invoice-ai`; organization approval may
   be needed. Perform authorization interactively, never with stored login cookies
   or copied Codex credentials in CI.
2. Open [Codex code review settings](https://chatgpt.com/codex/settings/code-review),
   select this repository, then enable **Automatic review** under **Review code**.
   Configuring repository settings requires GitHub push/admin access.
3. Select the available review policy for the intended PR authors. For personal
   automatic reviews, enable **Automatic review** under **Personal preferences**
   and choose **Review trigger**. Verify the selected scope covers the team; do
   not assume one person's preference enables every author's PRs.
4. Target the actual default branch, `master`, when validating. No new AI workflow
   or GitHub secret should be created.

For a manual review, post this PR comment:

```text
@codex review
```

Wait for acknowledgment and a completed review. An acknowledgment, no response,
or a green application CI check alone does not establish completed AI review.
See the [official GitHub integration guide](https://learn.chatgpt.com/docs/third-party/github).

## Repository rules and findings

Codex follows applicable `AGENTS.md` review guidance: root rules cover the repo,
and nested rules cover their subtree. Each file has a concise **Code Review Rules**
section stating what to preserve, which concrete failures to flag and the safe
path. Frontend rules cover reactivity, contracts, UI states and components; backend
rules cover financial invariants, validation, access, persistence and AI authority.
Existing architecture documents remain the source for detailed decisions.
See OpenAI's [custom review rules guidance](https://developers.openai.com/blog/custom-code-review-rules-for-codex).

Assess findings by their trigger, affected caller/data, impact and suggested fix.
Reproduce consequential issues and add a focused regression test where useful;
explain dismissals with evidence. Native GitHub review currently emphasizes P0/P1
findings; absence of comments does not rule out lower-priority or missed defects.
A completed no-findings result means no issues were reported within the review's
scope, never an unconditional **safe to merge** guarantee.

## Limits and billing

Native GitHub Code Review consumes the account's applicable plan limits. Check
Codex usage/settings for availability and remaining allowance; limits and access
can change. This task does not purchase credits, enable overages or promise
unlimited free reviews. If quota or permissions prevent review, investigate the
integration status instead of interpreting silence as approval.
See [Codex pricing and usage](https://learn.chatgpt.com/docs/pricing).

The API-based [`openai/codex-action`](https://learn.chatgpt.com/docs/github-action)
is a different integration: its API-key configuration requires API authentication
and separately metered API billing, not the native account review allowance.
Do not install it here or use subscription credentials to imitate an API workflow.

## Deterministic quality gates

Keep **Frontend quality** and **Backend quality** required through the existing
[quality-gate policy](../architecture/github-quality-gates.md). Their unchanged
jobs run Angular lint/architecture checks, TypeScript, Vitest and production build;
Ruff, pytest unit/API tests, real PostgreSQL integration tests, Alembic validation
and backend image build. Codex complements these checks with semantic review;
it does not replace them or attest that tests ran.

The obsolete custom reviewer workflow, script, prompt, tests and setup guide are
removed together. Only its dedicated `reviewer-tests` CI job is removed. After
merging, remove any retired `OPENROUTER_API_KEY` secret and `FREE_AI_REVIEW_MODEL` /
`FREE_AI_REVIEW_ENABLED` variables if no other automation uses them. Remove obsolete
AI-only required checks if configured; retain application quality gates. These
remote settings have not been changed. Supersede pending custom-reviewer PRs so
they do not restore retired automation; historical comments/runs may remain.

## Validate with a test PR

1. After these changes reach `master`, open a small representative PR with fictional
   data and a known reversible bug, such as a response enum mapping mismatch.
2. Confirm the intended automatic trigger starts native review. If it does not,
   inspect repository access, author policy, trigger and plan allowance; use the
   manual comment above to test manual review separately.
3. Verify an actual completed Codex review for the current revision and inspect
   its findings. Check relevant root/nested guidance is reflected, without
   expecting the model to detect every defect.
4. Fix the defect, request another review when needed, and wait for fresh feedback
   plus the normal CI results before merging or closing the test PR.
5. Record the tested PR URL, revision, automatic/manual trigger and observed result
   in the PR discussion. Until this account-side test succeeds, describe the
   repository as **prepared**, not as an enabled or verified integration.
