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

export const INVOICE_WORKSPACE_DATA = {
  invoice: DEMO_INVOICE,
  deliveryReceiptId: 'DR-2026-1042',
  differencePercent: (DEMO_INVOICE.differenceGrossGrosz / DEMO_INVOICE.poGrossGrosz) * 100,
  items: DEMO_INVOICE.items.map((item, index) => ({
    ...item,
    position: index + 1,
    poQuantity: item.quantity,
    invoiceUnitNet: item.invoiceUnitNetGrosz / 100,
    poUnitNet: item.poUnitNetGrosz / 100,
    invoiceNet: (item.quantity * item.invoiceUnitNetGrosz) / 100,
    poNet: (item.quantity * item.poUnitNetGrosz) / 100,
  })),
  invoiceNet: DEMO_INVOICE.invoiceNetGrosz / 100,
  invoiceVat: DEMO_INVOICE.invoiceVatGrosz / 100,
  invoiceGross: DEMO_INVOICE.invoiceGrossGrosz / 100,
  poNet: DEMO_INVOICE.poNetGrosz / 100,
  poVat: DEMO_INVOICE.poVatGrosz / 100,
  poGross: DEMO_INVOICE.poGrossGrosz / 100,
  differenceNet: DEMO_INVOICE.differenceNetGrosz / 100,
  differenceVat: DEMO_INVOICE.differenceVatGrosz / 100,
  differenceGross: DEMO_INVOICE.differenceGrossGrosz / 100,
  monitorUnitDifference:
    (DEMO_INVOICE.items[0].invoiceUnitNetGrosz - DEMO_INVOICE.items[0].poUnitNetGrosz) / 100,
};
