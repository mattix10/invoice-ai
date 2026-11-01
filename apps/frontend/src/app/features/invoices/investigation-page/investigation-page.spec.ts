import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { InvestigationPage } from './investigation-page';

describe('InvestigationPage', () => {
  it('does not fetch the latest reconciliation when the selected revision is empty', () => {
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ id: 'INV-2026-1042' })),
            queryParamMap: new BehaviorSubject(convertToParamMap({ revision: '' })),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvestigationPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Evidence unavailable');
    http.expectNone('/api/v1/invoices/INV-2026-1042/reconciliations/latest');
    http.verify();
  });

  it('offers the invoice workspace when no reconciliation exists', () => {
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ id: 'INV-2026-1042' })),
            queryParamMap: new BehaviorSubject(convertToParamMap({})),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvestigationPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/invoices/INV-2026-1042/reconciliations/latest')
      .flush(
        { error: { code: 'reconciliation_not_found' } },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('No reconciliation yet');
    expect(
      Array.from(element.querySelectorAll('a'))
        .find((link) => link.textContent?.includes('Open invoice workspace'))
        ?.getAttribute('href'),
    ).toBe('/invoices/INV-2026-1042');
    http.verify();
  });

  it('loads the selected revision and focuses its requested line without posting a reconciliation', async () => {
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ id: 'INV-2026-1042' })),
            queryParamMap: new BehaviorSubject(convertToParamMap({ revision: '2', line: '1' })),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvestigationPage);
    document.body.appendChild(fixture.nativeElement);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/invoices/INV-2026-1042/reconciliations/2').flush({
      revision: 2,
      isCurrent: false,
      algorithmVersion: 'deterministic-v2',
      evidenceRefs: [],
      result: {
        invoiceId: 'INV-2026-1042',
        lines: [{ position: 1, name: 'Monitor', differenceNet: '5.00' }],
        inputs: { purchaseOrder: 'PO-1', currency: 'PLN', deliveryReceiptId: null },
        invoiceTotals: { gross: '123.00' },
        poTotals: { gross: '110.70' },
        difference: { net: '10.00', vat: '2.30', gross: '12.30' },
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('line-1');
    expect(fixture.nativeElement.textContent).toContain('Historical snapshot');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type=submit]')
        ?.disabled,
    ).toBe(true);
    http.expectNone((request) => request.method === 'POST');
    http.verify();
    fixture.nativeElement.remove();
  });

  it('sends the selected invoice and cancels the answer when the route changes', async () => {
    const params = new BehaviorSubject(convertToParamMap({ id: 'INV-2026-1042' }));
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params, queryParamMap: new BehaviorSubject(convertToParamMap({})) },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvestigationPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/invoices/INV-2026-1042/reconciliations/latest')
      .flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((item) => item.textContent?.includes('Explain this discrepancy'));
    button?.click();
    fixture.detectChanges();
    const request = http.expectOne('/api/v1/copilot/queries');
    expect(request.request.body).toEqual({
      question: 'Explain this discrepancy',
      invoiceId: 'INV-2026-1042',
    });
    expect(fixture.nativeElement.textContent).toContain('Investigating');
    params.next(convertToParamMap({ id: 'INV-2026-9999' }));
    expect(request.cancelled).toBe(true);
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/reconciliations/latest')
      .flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Investigating');
    http.verify({ ignoreCancelled: true });
    await fixture.whenStable();
  });

  it('shows a retryable current-evidence error', () => {
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ id: 'INV-2026-1042' })),
            queryParamMap: new BehaviorSubject(convertToParamMap({})),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvestigationPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/invoices/INV-2026-1042/reconciliations/latest')
      .flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((item) => item.textContent?.includes('Explain this discrepancy'))
      ?.click();
    http
      .expectOne('/api/v1/copilot/queries')
      .flush({ error: { code: 'reconciliation_stale' } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('reconciliation is stale');
    const retries = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).filter((item) => item.textContent?.trim() === 'Retry');
    retries.at(-1)?.click();
    http.expectOne('/api/v1/copilot/queries').flush({}, { status: 503, statusText: 'Unavailable' });
    http.verify();
  });

  it('shows recorded amounts and missing receipt for the selected invoice', async () => {
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ id: 'INV-2026-9999' })),
            queryParamMap: new BehaviorSubject(convertToParamMap({})),
          },
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
        invoiceId: 'INV-2026-9999',
        lines: [],
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
