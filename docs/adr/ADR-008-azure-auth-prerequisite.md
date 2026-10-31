# ADR-008: No public Azure release before authentication and tenant isolation

- **Status:** Proposed — apply to Task 06 and 09.
- **Context:** Local FastAPI currently has unauthenticated routes. Public AI inference and document uploads can leak data or exhaust provider quotas. Azure IaC prep is valuable without creating paid infrastructure.
- **Decision:** Allow syntax/build/CI validation of Bicep and read-only deployment design, but prohibit public deployment of financial endpoints until Task 09 provides OIDC authentication, resource/tenant authorization, safe upload controls and tested production settings. Provisioning/secret changes require separate explicit approval and cost review.
- **Alternatives:** (a) fake local token/stub accepted as production auth rejected; (b) public demo API without auth rejected; (c) automatic paid Azure deployment rejected.
- **Consequences:** Portfolio may first demonstrate local execution and IaC artifacts, not a live production endpoint. Azure cost assumptions must be checked at implementation time, including database and supporting services.
