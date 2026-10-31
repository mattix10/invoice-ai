# GitHub quality gates and protection

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` and `master` (the audited repository currently uses `master`). Permissions are `contents: read`; no production secrets, write tokens, deployments or paid services. Concurrency cancels superseded runs for the same ref without duplicating workflows.

- **Frontend quality**: Node 24, npm lockfile install/cache, architecture checker tests, ESLint + architecture + Prettier, TypeScript, Vitest without watch and production build.
- **Backend quality**: uv 0.13.6, locked dependencies/Python 3.13 and uv cache, Ruff lint/format, pytest unit/API tests, Alembic upgrade and metadata check against disposable PostgreSQL 17, real PostgreSQL integration/migration round-trip tests and Docker image build.

All steps fail on nonzero exit; no `continue-on-error`, forced success, skipped tests or PR production secrets. No additional type checker is introduced; see backend architecture rationale. Docker builds are local to the runner and do not publish images. Existing frontend scripts are reused; no existing workflow was present to replace.

To enforce checks after pushing this workflow and seeing it run:

1. In repository Settings → Rules → Rulesets (or Branches → protection rule), target the actual default branch (`master` currently; include `main` if renamed).
2. Require a pull request and successful **Frontend quality** and **Backend quality** status checks. Select the actual emitted check names after the first run; enable up-to-date branch requirements if appropriate for the team.
3. Disallow force pushes/deletions and configure bypass/review rules according to ownership. Confirm a deliberately failing PR cannot merge.

Branch protection and remote workflow execution have **not** been configured or verified by this local task. YAML/action configuration validation is separate from a successful GitHub Actions run.

Native Codex review complements these deterministic jobs without adding an AI workflow. See [code review setup and validation](../engineering/CODE_REVIEW.md); account-side enablement is separate from repository preparation.
