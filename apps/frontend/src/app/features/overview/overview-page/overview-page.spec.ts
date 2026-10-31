import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEMO_INVOICE } from '../../invoices/invoice-demo.data';
import { OverviewPage } from './overview-page';

describe('OverviewPage', () => {
  let fixture: ComponentFixture<OverviewPage>;
  let http: HttpTestingController;

  const emptyPage = { items: [], page: 1, page_size: 20, total: 0 };
  const emptyReview = { items: [], page: 1, page_size: 1, total: 0 };
  const reviewRequest = (request: { url: string; params: { get(key: string): string | null } }) =>
    request.url === '/api/v1/invoices' && request.params.get('status') === 'needs_review';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverviewPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(OverviewPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('should show loading while the review queue is requested', () => {
    // Arrange
    http.expectOne('/api/v1/invoices').flush(emptyPage);
    const review = http.expectOne(reviewRequest);

    // Act
    fixture.detectChanges();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Loading review queue');
    review.flush(emptyReview);
  });

  it('should show an empty review queue when no invoice needs review', async () => {
    // Arrange
    http.expectOne('/api/v1/invoices').flush(emptyPage);

    // Act
    http.expectOne(reviewRequest).flush(emptyReview);
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('No invoices need review');
  });

  it('should link to the first invoice returned by the review queue', async () => {
    // Arrange
    http.expectOne('/api/v1/invoices').flush(emptyPage);
    const request = http.expectOne(reviewRequest);

    // Act
    request.flush({
      items: [
        {
          id: 'INV-2026-1099',
          vendor: 'Example',
          due: '2026-11-19',
          currency: 'PLN',
          status: 'needs_review',
          gross_amount: '1.00',
        },
      ],
      page: 1,
      page_size: 1,
      total: 1,
    });
    await fixture.whenStable();

    // Assert
    expect(request.request.params.get('page_size')).toBe('1');
    expect(request.request.params.get('sort')).toBe('-id');
    expect(fixture.nativeElement.querySelector('a[href="/invoices/INV-2026-1099"]')).toBeTruthy();
  });

  it('should show an error when the review queue request fails', async () => {
    // Arrange
    http.expectOne('/api/v1/invoices').flush(emptyPage);

    // Act
    http.expectOne(reviewRequest).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Review queue could not be loaded');
  });

  it('should reload the review queue when retry is selected', async () => {
    // Arrange
    http.expectOne('/api/v1/invoices').flush(emptyPage);
    http.expectOne(reviewRequest).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Act
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[role="alert"] button')!
      .click();
    fixture.detectChanges();
    http.expectOne(reviewRequest).flush(emptyReview);
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('No invoices need review');
  });

  it('should show loading while retrying the review queue', async () => {
    // Arrange
    http.expectOne('/api/v1/invoices').flush(emptyPage);
    http.expectOne(reviewRequest).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Act
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[role="alert"] button')!
      .click();
    fixture.detectChanges();
    const request = http.expectOne(reviewRequest);

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Loading review queue');
    request.flush(emptyReview);
  });

  it('should show the dashboard and featured investigation when invoices are absent', async () => {
    // Arrange
    http.expectOne(reviewRequest).flush(emptyReview);

    // Act
    http.expectOne('/api/v1/invoices').flush(emptyPage);
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.textContent).toContain('Processing volume');
    expect(view.textContent).toContain('Invoice status');
    expect(view.textContent).toContain('Attention required');
    expect(view.textContent).toContain('No invoices found');
    expect(view.querySelector(`a[href="/invoices/${DEMO_INVOICE.id}/investigation"]`)).toBeTruthy();
  });

  it('should render invoices after retrying a failed list request', async () => {
    // Arrange
    http.expectOne(reviewRequest).flush(emptyReview);
    http.expectOne('/api/v1/invoices').flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Act
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[role="alert"] button')!
      .click();
    fixture.detectChanges();
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

    // Assert
    expect(fixture.nativeElement.textContent).toContain('PLN3,444.00');
    expect(fixture.nativeElement.querySelector('a[href="/invoices/INV-2026-1041"]')).toBeTruthy();
  });
});
