# Task 06 — Azure IaC and guarded deployment preparation (revised)

**Status:** planning; **no cloud resources may be created by this task without explicit separate authorization.**
**Business goal:** demonstrate repeatable, reviewable operations and a clear path from local Docker to Azure without pretending an unauthenticated demo is production-ready.

## Prerequisites and order

- Existing Angular and FastAPI health/API tests and Docker builds verified; documented migration lifecycle.
- IaC **preparation only** may occur before 07–09, but a publicly accessible deployment of financial APIs, uploads, AI inference, or MCP is **blocked until Task 09 authentication/authorization and suitable upload controls are complete and tested**.
- Separate user approval needed for subscription, region, cost ceiling, resource creation, secret changes, DNS, image publishing, production deployment, or delete.
- Current repository default branch is `master`; workflows must not assume `main`.

## Chosen direction (proposed until cost/security review)

- Angular static frontend: Azure Static Web Apps (verify eligibility/cost and deployment constraints) or equivalent documented option.
- FastAPI: Azure Container Apps (non-root image, probes, min/max replicas appropriately bounded).
- PostgreSQL: Azure Database for PostgreSQL Flexible Server; private or tightly controlled network access, TLS, migrations executed as explicit release job.
- Container images: Azure Container Registry if justified; evaluate cost; least-privilege image pulls.
- Credentials: Managed Identity, Key Vault where needed; no secrets in IaC/GitHub; GitHub-to-Azure OIDC federation; no long-lived Azure password in PR workflows.
- Observability: minimal structured metrics/logs, redaction; evaluate Application Insights costs, never log invoice files/prompts/private evidence.
- AI: Cloudflare remains optional external provider; no paid Azure OpenAI provisioning and no live default. Outbound egress/privacy assessment required.

## Deliverables

1. `docs/operations/azure-deployment.md`: architecture diagram (Mermaid/C4), exact env, region choice, resources, estimated *monthly* costs and separate variable-cost scenarios (prices verified at implementation), privacy, backups/restore, observability, network diagram and threat model.
2. `docs/adr/ADR-00x-azure-hosting.md` or reference existing; record tradeoffs (Bicep vs Terraform; choose Bicep for Azure-only project unless new data changes this).
3. `infra/azure/` modular Bicep files for proposed infrastructure and `dev/staging` parameter sets with placeholder, non-secret values. Don't create every resource in the initial commit if not required; minimal reviewable components.
4. `.github/workflows/azure-validate.yml` runs **read-only lint/build** on PRs with no Azure credentials. Separate manually triggered/environment-protected deployment workflow may be scaffolded but disabled/not credentialed until approved.
5. Migration/rollback runbook: forward-compatible DB migrations, backup/restore, explicit release step, version rollback limits, post-deploy smoke and cleanup cost controls.

## Architecture and policy

- No `az deployment create` / `az group create` / role assignment / secret put / DNS edits / image publish by default. This task's definition of done is **validated artifacts**, not public deployment.
- No authentication placeholders or dummy identity accepted as security. Block routes or make environment not publicly reachable until Task 09; the SPA being static doesn't authorize the API.
- Restrict ingress/CORS appropriately, protect PostgreSQL and secrets, cap processing/upload concurrency and model quota, avoid accidentally setting `AI_PROVIDER=cloudflare` in public staging.
- No automatic destructive DB migration on backend startup; use controlled migration job with explicit backup/rollback plan.
- Build image and Bicep without live Azure credentials; report tool version and actual validation results.

## Acceptance criteria

- IaC compiles/lints locally and in PR CI with no Azure secrets; all included resources trace to documented cost assumptions; no accidental paid provisioning.
- Environments and future public restrictions are explicit; identity/tenant prerequisite is documented as **blocking**.
- Existing Compose and CI unaffected, root `master` branch respected.
- Failures and recovery described; code review can inspect IAM/network/backups and not guess the deployment.

## Tests and verification

Use `az bicep build` / `az bicep lint` if installed; if no CLI, document blocker and only run available static checks. Keep existing backend pytest/real PostgreSQL migrations and Angular Vitest/build checks. No live cloud smoke without separate opt-in. Do not claim protected environment is configured if only YAML exists.

## Out of scope

Provisioning paid services, public deployment, DNS, production secrets, actual Azure OpenAI usage, live data migration, and bypassing Task 09. **Model:** Sol Medium IaC, Sol High security review. **Stop after Task 06.**
