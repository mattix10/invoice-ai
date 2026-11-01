import { TestBed } from '@angular/core/testing';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvoiceDifference } from './invoice-difference';

describe('InvoiceDifference', () => {
  it('shows the net, VAT, gross and percentage for the invoice', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceDifference);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent;

    // Assert
    expect(text).toContain('PLN500.00');
    expect(text).toContain('PLN115.00');
    expect(text).toContain('PLN615.00');
    expect(text).toContain('5% of PO gross');
  });

  it('omits the percentage when it is unavailable', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceDifference);
    fixture.componentRef.setInput('data', { ...INVOICE_WORKSPACE_DATA, differencePercent: null });

    // Act
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).not.toContain('of PO gross');
  });
});
