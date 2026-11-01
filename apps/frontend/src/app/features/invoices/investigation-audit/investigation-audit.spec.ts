import { TestBed } from '@angular/core/testing';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvestigationAudit } from './investigation-audit';

describe('InvestigationAudit', () => {
  it.each([
    ['Net difference', '500,00\u00a0zł'],
    ['VAT difference', '115,00\u00a0zł'],
    ['Gross difference', '615,00\u00a0zł'],
    ['Of PO gross total', '5.0%'],
  ])('should display %s as %s', async (label, expected) => {
    // Arrange
    const fixture = TestBed.createComponent(InvestigationAudit);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();

    // Assert
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('dl > div'));
    const row = rows.find((item) => item.querySelector('dt')?.textContent?.trim() === label);
    expect(row?.querySelector('dd')?.textContent?.trim()).toBe(expected);
  });

  it('should identify the event trail as illustrative and show the processing steps in order', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvestigationAudit);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    const heading = Array.from(view.querySelectorAll('h2')).find(
      (item) => item.textContent?.trim() === 'Application event trail',
    );
    expect(heading?.nextElementSibling?.textContent?.trim()).toBe(
      'Illustrative demo events, not a live processing log.',
    );
    const events = Array.from(view.querySelectorAll('ol li'), (item) => item.textContent?.trim());
    expect(events).toEqual([
      'Sample invoice and purchase order data prepared.',
      'Monitor unit prices compared; variance identified.',
      'Sample delivery quantities checked against both records.',
      'Recommendation prepared for human review.',
    ]);
  });

  it('should recommend supplier confirmation and a human decision', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvestigationAudit);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();

    // Assert
    const headings = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2'));
    const heading = headings.find((item) => item.textContent?.trim() === 'Suggested next step');
    const recommendation = heading?.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim();
    expect(recommendation).toBe(
      'Request supplier confirmation of the monitor unit price. A person must decide how to proceed; no automatic approval or payment occurs.',
    );
  });
});
