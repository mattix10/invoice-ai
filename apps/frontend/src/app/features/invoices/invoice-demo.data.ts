import { type InvoiceWorkspaceView } from './data-access/invoice-adapter';

export interface DemoInvoice {
  readonly id: string;
  readonly vendor: string;
  readonly purchaseOrder: string;
  readonly issued: string;
  readonly due: string;
  readonly currency: 'PLN';
  readonly status: 'Needs review';
  readonly vatRate: number;
  readonly items: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly invoiceUnitNetGrosz: number;
    readonly poUnitNetGrosz: number;
  }[];
  readonly invoiceNetGrosz: number;
  readonly invoiceVatGrosz: number;
  readonly invoiceGrossGrosz: number;
  readonly poNetGrosz: number;
  readonly poVatGrosz: number;
  readonly poGrossGrosz: number;
  readonly differenceNetGrosz: number;
  readonly differenceVatGrosz: number;
  readonly differenceGrossGrosz: number;
}
export const DEMO_INVOICE: DemoInvoice = {
  id: 'INV-2026-1042',
  vendor: 'Northline Office Sp. z o.o.',
  purchaseOrder: 'PO-2026-0871',
  issued: '2026-10-22',
  due: '2026-11-21',
  currency: 'PLN',
  status: 'Needs review',
  vatRate: 23,
  items: [
    { name: '27-inch monitor', quantity: 10, invoiceUnitNetGrosz: 82000, poUnitNetGrosz: 77000 },
    { name: 'Keyboard', quantity: 10, invoiceUnitNetGrosz: 11000, poUnitNetGrosz: 11000 },
    {
      name: 'USB-C docking station',
      quantity: 5,
      invoiceUnitNetGrosz: 24000,
      poUnitNetGrosz: 24000,
    },
  ],
  invoiceNetGrosz: 1050000,
  invoiceVatGrosz: 241500,
  invoiceGrossGrosz: 1291500,
  poNetGrosz: 1000000,
  poVatGrosz: 230000,
  poGrossGrosz: 1230000,
  differenceNetGrosz: 50000,
  differenceVatGrosz: 11500,
  differenceGrossGrosz: 61500,
};

function demoAmount(minor: number): string {
  const units = BigInt(minor);

  return `${units / 100n}.${String(units % 100n).padStart(2, '0')}`;
}

export const INVOICE_WORKSPACE_DATA = {
  invoice: DEMO_INVOICE,
  deliveryReceiptId: 'DR-2026-1042',
  differencePercent: String((DEMO_INVOICE.differenceGrossGrosz / DEMO_INVOICE.poGrossGrosz) * 100),
  items: DEMO_INVOICE.items.map((item, index) => ({
    ...item,
    position: index + 1,
    poQuantity: item.quantity,
    invoiceUnitNet: demoAmount(item.invoiceUnitNetGrosz),
    poUnitNet: demoAmount(item.poUnitNetGrosz),
    invoiceNet: demoAmount(item.quantity * item.invoiceUnitNetGrosz),
    poNet: demoAmount(item.quantity * item.poUnitNetGrosz),
  })),
  invoiceNet: demoAmount(DEMO_INVOICE.invoiceNetGrosz),
  invoiceVat: demoAmount(DEMO_INVOICE.invoiceVatGrosz),
  invoiceGross: demoAmount(DEMO_INVOICE.invoiceGrossGrosz),
  poNet: demoAmount(DEMO_INVOICE.poNetGrosz),
  poVat: demoAmount(DEMO_INVOICE.poVatGrosz),
  poGross: demoAmount(DEMO_INVOICE.poGrossGrosz),
  differenceNet: demoAmount(DEMO_INVOICE.differenceNetGrosz),
  differenceVat: demoAmount(DEMO_INVOICE.differenceVatGrosz),
  differenceGross: demoAmount(DEMO_INVOICE.differenceGrossGrosz),
} satisfies InvoiceWorkspaceView & { deliveryReceiptId: string };
