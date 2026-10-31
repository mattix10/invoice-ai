# ADR-005: Evidence-first Financial Copilot, Cloudflare as optional provider

- **Status:** Proposed — approve before Task 05b.
- **Context:** Reconciliation already calculates discrepancy and UI already displays it. LLM rewording alone offers low business value. Portfolio requires Generative AI, tool calling, context engineering and structured outputs without paid API billing.
- **Decision:** Add contextual Copilot over read-only service tools; have deterministic code calculate money and validate citations. Local default deterministic `demo`, optional explicit Cloudflare Workers AI provider after model availability/privacy/free-plan verification, `disabled` mode. No silent fallback, no inference in CI and no unauthenticated public live requests.
- **Alternatives:** (a) description-only LLM rejected as redundant; (b) direct LLM SQL rejected as unsafe/unbounded; (c) LangChain multi-agent stack rejected as unnecessary; (d) paid Azure OpenAI postponed; (e) using Codex subscription as application API not supported.
- **Consequences:** Additional validation/tool-loop tests and clear provenance; Cloudflare free quota and external data handling constrain use; adapter makes eventual replacement possible. Do not claim that free plan implies unlimited requests.
- **Decision owner/trigger:** project maintainer; review after first 05e live smoke, when production hosting/real data is considered, or if provider API changes.
