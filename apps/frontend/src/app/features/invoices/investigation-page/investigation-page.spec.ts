import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InvestigationPage } from './investigation-page';

describe('InvestigationPage', () => {
  it('should associate invoice and purchase order totals with their labels', async () => {
    // Arrange
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(InvestigationPage);

    // Act
    await fixture.whenStable();

    // Assert
    const summary = (fixture.nativeElement as HTMLElement).querySelector(
      '[aria-label="Invoice summary"]',
    );
    const values = Array.from(summary!.querySelectorAll('div'), (item) => [
      item.querySelector('span')?.textContent?.trim(),
      item.querySelector('strong')?.textContent?.trim(),
    ]);
    expect(values).toEqual(
      expect.arrayContaining([
        ['Invoice total', 'PLN12,915.00'],
        ['PO total', 'PLN12,300.00'],
      ]),
    );
  });

  it('should provide a link back to the featured invoice', async () => {
    // Arrange
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(InvestigationPage);

    // Act
    await fixture.whenStable();

    // Assert
    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find(
      (element) => element.textContent?.trim() === 'Back to invoice',
    );
    expect(link?.getAttribute('href')).toBe('/invoices/INV-2026-1042');
  });
});
