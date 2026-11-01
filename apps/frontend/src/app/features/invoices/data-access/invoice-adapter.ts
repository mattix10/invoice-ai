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
  const groupedInteger = BigInt(integer)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const symbols: Record<string, string> = { PLN: 'zł', EUR: '€', USD: '$' };
  const symbol = symbols[currency] ?? currency;

  return `${sign}${groupedInteger},${fraction}\u00a0${symbol}`;
}

export function formatWorkspaceAmount(value: number, currency: string): string {
  if (!Number.isFinite(value)) throw new Error('Invalid monetary amount');

  return formatInvoiceAmount(value.toFixed(2), currency);
}

export function formatMinorAmount(value: number, currency: string): string {
  if (!Number.isSafeInteger(value)) throw new Error('Invalid monetary amount');

  const minor = BigInt(value);
  const absolute = minor < 0n ? -minor : minor;

  return formatInvoiceAmount(
    `${minor < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`,
    currency,
  );
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
    amount: formatInvoiceAmount(invoice.grossAmount, invoice.currency),
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
      purchaseOrder: comparison.purchaseOrder,
      issued: invoice.issued ?? 'Unavailable',
      due: invoice.due,
      currency: invoice.currency,
      status: statusLabels[invoice.status],
      vatRate: Number(comparison.vatRate) * 100,
    },
    items: comparison.items.map((item) => ({
      position: item.position,
      name: item.name,
      quantity: item.quantity,
      poQuantity: item.poQuantity ?? null,
      invoiceUnitNet: amount(item.invoiceUnitNet),
      poUnitNet: amount(item.poUnitNet),
      invoiceNet: amount(item.invoiceNet),
      poNet: amount(item.poNet),
    })),
    invoiceNet: amount(comparison.invoiceTotals.net),
    invoiceVat: amount(comparison.invoiceTotals.vat),
    invoiceGross: amount(comparison.invoiceTotals.gross),
    poNet: amount(comparison.poTotals.net),
    poVat: amount(comparison.poTotals.vat),
    poGross: amount(comparison.poTotals.gross),
    differenceNet: amount(comparison.difference.net),
    differenceVat: amount(comparison.difference.vat),
    differenceGross: amount(comparison.difference.gross),
    differencePercent: comparison.differencePercent,
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
    position: number;
    name: string;
    quantity: number;
    poQuantity: number | null;
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
