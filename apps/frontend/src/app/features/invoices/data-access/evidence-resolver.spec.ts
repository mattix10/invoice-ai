import type { EvidenceReference, ReconciliationRead } from '../../../core/api/schema';
import { resolveEvidence } from './evidence-resolver';

describe('resolveEvidence', () => {
  const ref: EvidenceReference = {
    kind: 'discrepancy_line',
    invoiceId: 'INV-2026-1042',
    reconciliationRevision: 2,
    linePosition: 1,
    evidenceId: 'invoice:INV-2026-1042:reconciliation:2:line:1',
    label: 'Difference line 1',
  };
  const record = {
    revision: 2,
    isCurrent: true,
    result: { invoiceId: 'INV-2026-1042', lines: [{ position: 1 }] },
    evidenceRefs: [ref],
  } as ReconciliationRead;

  it('links verified lines to their revision and line', () => {
    // Act and Assert
    expect(resolveEvidence(ref, record)).toMatchObject({
      commands: ['/invoices', 'INV-2026-1042', 'investigation'],
      queryParams: { revision: 2, line: 1 },
      fragment: 'line-1',
      historical: false,
    });
  });

  it('does not link forged references or missing records', () => {
    // Act and Assert
    expect(
      resolveEvidence({ ...ref, evidenceId: 'https://example.com' }, record).commands,
    ).toBeNull();
    expect(resolveEvidence(ref, null).commands).toBeNull();
    expect(resolveEvidence({ ...ref, linePosition: 99 }, record).commands).toBeNull();
  });

  it('marks verified historical evidence', () => {
    // Act and Assert
    expect(resolveEvidence(ref, { ...record, isCurrent: false }).historical).toBe(true);
  });

  it('links a canonical selected invoice citation without a reconciliation', () => {
    // Arrange
    const invoice: EvidenceReference = {
      ...ref,
      kind: 'invoice',
      reconciliationRevision: null,
      linePosition: null,
      evidenceId: 'invoice:INV-2026-1042',
    };

    // Act and Assert
    expect(resolveEvidence(invoice, null, 'INV-2026-1042').commands).toEqual([
      '/invoices',
      'INV-2026-1042',
    ]);
    expect(
      resolveEvidence({ ...invoice, evidenceId: 'https://example.com' }, null, 'INV-2026-1042')
        .commands,
    ).toBeNull();
    expect(resolveEvidence(invoice, null, 'INV-2026-9999').commands).toBeNull();
  });

  it('links a verified current PO line but not a historical snapshot to current comparison', () => {
    // Arrange
    const po: EvidenceReference = {
      ...ref,
      kind: 'po_line',
      evidenceId: 'invoice:INV-2026-1042:po-snapshot:legacy:line:1',
    };
    const poRecord = { ...record, evidenceRefs: [po] };

    // Act and Assert
    expect(resolveEvidence(po, poRecord)).toMatchObject({
      queryParams: { line: 1 },
      fragment: 'comparison-line-1',
    });
    expect(resolveEvidence(po, { ...poRecord, isCurrent: false }).commands).toBeNull();
  });
});
