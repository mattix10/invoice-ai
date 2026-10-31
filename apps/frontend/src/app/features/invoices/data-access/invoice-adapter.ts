import { InvoiceComparisonDto, InvoiceDetailDto, InvoiceSummaryDto } from './invoice-api';

export function minorUnits(value: string): number {
  if (!/^-?\d+\.\d{2}$/.test(value)) throw new Error('Invalid monetary amount');
  const units = BigInt(value.replace('.', ''));
  if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('Monetary amount exceeds safe integer range');
  }

  return Number(units);
}

export function formatInvoiceAmount(value: string, currency: string): string {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid monetary amount');
  const [, sign, integer, fraction] = match;
  const groupedInteger = new Intl.NumberFormat('en-US').format(BigInt(integer));

  return `${sign}${currency}${groupedInteger}.${fraction}`;
}

export const statusLabels = {
  needs_review: 'Needs review',
  approved: 'Approved',
  processing: 'Processing',
} as const;

export function summaryView(invoice: InvoiceSummaryDto): {
  id: string;
  vendor: string;
  due: string;
  amount: string;
  currency: string;
  status: (typeof statusLabels)[keyof typeof statusLabels];
} {
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
    amount: formatInvoiceAmount(invoice.gross_amount, invoice.currency),
    currency: invoice.currency,
    status: statusLabels[invoice.status],
  };
}

export function detailView(
  invoice: InvoiceDetailDto,
  comparison: InvoiceComparisonDto,
): InvoiceWorkspaceView {
  const amount = (value: string): number => minorUnits(value) / 100;

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

export interface InvoiceWorkspaceView {
  invoice: {
    id: string;
    vendor: string;
    purchaseOrder: string;
    issued: string;
    due: string;
    currency: string;
    status: (typeof statusLabels)[keyof typeof statusLabels];
    vatRate: number;
  };
  items: {
    name: string;
    quantity: number;
    invoiceUnitNet: number;
    poUnitNet: number;
    invoiceNet: number;
    poNet: number;
  }[];
  invoiceNet: number;
  invoiceVat: number;
  invoiceGross: number;
  poNet: number;
  poVat: number;
  poGross: number;
  differenceNet: number;
  differenceVat: number;
  differenceGross: number;
  differencePercent: string | null;
}
