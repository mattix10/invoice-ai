import { detailView, formatInvoiceAmount, minorUnits, summaryView } from './invoice-adapter';

describe('invoice adapter', () => {
  it('should preserve every decimal digit when formatting a large amount', () => {
    // Arrange
    const amount = '100000000000000.01';

    // Act
    const formatted = formatInvoiceAmount(amount, 'PLN');

    // Assert
    expect(formatted).toBe('PLN100,000,000,000,000.01');
  });

  it('preserves exact minor units and rejects unsafe or malformed values', () => {
    expect(minorUnits('12915.00')).toBe(1291500);
    expect(minorUnits('-615.00')).toBe(-61500);
    expect(() => minorUnits('90071992547409.92')).toThrow();
    expect(() => minorUnits('1.001')).toThrow();
  });

  it('should map a large invoice amount without losing precision', () => {
    // Arrange
    const invoice = {
      id: 'large',
      vendor: 'Vendor',
      due: '2026-11-21',
      currency: 'PLN',
      status: 'needs_review' as const,
      grossAmount: '100000000000000.01',
    };

    // Act
    const view = summaryView(invoice);

    // Assert
    expect(view.amount).toBe('PLN100,000,000,000,000.01');
  });

  it('maps status, ISO date and currency', () => {
    expect(
      summaryView({
        id: 'INV-2026-1042',
        vendor: 'Vendor',
        due: '2026-11-21',
        currency: 'PLN',
        status: 'needs_review',
        grossAmount: '12915.00',
      }),
    ).toEqual({
      id: 'INV-2026-1042',
      vendor: 'Vendor',
      due: '21 Nov 2026',
      currency: 'PLN',
      status: 'Needs review',
      amount: 'PLN12,915.00',
    });
  });

  it('maps canonical totals and the fractional VAT rate', () => {
    const summary = {
      id: 'INV-2026-1042',
      vendor: 'Vendor',
      due: '2026-11-21',
      currency: 'PLN',
      status: 'needs_review' as const,
      grossAmount: '12915.00',
    };
    const detail = {
      ...summary,
      issued: '2026-10-22',
      purchaseOrder: 'PO-2026-0871',
      vatRate: '0.2300',
      items: [],
      totals: null,
    };
    const totals = { net: '10500.00', vat: '2415.00', gross: '12915.00' };
    const comparison = {
      invoiceId: summary.id,
      purchaseOrder: 'PO-2026-0871',
      deliveryReceiptId: null,
      currency: 'PLN',
      vatRate: '0.2300',
      items: [],
      invoiceTotals: totals,
      poTotals: { net: '10000.00', vat: '2300.00', gross: '12300.00' },
      difference: { net: '500.00', vat: '115.00', gross: '615.00' },
      differencePercent: '5.0',
    };
    const result = detailView(detail, comparison);
    expect(result.invoice.vatRate).toBe(23);
    expect(result.invoiceGross).toBe(12915);
    expect(result.differenceGross).toBe(615);
    expect(result.differencePercent).toBe('5.0');
  });

  it('preserves both quantities from a linked comparison', () => {
    const totals = { net: '8200.00', vat: '1886.00', gross: '10086.00' };
    const view = detailView(
      {
        id: 'INV-2026-1042',
        vendor: 'Vendor',
        due: '2026-11-21',
        currency: 'PLN',
        status: 'needs_review',
        grossAmount: totals.gross,
        issued: null,
        purchaseOrder: 'PO-1',
        vatRate: '0.23',
        items: [],
        totals,
      },
      {
        invoiceId: 'INV-2026-1042',
        purchaseOrder: 'PO-1',
        deliveryReceiptId: null,
        currency: 'PLN',
        vatRate: '0.23',
        items: [
          {
            position: 1,
            name: 'Monitor',
            quantity: 10,
            poQuantity: 5,
            invoiceUnitNet: '820.00',
            poUnitNet: '820.00',
            invoiceNet: '8200.00',
            poNet: '4100.00',
          },
        ],
        invoiceTotals: totals,
        poTotals: { net: '4100.00', vat: '943.00', gross: '5043.00' },
        difference: { net: '4100.00', vat: '943.00', gross: '5043.00' },
        differencePercent: '100.0',
      },
    );

    expect(view.items[0]).toEqual(expect.objectContaining({ quantity: 10, poQuantity: 5 }));
  });
});
