import { TestBed } from '@angular/core/testing';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvoiceComparison } from './invoice-comparison';

describe('InvoiceComparison', () => {
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

  it('should update the displayed discrepancy when the input changes', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceComparison);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);
    await fixture.whenStable();

    // Act
    fixture.componentRef.setInput('data', { ...INVOICE_WORKSPACE_DATA, differenceNet: 750 });
    await fixture.whenStable();

    // Assert
    const section = (fixture.nativeElement as HTMLElement).querySelector(
      '[aria-labelledby="difference-title"]',
    );
    expect(section?.querySelector('p')?.textContent).toContain('PLN750.00 net');
  });

  it('shows invoice and PO quantities separately when they differ', async () => {
    const fixture = TestBed.createComponent(InvoiceComparison);
    fixture.componentRef.setInput('data', {
      ...INVOICE_WORKSPACE_DATA,
      items: [{ ...INVOICE_WORKSPACE_DATA.items[0], quantity: 10, poQuantity: 5, poNet: 4100 }],
    });

    await fixture.whenStable();

    const table = (fixture.nativeElement as HTMLElement).querySelector(
      '[aria-label="Line items and purchase order comparison"]',
    ) as HTMLTableElement;
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
});
