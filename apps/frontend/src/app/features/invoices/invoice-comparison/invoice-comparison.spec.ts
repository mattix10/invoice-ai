import { TestBed } from '@angular/core/testing';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvoiceComparison } from './invoice-comparison';

describe('InvoiceComparison', () => {
  it('keeps totals available in a disclosure', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceComparison);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const totals = element.querySelector('details') as HTMLDetailsElement;

    // Assert
    expect(totals.open).toBe(false);

    // Act
    totals.querySelector('summary')?.click();

    // Assert
    expect(totals.open).toBe(true);
    expect(totals.textContent).toContain('PLN12,915.00');
  });

  it('should display the invoice and purchase order totals for each amount', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceComparison);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();

    // Assert
    const table = (fixture.nativeElement as HTMLElement).querySelector(
      '[aria-label="Invoice and purchase order totals"]',
    );
    const rows = Array.from(table!.querySelectorAll('tbody tr'), (row) =>
      Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['Net', 'PLN10,500.00', 'PLN10,000.00'],
      ['VAT 23%', 'PLN2,415.00', 'PLN2,300.00'],
      ['Gross', 'PLN12,915.00', 'PLN12,300.00'],
    ]);
  });

  it('shows invoice and PO quantities separately when they differ', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceComparison);
    fixture.componentRef.setInput('data', {
      ...INVOICE_WORKSPACE_DATA,
      items: [{ ...INVOICE_WORKSPACE_DATA.items[0], quantity: 10, poQuantity: 5, poNet: 4100 }],
    });

    // Act
    await fixture.whenStable();

    const table = (fixture.nativeElement as HTMLElement).querySelector(
      '[aria-label="Line items and purchase order comparison"]',
    ) as HTMLTableElement;

    // Assert
    expect(
      Array.from(table.querySelectorAll('thead th'), (cell) => cell.textContent?.trim()),
    ).toContain('PO qty');
    expect(
      Array.from(table.querySelectorAll('tbody td'), (cell) => cell.textContent?.trim()),
    ).toEqual([
      '27-inch monitor',
      '10',
      '5',
      'PLN820.00',
      'PLN770.00',
      'PLN8,200.00',
      'PLN4,100.00',
    ]);
  });

  it('shows unavailable for a missing purchase order quantity', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceComparison);
    fixture.componentRef.setInput('data', {
      ...INVOICE_WORKSPACE_DATA,
      items: [{ ...INVOICE_WORKSPACE_DATA.items[0], poQuantity: null }],
    });

    // Act
    await fixture.whenStable();
    const row = (fixture.nativeElement as HTMLElement).querySelector('#comparison-line-1');

    // Assert
    expect(row?.textContent).toContain('Unavailable');
    expect(row?.textContent).not.toContain('undefined');
    expect(row?.getAttribute('tabindex')).toBe('-1');
  });
});
