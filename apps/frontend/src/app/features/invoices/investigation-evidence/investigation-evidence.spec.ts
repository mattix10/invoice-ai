import { TestBed } from '@angular/core/testing';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvestigationEvidence } from './investigation-evidence';

describe('InvestigationEvidence', () => {
  it.each([
    ['Invoice \u00b7 INV-2026-1042', '820,00 zł', '12 915,00 zł'],
    ['Purchase order \u00b7 PO-2026-0871', '770,00 zł', '12 300,00 zł'],
    ['Delivery receipt \u00b7 DR-2026-1042', '10 monitors delivered', 'Quantities match'],
  ])('should show the figures belonging to evidence %s', async (source, first, second) => {
    // Arrange
    const fixture = TestBed.createComponent(InvestigationEvidence);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();

    // Assert
    const articles = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('article'));
    const record = articles.find(
      (item) => item.querySelector('h4')?.textContent?.trim() === source,
    );
    const content = record?.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(content).toContain(first);
    expect(content).toContain(second);
  });

  it('should disclose that the explanation is prepared demo content', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvestigationEvidence);
    fixture.componentRef.setInput('data', INVOICE_WORKSPACE_DATA);

    // Act
    await fixture.whenStable();

    // Assert
    const paragraphs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('p'),
      (item) => item.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(paragraphs).toContain(
      'Prepared demonstration text based on fictional records. No live AI model was used.',
    );
  });
});
