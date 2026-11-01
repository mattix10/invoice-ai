import type { EvidenceReference, ReconciliationRead } from '../../../core/api/schema';

export interface EvidenceDestination {
  reference: EvidenceReference;
  commands: string[] | null;
  queryParams?: Record<string, string | number>;
  fragment?: string;
  historical: boolean;
}

function isSelectedInvoice(reference: EvidenceReference, invoiceId: string): boolean {
  return (
    reference.kind === 'invoice' &&
    reference.invoiceId === invoiceId &&
    reference.reconciliationRevision === null &&
    reference.linePosition === null &&
    reference.evidenceId === `invoice:${invoiceId}`
  );
}

function isRecordedReference(reference: EvidenceReference, record: ReconciliationRead): boolean {
  return (
    reference.invoiceId === record.result.invoiceId &&
    reference.reconciliationRevision === record.revision &&
    record.evidenceRefs.some(
      (candidate) =>
        candidate.kind === reference.kind &&
        candidate.evidenceId === reference.evidenceId &&
        candidate.invoiceId === reference.invoiceId &&
        candidate.reconciliationRevision === reference.reconciliationRevision &&
        candidate.linePosition === reference.linePosition,
    )
  );
}

function hasRecordedLine(reference: EvidenceReference, record: ReconciliationRead): boolean {
  const position = reference.linePosition;

  return (
    position !== null &&
    Number.isSafeInteger(position) &&
    position > 0 &&
    record.result.lines.some((line) => line.position === position)
  );
}

export function resolveEvidence(
  reference: EvidenceReference,
  record: ReconciliationRead | null,
  selectedInvoiceId = record?.result.invoiceId ?? '',
): EvidenceDestination {
  const unresolved: EvidenceDestination = { reference, commands: null, historical: false };
  if (isSelectedInvoice(reference, selectedInvoiceId)) {
    return { reference, commands: ['/invoices', selectedInvoiceId], historical: false };
  }

  if (!record || !isRecordedReference(reference, record)) return unresolved;

  const historical = !record.isCurrent;
  const invoice = ['/invoices', reference.invoiceId];

  if (reference.kind === 'invoice') return { reference, commands: invoice, historical };

  if (reference.kind === 'po_snapshot' && record.isCurrent) {
    return { reference, commands: invoice, fragment: 'comparison', historical };
  }

  if ((reference.kind === 'invoice_line' || reference.kind === 'po_line') && record.isCurrent) {
    const position = reference.linePosition;

    if (position !== null && hasRecordedLine(reference, record)) {
      return {
        reference,
        commands: invoice,
        queryParams: { line: position },
        fragment: `comparison-line-${position}`,
        historical,
      };
    }
  }

  if (reference.kind === 'reconciliation' || reference.kind === 'discrepancy_line') {
    const position = reference.linePosition;

    if (reference.kind === 'discrepancy_line' && !hasRecordedLine(reference, record))
      return unresolved;

    return {
      reference,
      commands: [...invoice, 'investigation'],
      queryParams:
        position === null
          ? { revision: record.revision }
          : { revision: record.revision, line: position },
      fragment: position === null ? 'reconciliation' : `line-${position}`,
      historical,
    };
  }

  return { ...unresolved, historical };
}
