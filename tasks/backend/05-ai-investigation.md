# Backend 05 — Evidence-backed investigation foundation

## 1. Business objective

Provide traceable investigation recommendations grounded in actual reconciliation evidence, while keeping humans responsible for financial decisions.

## 2. Technical scope

Prerequisite: Task 04 verified. Implement one investigation use case with a clearly labelled deterministic demonstration provider and a narrow replaceable provider boundary. No paid/live model calls by default. A real provider requires separately authorized credentials, costs and privacy requirements.

## 3. Components and dependencies

Reuse invoices/reconciliation results. Add focused investigation orchestration, validated output/provenance schema and persistence only for actual saved results. No multi-agent framework, broker or provider SDK without concrete approval/justification.

## 4. Expected files

Allowed: `apps/backend/src/invoiceflow/modules/investigations/` with exact files defined after inspecting existing modules; minimal router registration, migration if persisting results, backend tests, API/backend/database/local docs, this task and progress. No frontend rewrite or unrelated infrastructure.

## 5. Architecture constraints

Provider interface takes bounded structured evidence, returns validated structured recommendation; orchestration contains no HTTP/provider transport details. No private chain-of-thought logging. Evidence references must resolve to supplied persisted facts. Demo output must say demo; disabled provider is an explicit unavailable state, not a fake live AI success.

## 6. Acceptance criteria

- Specify and encode create/read investigation HTTP DTOs, bounded input, evidence IDs, generation mode, provider/version/time metadata and errors in OpenAPI before wiring endpoints.
- Canonical explanation cites invoice/PO/delivery evidence and exact 615.00 discrepancy; recommendation is request supplier confirmation, not approval/payment.
- Reject unsupported evidence references or inconsistent amounts; no invented confidence scores. Recommendation requires human review and does not contact vendors.
- Disabled/live-provider-not-configured state is explicit; tests use deterministic provider doubles and never real credentials/costs. Repeated operation/idempotency and persisted provenance are documented.
- Treat document text as untrusted data; it cannot override instructions, call tools or authorize external actions. Bound stored/output sizes and return safe provider failures.

## 7. Required unit tests

Evidence resolution, canonical factual output, invalid/hallucinated evidence, incorrect amounts, disabled provider, timeout/failure/invalid schema, untrusted instruction text and no automatic decision/action.

## 8. Required integration tests

Real PostgreSQL investigation/provenance/result linkage and isolation, unknown invoice/result, safe errors and idempotency. HTTP tests use deterministic provider override. Migration round trip/check if schema changes. No network/paid calls in CI.

## 9. Verification commands

Backend locked install, Ruff, full unit/integration suites, Alembic upgrade/check, Docker image and local HTTP smoke with explicitly labelled demo provider. Inspect OpenAPI and stored evidence references; confirm no secret/raw private reasoning in responses/logs.

## 10. Explicitly out of scope

Paid inference, autonomous vendor messaging/actions, approvals/payments, general chatbot/MCP/multi-agent framework, frontend redesign and Azure deployment. Do not begin 06.

## 11. Definition of Done

Auditable evidence-backed demo investigation works and is unmistakably labelled, provider boundary validated without paid calls, quality gates pass, progress/final diff reviewed. Real model integration remains a separately authorized follow-up.

## 12. Model recommendation

GPT-6.1 Sol High for evidence, security and orchestration design; Sol Medium for routine persistence. No Astra/automatic switching.
