# Local MCP server

Task 08 exposes invoice search, invoice detail and completed reconciliation evidence using
the official Python MCP SDK over stdio. It delegates to the existing invoice services. The
database transaction is read-only and each statement has a five-second timeout. Responses
larger than 100,000 characters are rejected. Search pages contain at most 20 entries and
include a total and an `incomplete` flag. Errors have a code and a safe message.

Run `python -m invoiceflow.mcp_server` from the backend's locked virtual environment with
`DATABASE_URL` set to a local, synthetic-data PostgreSQL database. The client should launch
the process with only the environment required by Windows and the database connection;
do not pass AI provider credentials. Stdout is reserved for MCP messages. An example client
configuration is in `mcp-client.example.json`; replace its paths and connection placeholder
locally and do not commit credentials.

`require_current` rejects stale reconciliation evidence. Currentness is observed at read
time and can change immediately afterward. The server does not run reconciliation or AI
inference. It does not expose an investigation-result tool because investigations are not
persisted. Stdio is not authentication or tenant isolation. A remote service would require
Task 09 identity and tenant-scoped authorization, network security, and rate limits before
any remote transport could be considered. This implementation has no network listener.
