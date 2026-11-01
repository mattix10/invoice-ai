import {
  detailView,
  formatInvoiceAmount,
  formatMinorAmount,
  minorUnits,
  summaryView,
} from './invoice-adapter';

describe('invoice adapter', () => {
  it('should preserve every decimal digit when formatting a large amount', () => {
    // Arrange
    const amount = '100000000000000.01';

    // Act
    const formatted = formatInvoiceAmount(amount, 'PLN');

    // Assert
    expect(formatted).toBe('100\u00a0000\u00a0000\u00a0000\u00a0000,01\u00a0zł');
    expect(formatInvoiceAmount('18.70', 'EUR')).toBe('18,70\u00a0€');
    expect(formatInvoiceAmount('18.70', 'USD')).toBe('18,70\u00a0$');
    expect(formatMinorAmount(61500, 'PLN')).toBe('615,00\u00a0zł');
  });

  it('preserves exact minor units and rejects unsafe or malformed values', () => {
    // Act and Assert
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
    // Act
    const view = summaryView(invoice);

    // Assert
    expect(view.amount).toBe('100\u00a0000\u00a0000\u00a0000\u00a0000,01\u00a0zł');
  });

  it('maps status, ISO date and currency', () => {
    // Act and Assert
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
      amount: '12\u00a0915,00\u00a0zł',
    });
  });

  it('maps canonical totals and the fractional VAT rate', () => {
    // Arrange
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

    // Assert
    expect(result.invoice.vatRate).toBe(23);
    expect(result.invoiceGross).toBe(12915);
    expect(result.differenceGross).toBe(615);
    expect(result.differencePercent).toBe('5.0');
  });

  it('preserves both quantities from a linked comparison', () => {
    // Arrange
    const totals = { net: '8200.00', vat: '1886.00', gross: '10086.00' };

    // Act
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

    // Assert
    expect(view.items[0]).toEqual(expect.objectContaining({ quantity: 10, poQuantity: 5 }));
  });
});
