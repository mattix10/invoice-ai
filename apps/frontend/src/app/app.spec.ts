import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import type { InvoiceDetail } from './core/api/schema';
import { App } from './app';
import { routes } from './app.routes';

function settleRequests(fixture: ComponentFixture<App>): void {
  fixture.detectChanges();
  TestBed.tick();
  const http = TestBed.inject(HttpTestingController);
  http
    .match(() => true)
    .forEach((request) => {
      if (request.request.url === '/api/v1/invoices')
        request.flush({ items: [], page: 1, pageSize: 20, total: 0 });
      else if (
        request.request.url.endsWith('/comparison') ||
        request.request.url.endsWith('/purchase-order-link') ||
        request.request.url.endsWith('/reconciliations/latest')
      )
        request.flush({}, { status: 404, statusText: 'Not Found' });
      else if (request.request.url === '/api/v1/purchase-orders') request.flush([]);
      else
        request.flush({
          id: 'INV-2026-1042',
          vendor: 'Example',
          due: '2026-11-21',
          currency: 'PLN',
          status: 'needs_review',
          grossAmount: '12915.00',
          issued: null,
          purchaseOrder: null,
          vatRate: null,
          items: [],
          totals: null,
        } satisfies InvoiceDetail);
    });
}

describe('shared shell routing', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it.each([
    ['/', 'Overview', 'Overview'],
    ['/invoices/INV-2026-1042', 'Invoice workspace', 'Invoice workspace'],
    ['/invoices/INV-2026-1042/investigation', 'AI investigation', 'AI investigation'],
    ['/invoices/new', 'Overview', 'Upload invoice'],
    ['/overview/intake/new', 'Overview', 'Upload invoice'],
    ['/overveiw', 'Page not found', 'Page not found'],
  ])(
    'should display %s with one shell, its breadcrumb, and document title',
    async (url, breadcrumb, title) => {
      const fixture = TestBed.createComponent(App);
      await TestBed.inject(Router).navigateByUrl(url);
      settleRequests(fixture);
      await fixture.whenStable();
      settleRequests(fixture);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('app-sidebar')).toHaveLength(1);
      expect(element.querySelectorAll('app-topbar')).toHaveLength(1);
      expect(element.querySelector('.crumb strong')?.textContent).toBe(breadcrumb);
      expect(TestBed.inject(Title).getTitle()).toBe(title);
      expect(element.querySelector('h1')).not.toBeNull();
      expect(document.activeElement).toBe(element.querySelector('main'));
    },
  );

  it('should focus the stable main content on navigation from a removed view', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/overview/intake/new');
    settleRequests(fixture);
    await fixture.whenStable();
    await router.navigateByUrl('/missing-page');
    settleRequests(fixture);
    await fixture.whenStable();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('main'));
  });
});
