import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEMO_INVOICE } from '../../invoices/invoice-demo.data';
import { OverviewPage } from './overview-page';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

describe('OverviewPage', () => {
  it('should show dashboard sections and links for the featured invoice', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [OverviewPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(OverviewPage);

    // Act
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/invoices')
      .flush({ items: [], page: 1, page_size: 20, total: 0 });
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    const headings = Array.from(view.querySelectorAll('h1, h2'), (heading) =>
      heading.textContent?.trim(),
    );
    expect(headings).toEqual(
      expect.arrayContaining([
        'Overview',
        'Processing volume',
        'Invoice status',
        'Attention required',
      ]),
    );
    expect(view.querySelector(`a[href="/invoices/${DEMO_INVOICE.id}"]`)).toBeTruthy();
    expect(view.querySelector(`a[href="/invoices/${DEMO_INVOICE.id}/investigation"]`)).toBeTruthy();
    expect(view.textContent).toContain('No invoices found');
    TestBed.inject(HttpTestingController).verify();
  });

  it('should retry a failed request and render API results', async () => {
    TestBed.configureTestingModule({
      imports: [OverviewPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(OverviewPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading invoices');
    http.expectOne('/api/v1/invoices').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('could not be loaded');
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    http.expectOne('/api/v1/invoices').flush({
      items: [
        {
          id: 'INV-2026-1041',
          vendor: 'Example',
          due: '2026-11-19',
          currency: 'PLN',
          status: 'approved',
          gross_amount: '3444.00',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('PLN3,444.00');
    expect(fixture.nativeElement.querySelector('a[href="/invoices/INV-2026-1041"]')).toBeTruthy();
    http.verify();
  });
});
