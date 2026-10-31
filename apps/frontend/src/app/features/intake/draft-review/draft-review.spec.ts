import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { DocumentResponse } from '../../../core/api/schema';
import { DraftReview } from './draft-review';

describe('DraftReview', () => {
  it('should save edited values with the document revision', async () => {
    const document = {
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'invoice.pdf',
      invoiceId: null,
      sizeBytes: 100,
      createdAt: '2026-10-31T12:00:00Z',
      revision: 2,
      draft: {
        vendor: 'Example',
        supplierInvoiceNumber: null,
        issued: null,
        due: null,
        currency: null,
        vatRate: null,
        items: [],
        declaredTotals: null,
      },
      validation: { complete: false, errors: [] },
    } as DocumentResponse;
    TestBed.configureTestingModule({
      imports: [DraftReview],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(DraftReview);
    fixture.componentRef.setInput('visit', { documentId: document.documentId });
    fixture.componentRef.setInput('document', document);
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    await fixture.whenStable();
    const vendor = fixture.nativeElement.querySelector('[name="vendor"]') as HTMLInputElement;
    vendor.value = 'Updated';
    vendor.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne('/api/v1/intake/documents/doc-1/draft');

    expect(request.request.body.expectedRevision).toBe(2);
    expect(request.request.body.draft.vendor).toBe('Updated');
    request.flush({
      draft: { ...document.draft, vendor: 'Updated' },
      revision: 3,
      validation: document.validation,
    });
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }));
    expect(fixture.nativeElement.textContent).toContain('Draft saved.');
    http.verify();
  });
});
