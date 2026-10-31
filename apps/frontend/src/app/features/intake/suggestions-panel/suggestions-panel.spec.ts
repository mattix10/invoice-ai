import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SuggestionsPanel } from './suggestions-panel';

describe('SuggestionsPanel', () => {
  it('shows source evidence and applies only checked suggestions', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(SuggestionsPanel);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('documentId', 'doc-1');
    fixture.componentRef.setInput('draft', {
      vendor: 'Manual',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    });
    const applied = vi.fn();
    const decisions = vi.fn();
    fixture.componentInstance.apply.subscribe(applied);
    fixture.componentInstance.decide.subscribe(decisions);
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    http.expectOne('/api/v1/intake/documents/doc-1/suggestions/latest').flush({
      documentId: 'doc-1',
      version: 1,
      status: 'completed',
      warnings: [],
      proposals: [
        {
          field: 'vendor',
          value: 'Example',
          source: {
            pageNumber: 1,
            start: 0,
            end: 7,
            excerpt: 'Example',
            extractionMethod: 'text',
            extractionVersion: 1,
          },
          warnings: [],
        },
        {
          field: 'currency',
          value: 'PLN',
          source: {
            pageNumber: 1,
            start: 0,
            end: 10,
            excerpt: 'PLN',
            extractionMethod: 'pdf_text',
            extractionVersion: 1,
          },
          warnings: [],
        },
      ],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Page 1');
    expect(fixture.nativeElement.textContent).toContain('Current: Manual');
    const checkboxes = fixture.nativeElement.querySelectorAll(
      'input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(checkboxes[1].disabled).toBe(true);
    checkboxes[0].click();
    await fixture.whenStable();
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[2].click();
    expect(applied).toHaveBeenCalledOnce();
    expect(applied.mock.calls[0][0]).toEqual([
      expect.objectContaining({ field: 'vendor', value: 'Example' }),
    ]);
    expect(decisions).toHaveBeenCalledWith({
      suggestionVersion: 1,
      decisions: [{ field: 'vendor', value: 'Example', decision: 'applied' }],
    });
    http.verify();
  });
});
