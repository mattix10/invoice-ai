import { detailView, minorUnits, summaryView } from './invoice-adapter';

describe('invoice adapter', () => {
  it('preserves exact minor units and rejects unsafe or malformed values', () => {
    expect(minorUnits('12915.00')).toBe(1291500);
    expect(minorUnits('-615.00')).toBe(-61500);
    expect(() => minorUnits('90071992547409.92')).toThrow();
    expect(() => minorUnits('1.001')).toThrow();
  });
  it('maps status, ISO date and currency', () => {
    expect(
      summaryView({
        id: 'INV-2026-1042',
        vendor: 'Vendor',
        due: '2026-11-21',
        currency: 'PLN',
        status: 'needs_review',
        gross_amount: '12915.00',
      }),
    ).toEqual({
      id: 'INV-2026-1042',
      vendor: 'Vendor',
      due: '21 Nov 2026',
      currency: 'PLN',
      status: 'Needs review',
      amountGrosz: 1291500,
    });
  });
  it('maps canonical totals and the fractional VAT rate', () => {
    const summary = {
      id: 'INV-2026-1042',
      vendor: 'Vendor',
      due: '2026-11-21',
      currency: 'PLN',
      status: 'needs_review' as const,
      gross_amount: '12915.00',
    };
    const detail = {
      ...summary,
      issued: '2026-10-22',
      purchase_order: 'PO-2026-0871',
      vat_rate: '0.2300',
      items: [],
      totals: null,
    };
    const totals = { net: '10500.00', vat: '2415.00', gross: '12915.00' };
    const comparison = {
      invoice_id: summary.id,
      purchase_order: 'PO-2026-0871',
      delivery_receipt_id: null,
      currency: 'PLN',
      vat_rate: '0.2300',
      items: [],
      invoice_totals: totals,
      po_totals: { net: '10000.00', vat: '2300.00', gross: '12300.00' },
      difference: { net: '500.00', vat: '115.00', gross: '615.00' },
      difference_percent: '5.0',
    };
    const result = detailView(detail, comparison);
    expect(result.invoice.vatRate).toBe(23);
    expect(result.invoiceGross).toBe(12915);
    expect(result.differenceGross).toBe(615);
    expect(result.differencePercent).toBe('5.0');
  });
});
