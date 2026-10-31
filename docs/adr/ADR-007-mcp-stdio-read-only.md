# ADR-007: Local-first, read-only MCP over existing application services

- **Status:** Proposed — approve before Task 08.
- **Context:** Portfolio should demonstrate MCP integration without duplicating financial logic or prematurely exposing customer data.
- **Decision:** Official Python MCP SDK v2, local stdio transport first, typed read-only functions using existing invoice/reconciliation services. No arbitrary SQL, HTTP public endpoint or write/payment tools. `get_investigation_result` only if persistence exists.
- **Alternatives:** (a) public Streamable HTTP postponed until identity/network security; (b) duplicate code in MCP rejected; (c) model/API-assisted MCP generation rejected as unnecessary and potentially costly.
- **Consequences:** Works with compatible local AI clients but not remotely until Task 09. Need client handshake tests, tool schema compatibility, output bounds, and no stdout logging.
