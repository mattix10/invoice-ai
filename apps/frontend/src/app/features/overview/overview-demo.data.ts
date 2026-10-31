import { DEMO_INVOICE } from '../invoices/invoice-demo.data';

export interface OverviewKpi {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}
export interface RecentInvoice {
  readonly id: string;
  readonly vendor: string;
  readonly due: string;
  readonly amountGrosz: number;
  readonly currency?: string;
  readonly status: string;
}
export interface ProcessingVolume {
  readonly month: string;
  readonly value: number;
  readonly heightPercent: number;
}
export interface InvoiceStatus {
  readonly label: string;
  readonly count: number;
  readonly sharePercent: number;
  readonly style: 'review' | 'approved' | 'processing';
}

const processed = 124;
const awaitingReview = 8;
const volume = [
  { month: 'May', value: 67 },
  { month: 'Jun', value: 76 },
  { month: 'Jul', value: 80 },
  { month: 'Aug', value: 91 },
  { month: 'Sep', value: 107 },
  { month: 'Oct', value: processed },
] as const;
const recentInvoices: readonly RecentInvoice[] = [
  {
    id: DEMO_INVOICE.id,
    vendor: DEMO_INVOICE.vendor,
    due: '21 Nov 2026',
    amountGrosz: DEMO_INVOICE.invoiceGrossGrosz,
    status: DEMO_INVOICE.status,
  },
  {
    id: 'INV-2026-1041',
    vendor: 'Riverton Cloud Ltd.',
    due: '19 Nov 2026',
    amountGrosz: 344400,
    status: 'Approved',
  },
  {
    id: 'INV-2026-1040',
    vendor: 'Baltic Logistics Sp. z o.o.',
    due: '18 Nov 2026',
    amountGrosz: 184500,
    status: 'Processing',
  },
  {
    id: 'INV-2026-1039',
    vendor: 'Fieldstone Services',
    due: '16 Nov 2026',
    amountGrosz: 516600,
    status: 'Needs review',
  },
];
const statusLabels = [
  { label: 'Needs review', style: 'review' },
  { label: 'Approved', style: 'approved' },
  { label: 'Processing', style: 'processing' },
] as const;
const invoiceStatuses: readonly InvoiceStatus[] = statusLabels.map(({ label, style }) => {
  const count = recentInvoices.filter((invoice) => invoice.status === label).length;
  return { label, count, sharePercent: (count / recentInvoices.length) * 100, style };
});

export const OVERVIEW_DEMO_DATA = {
  invoice: DEMO_INVOICE,
  differencePercent: (
    (DEMO_INVOICE.differenceGrossGrosz / DEMO_INVOICE.poGrossGrosz) *
    100
  ).toFixed(1),
  additionalReviewCount: awaitingReview - 1,
  kpis: [
    { label: 'Awaiting review', value: String(awaitingReview), detail: 'Invoices awaiting review' },
    { label: 'Approved this month', value: '96', detail: 'October · demo data' },
    { label: 'Processed this month', value: String(processed), detail: 'October · demo data' },
    { label: 'Invoice value · Oct', value: 'PLN 318,740.00', detail: 'October · demo data' },
  ] satisfies readonly OverviewKpi[],
  recentInvoices,
  processingVolume: volume.map(({ month, value }) => ({
    month,
    value,
    heightPercent: (value / processed) * 100,
  })) satisfies readonly ProcessingVolume[],
  processingVolumeLabel: `Synthetic invoice processing volume: ${volume.map(({ month, value }) => `${month} ${value}`).join(', ')}.`,
  processingVolumeNote: { period: 'Oct 2026', count: processed, annotation: 'Demo dataset' },
  invoiceStatuses,
  statusChartLabel: `Visible demo queue: ${invoiceStatuses.map(({ label, count }) => `${count} ${label.toLowerCase()}`).join(', ')}.`,
} as const;
