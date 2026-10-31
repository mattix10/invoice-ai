# Task 09 — Identity, authorization and tenant boundaries for public access

**Status:** required security gate before public deployment; not implemented.
**Business objective:** ensure no unrelated user can read or upload another company's invoices, invoke expensive inference, retrieve OCR files, or access MCP tools.

## Prerequisites

Task 02/04 data service and relevant 05/07 endpoints exist; auth design must account for created objects. Task 06 public provisioning remains blocked until reviewed security and rollout. Avoid adding fake `current_user=demo` shims that are misrepresented as production auth.

## Decisions to document first

- Identity provider (suggest Microsoft Entra External ID or other OIDC compliant provider after account/cost/UX review; **do not assume a free plan**), tenant concept, local dev test identity strategy, OAuth2/OIDC flows for SPA, audience/issuer/JWKS verification, token expiry/revocation behavior, claim mapping.
- Authorizations: `viewer` (read), `analyst` (initiate investigations/ingest drafts), `reviewer` (confirm corrected extraction), `admin` (tenant configuration) as proposed; no approvals/payment permission invented.
- Query scoping: every invoice/PO/reconciliation/document/investigation result bound to tenant; migration and backfill plan for existing synthetic records, no implicit cross-tenant reads.
- Cloudflare token/AI quotas per tenant, audit events, incident handling and privacy retention.

## Acceptance criteria

- Every protected endpoint denies unauthorized callers with documented 401/403; cross-tenant IDs yield safe non-disclosing result (404/403 based on consistently documented policy).
- SQL row filtering and storage object access scoped to authorized tenant, including AI tool calls and future remote MCP; no solely UI-based gate.
- Separate tests for forged token, expired token, wrong audience, missing scope, user switching tenants, malicious file path and forbidden AI inference.
- Local demo remains usable in an explicitly isolated dev mode and cannot leak into staging/prod configuration.
- All auth and migration changes reviewed; data model changes with Alembic, real PostgreSQL isolation tests and Angular auth UI tests; secrets and identity errors not logged.

## Out of scope

Actual production deployment, handling real sensitive customer data, issuing a fake bearer token in production, enabling remote MCP by default. **Model:** Sol High architecture/security, Sol Medium implementation, Terra bounded UI. **Stop after 09.**
