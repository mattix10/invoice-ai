# Backend 06 — Azure deployment preparation

## 1. Business objective

Prepare a reviewable, reproducible hosting configuration without exposing an unauthenticated financial application or provisioning paid resources automatically.

## 2. Technical scope

Prerequisites: prior tasks verified and explicit environment/identity/tenant requirements agreed. Prepare deployment artifacts and validate locally/read-only. Actual provisioning, secret writes, image publication and deployment require explicit user authorization for the concrete target/costs; assignment of preparation alone is not that authorization.

## 3. Components and dependencies

Existing non-root backend image, PostgreSQL migrations/health and CI; proposed Azure Container Apps, PostgreSQL Flexible Server and managed identity/secret storage only after architecture/security/cost review. Use official current Azure documentation; do not add Azure SDKs to application code merely to host it.

## 4. Expected files

Allowed: focused `infra/azure/` configuration and validation scripts chosen for actual target, separate manually triggered deployment workflow without automatic production deployment, architecture/local/operations documentation, this task and progress. Minimal runtime config changes only if concretely needed. Exact manifest before edits.

## 5. Architecture constraints

No cloud provisioning or paid calls during planning/CI. No production exposure until actual authentication, authorization and tenant isolation are implemented in a separate scoped task; no fake security middleware. Least privilege/OIDC, no long-lived production credentials in PR workflows. Explicit migration job/release step, rollback/backup strategy; never run migrations on every web-worker startup.

## 6. Acceptance criteria

- Document chosen region/resources/network/database TLS/secret sources, expected costs, scaling bounds and data retention/backups with assumptions marked.
- Artifacts define separate environment configuration, liveness/readiness probes, non-root image, private database connectivity and explicit migration/release sequence.
- Deployment workflow is manual/environment-protected; PR quality checks require no cloud credentials and publish/provision nothing.
- Document recovery, rollback limitations of schema changes, smoke checks and operational ownership. Surface missing identity/tenant prerequisites as blockers.
- Validate syntax/plans read-only where tools/accounts allow. Do not claim a deployment, protection or resource exists without verification.

## 7. Required unit tests

Only meaningful runtime changes require unit tests. Validate configuration and secret handling without tests that merely mirror wording.

## 8. Required integration tests

Local image/readiness/migration gates remain required. Real cloud smoke only after explicit deployment authorization, with actual results/cost scope reported; no paid cloud dependency in PR CI.

## 9. Verification commands

Run existing frontend/backend gates and Docker build; select/document actual IaC syntax/read-only validation commands for the chosen toolchain. Any future `az` create/deploy/delete/publish command is a separately authorized action, never an automatic completion step.

## 10. Explicitly out of scope

Automatic production deployments, unapproved provisioning/costs, deleting resources/data, secrets committed to Git, architecture rewrite or fake authentication.

## 11. Definition of Done

Concrete deployment artifacts reviewed and validated with clear security prerequisites, operations instructions and factual progress; unperformed cloud actions explicitly unverified. Stop at the authorized boundary.

## 12. Model recommendation

GPT-6.1 Sol Medium for CI/IaC, Sol High for security/identity architecture. Terra/Luna for bounded mechanical follow-ups. No Astra/automatic switching.
