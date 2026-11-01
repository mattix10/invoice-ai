import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { DocumentResponse } from '../../../core/api/schema';
import { DraftReview } from './draft-review';

describe('DraftReview', () => {
  it('should save edited values with the document revision', async () => {
    // Arrange
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

    // Act
    vendor.value = 'Updated';
    vendor.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne('/api/v1/intake/documents/doc-1/draft');

    // Assert
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

it.each(['10', '10.5', '10.50'])(
  'should canonicalize %s before saving without retaining dirty state',
  async (amount) => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(DraftReview);
    const document = {
      documentId: 'doc-1',
      status: 'draft',
      invoiceId: null,
      originalName: 'invoice.pdf',
      sizeBytes: 100,
      createdAt: '2026-11-01T00:00:00Z',
      revision: 1,
      draft: {
        vendor: 'Example',
        supplierInvoiceNumber: null,
        issued: null,
        due: null,
        currency: 'PLN',
        vatRate: '0.23',
        items: [{ position: 1, name: 'Item', quantity: 2, unitNet: '1.00' }],
        declaredTotals: { net: '1.00', vat: '0.23', gross: '1.23' },
      },
      validation: { complete: false, errors: [] },
    } satisfies DocumentResponse;
    fixture.componentRef.setInput('visit', { documentId: 'doc-1' });
    fixture.componentRef.setInput('document', document);
    fixture.componentRef.setInput('step', 3);
    const http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    for (const name of [
      '.item label:nth-of-type(3) input',
      '[name="declared_net"]',
      '[name="declared_vat"]',
      '[name="declared_gross"]',
    ]) {
      const input = fixture.nativeElement.querySelector(name) as HTMLInputElement;
      input.value = amount;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    }
    expect(fixture.componentInstance.hasPendingChanges()).toBe(true);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne('/api/v1/intake/documents/doc-1/draft');
    const expected = amount === '10' ? '10.00' : '10.50';
    expect(request.request.body.draft.items[0].unitNet).toBe(expected);
    expect(request.request.body.draft.declaredTotals).toEqual({
      net: expected,
      vat: expected,
      gross: expected,
    });
    request.flush({
      draft: request.request.body.draft,
      revision: 2,
      validation: document.validation,
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
    http.verify();
  },
);

it('should keep invalid decimal edits visible without sending a save', async () => {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(DraftReview);
  fixture.componentRef.setInput('visit', { documentId: 'doc-1' });
  fixture.componentRef.setInput('document', {
    revision: 1,
    draft: {
      vendor: null,
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [{ position: 1, name: 'Item', quantity: 1, unitNet: '1.234' }],
      declaredTotals: null,
    },
    validation: { complete: false, errors: [] },
  });
  await fixture.whenStable();
  fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('at most two decimal places');
  expect(fixture.nativeElement.querySelector('.item label:nth-of-type(3) input').value).toBe(
    '1.234',
  );
  TestBed.inject(HttpTestingController).verify();
});
