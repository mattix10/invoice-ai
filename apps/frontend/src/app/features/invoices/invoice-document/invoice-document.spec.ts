import { TestBed } from '@angular/core/testing';
import { InvoiceDocument } from './invoice-document';

describe('InvoiceDocument', () => {
  it('should offer the sample PDF in an accessible preview and as a link', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceDocument);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    const frame = view.querySelector('iframe');
    const link = view.querySelector('a');
    expect(frame?.getAttribute('src')).toBe('invoices/INV-2026-1042.pdf#view=FitH');
    expect(view.textContent).not.toContain('Illustrative sample invoice');
    expect(frame?.getAttribute('title')).toContain('INV-2026-1042');
    expect(link?.getAttribute('href')).toBe('invoices/INV-2026-1042.pdf');
    expect(link?.textContent).toContain('Open sample invoice PDF');
  });
});
