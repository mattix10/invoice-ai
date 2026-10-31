import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InvoiceApi } from './invoice-api';

describe('InvoiceApi', () => {
  it('sends list query and propagates errors', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(InvoiceApi);
    const http = TestBed.inject(HttpTestingController);
    let status = 0;
    api.list({ page: 2, status: 'approved' }).subscribe({ error: (e) => (status = e.status) });
    const request = http.expectOne(
      (req) =>
        req.url === '/api/v1/invoices' &&
        req.params.get('page') === '2' &&
        req.params.get('status') === 'approved',
    );
    expect(request.request.method).toBe('GET');
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(status).toBe(503);
    http.verify();
  });
});
