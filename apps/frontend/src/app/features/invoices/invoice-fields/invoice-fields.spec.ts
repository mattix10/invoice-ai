import { TestBed } from '@angular/core/testing';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvoiceFields } from './invoice-fields';

describe('InvoiceFields', () => {
  it('should display the supplied invoice fields and gross total', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceFields);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();

    // Assert
    const fields = (fixture.nativeElement as HTMLElement).querySelectorAll('dl > div');
    expect(
      Array.from(fields, (field) => [
        field.querySelector('dt')?.textContent?.trim(),
        field.querySelector('dd')?.textContent?.trim(),
      ]),
    ).toEqual([
      ['Supplier', 'Northline Office Sp. z o.o.'],
      ['Invoice number', 'INV-2026-1042'],
      ['Purchase order', 'PO-2026-0871'],
      ['Issued', '2026-10-22'],
      ['Due', '2026-11-21'],
      ['Gross total', '12\u00a0915,00\u00a0zł'],
    ]);
  });

  it('should update the supplier when the input changes', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceFields);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);
    await fixture.whenStable();

    // Act
    fixture.componentRef.setInput('data', {
      ...INVOICE_WORKSPACE_DATA,
      invoice: { ...INVOICE_WORKSPACE_DATA.invoice, vendor: 'Changed supplier' },
    });
    await fixture.whenStable();

    // Assert
    const fields = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('dl > div'));
    const supplier = fields.find(
      (field) => field.querySelector('dt')?.textContent?.trim() === 'Supplier',
    );
    expect(supplier?.querySelector('dd')?.textContent?.trim()).toBe('Changed supplier');
  });
});
