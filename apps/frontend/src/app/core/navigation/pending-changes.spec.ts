import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { DocumentResponse } from '../api/schema';
import { routes } from '../../app.routes';

const doc: DocumentResponse = {
  documentId: 'doc-1',
  status: 'draft',
  originalName: 'invoice.pdf',
  sizeBytes: 100,
  createdAt: '2026-11-01T00:00:00Z',
  invoiceId: null,
  revision: 1,
  draft: {
    vendor: 'Example',
    supplierInvoiceNumber: null,
    issued: null,
    due: null,
    currency: 'PLN',
    vatRate: '0.23',
    items: [],
    declaredTotals: null,
  },
  validation: { complete: false, errors: [] },
};

describe('pending draft changes', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  afterEach(() => vi.restoreAllMocks());

  async function openDraft(): Promise<{
    harness: RouterTestingHarness;
    http: HttpTestingController;
  }> {
    const harness = await RouterTestingHarness.create('/intake/doc-1');
    const http = TestBed.inject(HttpTestingController);
    harness.detectChanges();
    TestBed.tick();
    http.expectOne('/api/v1/intake/documents/doc-1').flush(doc);
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();

    return { harness, http };
  }

  it.each(['/overview', '/intake/doc-2'])(
    'should keep dirty values when leaving for %s is declined',
    async (target) => {
      const { harness, http } = await openDraft();
      const vendor =
        harness.routeNativeElement!.querySelector<HTMLInputElement>('[name="vendor"]')!;
      vendor.value = 'Unsaved vendor';
      vendor.dispatchEvent(new Event('input'));
      await harness.fixture.whenStable();
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      expect(await TestBed.inject(Router).navigateByUrl(target)).toBe(false);
      expect(confirm).toHaveBeenCalledOnce();
      expect(TestBed.inject(Router).url).toBe('/intake/doc-1');
      expect(vendor.value).toBe('Unsaved vendor');
      http.verify();
    },
  );

  it('should allow a parameter change after explicitly discarding local edits', async () => {
    const { harness, http } = await openDraft();
    const vendor = harness.routeNativeElement!.querySelector<HTMLInputElement>('[name="vendor"]')!;
    vendor.value = 'Unsaved';
    vendor.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(await TestBed.inject(Router).navigateByUrl('/intake/doc-2')).toBe(true);
    harness.detectChanges();
    TestBed.tick();
    http.expectOne('/api/v1/intake/documents/doc-2').flush({ ...doc, documentId: 'doc-2' });
    http
      .expectOne('/api/v1/intake/documents/doc-2/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(confirm).toHaveBeenCalledOnce();
    expect(
      harness.routeNativeElement!.querySelector<HTMLInputElement>('[name="vendor"]')!.value,
    ).toBe('Example');
    http.verify();
  });

  it('should not ask to discard after a successful save', async () => {
    const { harness, http } = await openDraft();
    const vendor = harness.routeNativeElement!.querySelector<HTMLInputElement>('[name="vendor"]')!;
    vendor.value = 'Saved';
    vendor.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    harness.routeNativeElement!.querySelector('form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/intake/documents/doc-1/draft')
      .flush({ draft: { ...doc.draft, vendor: 'Saved' }, revision: 2, validation: doc.validation });
    await harness.fixture.whenStable();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await TestBed.inject(Router).navigateByUrl('/missing-page')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    http.verify();
  });
});
