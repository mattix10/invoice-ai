# ADR-009: Read evidence and document-intake compatibility

- **Status:** Accepted for the roadmap; implementation remains pending in Tasks 05a and 07a–07d.
- **Context:** Tasks 01–04 already persist invoice-owned PO snapshots and immutable reconciliation payloads. Copilot/MCP need reads that cannot create financial results. Document intake needs optimistic editing; later independent POs must not erase historical comparison evidence.

## Decisions

1. **Reconciliation reads:** add latest/by-revision GETs over completed persisted results. Latest is greatest completed revision, even if stale. Recompute current canonical fingerprint through the Task 04 calculation/hash routine without a write. Missing/invalid source inputs make historical results non-current. Operations claiming current evidence reject stale/missing results and recheck under the invoice row lock before any persistence. Reads do not call POST reconciliation.
2. **Independent purchase orders:** 07d adds PO, PO items and a versioned invoice link with explicit invoice-line-to-PO-line mapping. Keep existing legacy snapshots as immutable audit inputs; materialize validated links into append-only invoice-ordered snapshot versions for the established calculator. Old reconciliations keep their v1 hash/payload; new snapshots use a v2 fingerprint containing source snapshot ID and record that ID on the reconciliation row. Preserve old rows/results and use an explicit reversible backfill for known demo facts. A PO update increments PO version; refreshing a link/snapshot is an explicit locked operation. No guessed PO or receipt.
3. **Versioned drafts:** 07a uses full-representation `PUT` with `expected_revision`, atomic increment and 409 conflict. Partial values are allowed within the complete field set. 07c extraction suggestions are separate read data; only selected suggestions merge locally and save through the same PUT. Human edits survive extraction completion and rejected suggestions.
4. **Evidence resolution:** the backend issues structured, persisted `EvidenceReference` values, not model URLs. The frontend maps valid kinds to existing invoice, comparison and investigation destinations; invalid/unsupported references have no link. Receipt reference strings do not imply stored receipt documents. A future PO page may extend the resolver without changing old evidence IDs.

## Consequences and checks

Read currentness is a point-in-time fact and needs a final locked recheck for persisted claims. Snapshot history requires a reviewed migration because the existing invoice-owned snapshot has a single-row primary key. The 07a draft contract is independently usable without OCR, AI or PO; 07b adds image intake, 07c adds suggestions, and 07d adds PO linkage. Validate missing/stale revisions, historical reads, no read-side writes, reordered PO positions, PO edits, draft conflicts and forged evidence against real PostgreSQL where persistence is involved. Task 09 remains the gate for public access.
