import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { InvestigationPage } from './investigation-page';

describe('InvestigationPage', () => {
  it('shows recorded amounts and missing receipt for the selected invoice', async () => {
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 'INV-2026-9999' })) },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvestigationPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/invoices/INV-2026-9999/reconciliations/latest').flush({
      revision: 1,
      isCurrent: true,
      algorithmVersion: 'deterministic-v2',
      evidenceRefs: [],
      result: {
        inputs: { purchaseOrder: 'PO-1', currency: 'PLN', deliveryReceiptId: null },
        invoiceTotals: { gross: '123.00' },
        poTotals: { gross: '110.70' },
        difference: { net: '10.00', vat: '2.30', gross: '12.30' },
      },
    });
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('PLN12.30');
    expect(text).toContain('Receipt: Unavailable');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe(
      '/invoices/INV-2026-9999',
    );
    http.verify();
  });
});
