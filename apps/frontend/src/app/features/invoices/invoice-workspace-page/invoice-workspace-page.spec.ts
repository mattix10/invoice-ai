import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { InvoiceWorkspacePage } from './invoice-workspace-page';

describe('InvoiceWorkspacePage', () => {
  it('should display a large invoice amount exactly when comparison is unavailable', async () => {
    // Arrange
    TestBed.configureTestingModule({
      imports: [InvoiceWorkspacePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 'large' })) },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceWorkspacePage);
    const http = TestBed.inject(HttpTestingController);

    // Act
    fixture.detectChanges();
    http.expectOne('/api/v1/invoices/large').flush({
      id: 'large',
      vendor: 'Example',
      due: '2026-11-19',
      currency: 'PLN',
      status: 'needs_review',
      gross_amount: '100000000000000.01',
      issued: null,
      purchase_order: null,
      vat_rate: null,
      items: [],
      totals: null,
    });
    http
      .expectOne('/api/v1/invoices/large/comparison')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('PLN100,000,000,000,000.01');
    http.verify();
  });

  it('should load changed route IDs and show missing comparison honestly', async () => {
    const params = new BehaviorSubject(convertToParamMap({ id: 'INV-2026-1041' }));
    TestBed.configureTestingModule({
      imports: [InvoiceWorkspacePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceWorkspacePage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading invoice');
    http.expectOne('/api/v1/invoices/INV-2026-1041').flush({
      id: 'INV-2026-1041',
      vendor: 'Example',
      due: '2026-11-19',
      currency: 'PLN',
      status: 'approved',
      gross_amount: '3444.00',
      issued: null,
      purchase_order: null,
      vat_rate: null,
      items: [],
      totals: null,
    });
    http
      .expectOne('/api/v1/invoices/INV-2026-1041/comparison')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Comparison unavailable');
    expect(fixture.nativeElement.textContent).toContain('Line items unavailable');
    expect(fixture.nativeElement.querySelector('app-invoice-document')).toBeNull();
    params.next(convertToParamMap({ id: 'INV-2026-9999' }));
    http
      .expectOne('/api/v1/invoices/INV-2026-9999')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Invoice not found');
    http.verify({ ignoreCancelled: true });
  });

  it('should display canonical amounts from the API after retrying an outage', async () => {
    const params = new BehaviorSubject(convertToParamMap({ id: 'INV-2026-1042' }));
    TestBed.configureTestingModule({
      imports: [InvoiceWorkspacePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceWorkspacePage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const firstComparison = http.expectOne('/api/v1/invoices/INV-2026-1042/comparison');
    http
      .expectOne('/api/v1/invoices/INV-2026-1042')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(firstComparison.cancelled).toBe(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('could not be loaded');
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    const totals = { net: '10500.00', vat: '2415.00', gross: '12915.00' };
    http.expectOne('/api/v1/invoices/INV-2026-1042').flush({
      id: 'INV-2026-1042',
      vendor: 'Example',
      due: '2026-11-21',
      currency: 'PLN',
      status: 'needs_review',
      gross_amount: '12915.00',
      issued: '2026-10-22',
      purchase_order: 'PO-2026-0871',
      vat_rate: '0.2300',
      items: [],
      totals,
    });
    http.expectOne('/api/v1/invoices/INV-2026-1042/comparison').flush({
      invoice_id: 'INV-2026-1042',
      purchase_order: 'PO-2026-0871',
      delivery_receipt_id: null,
      currency: 'PLN',
      vat_rate: '0.2300',
      items: [],
      invoice_totals: totals,
      po_totals: { net: '10000.00', vat: '2300.00', gross: '12300.00' },
      difference: { net: '500.00', vat: '115.00', gross: '615.00' },
      difference_percent: '5.0',
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('PLN12,915.00');
    expect(fixture.nativeElement.textContent).toContain('PLN615.00');
    expect(fixture.nativeElement.textContent).toContain('5.0%');
    expect(fixture.nativeElement.textContent).toContain('VAT 23%');
    expect(fixture.nativeElement.querySelector('app-invoice-document')).toBeTruthy();
    http.verify({ ignoreCancelled: true });
  });
});
