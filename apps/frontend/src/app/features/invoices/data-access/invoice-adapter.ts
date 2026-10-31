import { InvoiceComparisonDto, InvoiceDetailDto, InvoiceSummaryDto } from './invoice-api';

export function minorUnits(value: string): number {
  if (!/^-?\d+\.\d{2}$/.test(value)) throw new Error('Invalid monetary amount');
  const units = BigInt(value.replace('.', ''));
  if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('Monetary amount exceeds safe integer range');
  }
  return Number(units);
}

export const statusLabels = {
  needs_review: 'Needs review',
  approved: 'Approved',
  processing: 'Processing',
} as const;

export function summaryView(invoice: InvoiceSummaryDto) {
  const [year, month, day] = invoice.due.split('-').map(Number);
  return {
    id: invoice.id,
    vendor: invoice.vendor,
    due: new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day))),
    amountGrosz: minorUnits(invoice.gross_amount),
    currency: invoice.currency,
    status: statusLabels[invoice.status],
  };
}

export function detailView(invoice: InvoiceDetailDto, comparison: InvoiceComparisonDto) {
  const amount = (value: string) => minorUnits(value) / 100;
  return {
    invoice: {
      id: invoice.id,
      vendor: invoice.vendor,
      purchaseOrder: invoice.purchase_order ?? 'Unavailable',
      issued: invoice.issued ?? 'Unavailable',
      due: invoice.due,
      currency: invoice.currency,
      status: statusLabels[invoice.status],
      vatRate: Number(comparison.vat_rate) * 100,
    },
    items: comparison.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      invoiceUnitNet: amount(item.invoice_unit_net),
      poUnitNet: amount(item.po_unit_net),
      invoiceNet: amount(item.invoice_net),
      poNet: amount(item.po_net),
    })),
    invoiceNet: amount(comparison.invoice_totals.net),
    invoiceVat: amount(comparison.invoice_totals.vat),
    invoiceGross: amount(comparison.invoice_totals.gross),
    poNet: amount(comparison.po_totals.net),
    poVat: amount(comparison.po_totals.vat),
    poGross: amount(comparison.po_totals.gross),
    differenceNet: amount(comparison.difference.net),
    differenceVat: amount(comparison.difference.vat),
    differenceGross: amount(comparison.difference.gross),
    differencePercent: comparison.difference_percent,
  };
}

export type InvoiceWorkspaceView = ReturnType<typeof detailView>;
