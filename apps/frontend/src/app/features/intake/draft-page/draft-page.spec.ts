import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { DraftPage } from './draft-page';

describe('DraftPage', () => {
  it('should ignore a save from an earlier visit after returning to the same document', async () => {
    // Arrange
    const firstDocument = convertToParamMap({ documentId: 'doc-1' });
    const routeParams = new BehaviorSubject(firstDocument);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: firstDocument }, paramMap: routeParams },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    const draft = {
      vendor: 'Original',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    };
    const validation = { complete: false, errors: [] };
    fixture.detectChanges();
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'a.pdf',
      revision: 2,
      draft,
      validation,
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    const confirm = [...fixture.nativeElement.querySelectorAll('button')].find((button: Element) =>
      button.textContent?.includes('Confirm invoice'),
    ) as HTMLButtonElement;
    confirm.click();
    const oldSave = http.expectOne('/api/v1/intake/documents/doc-1/draft');

    // Act
    routeParams.next(convertToParamMap({ documentId: 'doc-2' }));
    fixture.detectChanges();
    routeParams.next(firstDocument);
    fixture.detectChanges();
    expect(oldSave.cancelled).toBe(true);
    http
      .match(() => true)
      .filter((request) => !request.cancelled)
      .forEach((request) => request.flush(null, { status: 503, statusText: 'Unavailable' }));
    await fixture.whenStable();

    // Assert
    http.expectNone('/api/v1/intake/documents/doc-1/confirm');
    expect(fixture.nativeElement.textContent).not.toContain('Old response');
    http.verify({ ignoreCancelled: true });
  });

  it('should not confirm another document when the route changes during saving', async () => {
    // Arrange
    const firstDocument = convertToParamMap({ documentId: 'doc-1' });
    const routeParams = new BehaviorSubject(firstDocument);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: firstDocument }, paramMap: routeParams },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    const draft = {
      vendor: 'Example',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    };
    const validation = { complete: false, errors: [] };
    fixture.detectChanges();
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'a.pdf',
      revision: 2,
      draft,
      validation,
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    const confirm = [...fixture.nativeElement.querySelectorAll('button')].find((button: Element) =>
      button.textContent?.includes('Confirm invoice'),
    ) as HTMLButtonElement;
    confirm.click();
    const save = http.expectOne('/api/v1/intake/documents/doc-1/draft');

    // Act
    routeParams.next(convertToParamMap({ documentId: 'doc-2' }));
    fixture.detectChanges();
    expect(save.cancelled).toBe(true);

    // Assert
    http.expectNone('/api/v1/intake/documents/doc-2/confirm');
    http.expectNone('/api/v1/intake/documents/doc-1/confirm');
    http.expectOne('/api/v1/intake/documents/doc-2').flush({
      documentId: 'doc-2',
      status: 'draft',
      originalName: 'b.pdf',
      revision: 1,
      draft,
      validation,
    });
    http
      .expectOne('/api/v1/intake/documents/doc-2/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    http.verify({ ignoreCancelled: true });
  });

  it('should retry confirmation without saving again when the response is lost', async () => {
    // Arrange
    const params = convertToParamMap({ documentId: 'doc-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const draft = {
      vendor: 'Example',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    };
    const validation = { complete: false, errors: [] };
    fixture.detectChanges();
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'a.pdf',
      revision: 2,
      draft,
      validation,
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    const confirm = [...fixture.nativeElement.querySelectorAll('button')].find((button: Element) =>
      button.textContent?.includes('Confirm invoice'),
    ) as HTMLButtonElement;
    confirm.click();
    http
      .expectOne('/api/v1/intake/documents/doc-1/draft')
      .flush({ draft, revision: 3, validation });
    http.expectOne('/api/v1/intake/documents/doc-1/confirm').error(new ProgressEvent('error'));
    await fixture.whenStable();

    // Act
    const retry = [...fixture.nativeElement.querySelectorAll('button')].find((button: Element) =>
      button.textContent?.includes('Retry confirmation'),
    ) as HTMLButtonElement;
    retry.click();
    http
      .expectOne('/api/v1/intake/documents/doc-1/confirm')
      .flush({ invoiceId: 'INV-1', status: 'confirmed' });

    // Assert
    http.expectNone('/api/v1/intake/documents/doc-1/draft');
    expect(navigate).toHaveBeenCalledWith(['/invoices', 'INV-1']);
    http.verify();
  });

  it('should load the saved draft and report a PDF failure separately', async () => {
    // Arrange
    const params = convertToParamMap({ documentId: 'doc-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // Act
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'new.pdf',
      sizeBytes: 1,
      createdAt: '2026-01-01',
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
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.querySelector('[name="vendor"]').value).toBe('Example');
    expect(fixture.nativeElement.textContent).toContain('Could not load the preview');
    expect(fixture.nativeElement.querySelector('a[href$="/file"]').getAttribute('href')).toBe(
      '/api/v1/intake/documents/doc-1/file',
    );
    http.verify();
  });

  it('should save edited values with the current revision', async () => {
    // Arrange
    const params = convertToParamMap({ documentId: 'doc-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const draft = {
      vendor: 'Example',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    };
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'new.pdf',
      revision: 2,
      draft,
      validation: { complete: false, errors: [] },
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    const vendor = fixture.nativeElement.querySelector('[name="vendor"]');
    vendor.value = 'Updated';
    vendor.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    // Act
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne('/api/v1/intake/documents/doc-1/draft');

    // Assert
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.expectedRevision).toBe(2);
    expect(request.request.body.draft.vendor).toBe('Updated');
    request.flush({
      draft: { ...draft, vendor: 'Updated' },
      revision: 3,
      validation: { complete: false, errors: [] },
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Draft saved');
    http.verify();
  });

  it('should preserve local changes when another user saved a newer revision', async () => {
    // Arrange
    const params = convertToParamMap({ documentId: 'doc-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const draft = {
      vendor: 'Example',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    };
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'new.pdf',
      revision: 2,
      draft,
      validation: { complete: false, errors: [] },
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Act
    const vendor = fixture.nativeElement.querySelector('[name="vendor"]') as HTMLInputElement;
    vendor.value = 'Local edit';
    vendor.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/intake/documents/doc-1/draft')
      .flush(
        { error: { code: 'draft_revision_conflict', message: 'Conflict', currentRevision: 3 } },
        { status: 409, statusText: 'Conflict' },
      );
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'new.pdf',
      revision: 3,
      draft: { ...draft, vendor: 'Server edit' },
      validation: { complete: false, errors: [] },
    });
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Your unsaved changes remain visible');
    expect(fixture.nativeElement.textContent).toContain('Discard local changes');
    expect(fixture.nativeElement.textContent).toContain('Server edit');
    expect(vendor.value).toBe('Local edit');
    http.verify();
  });

  it('should preserve decisions from multiple suggestion versions when saving', async () => {
    // Arrange
    const params = convertToParamMap({ documentId: 'doc-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const draft = {
      vendor: null,
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    };
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'new.pdf',
      revision: 2,
      draft,
      validation: { complete: false, errors: [] },
    });
    http.expectOne('/api/v1/intake/documents/doc-1/preview').flush(new Blob());
    await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('app-suggestions-panel') as HTMLElement;
    const proposal = {
      field: 'vendor',
      value: 'Example',
      source: {
        pageNumber: 1,
        start: 0,
        end: 7,
        excerpt: 'Example',
        extractionMethod: 'pdf_text',
        extractionVersion: 1,
      },
      warnings: [],
    };
    panel.querySelectorAll('button')[0].click();
    http.expectOne('/api/v1/intake/documents/doc-1/suggestions/latest').flush({
      documentId: 'doc-1',
      version: 1,
      status: 'completed',
      proposals: [proposal],
      warnings: [],
    });
    await fixture.whenStable();
    (panel.querySelector('input') as HTMLInputElement).click();
    await fixture.whenStable();
    panel.querySelectorAll('button')[2].click();
    panel.querySelectorAll('button')[1].click();
    http.expectOne('/api/v1/intake/documents/doc-1/suggestions').flush({
      documentId: 'doc-1',
      version: 2,
      status: 'completed',
      proposals: [proposal],
      warnings: [],
    });
    await fixture.whenStable();
    (panel.querySelector('input') as HTMLInputElement).click();
    await fixture.whenStable();
    panel.querySelectorAll('button')[3].click();

    // Act
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne('/api/v1/intake/documents/doc-1/draft');

    // Assert
    expect(request.request.body.suggestionDecisionBatches).toEqual([
      { suggestionVersion: 1, decisions: [{ field: 'vendor', decision: 'applied' }] },
      { suggestionVersion: 2, decisions: [{ field: 'vendor', decision: 'rejected' }] },
    ]);
    request.flush({
      draft: { ...draft, vendor: 'Example' },
      revision: 3,
      validation: { complete: false, errors: [] },
    });
    http.verify();
  });

  it('should confirm only once and navigate to the new invoice', async () => {
    // Arrange
    const params = convertToParamMap({ documentId: 'doc-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    const draft = {
      vendor: 'Example',
      supplierInvoiceNumber: 'A',
      issued: null,
      due: '2026-11-30',
      currency: 'PLN',
      vatRate: '0.23',
      items: [{ position: 1, name: 'Work', quantity: 1, unitNet: '1.00' }],
      declaredTotals: null,
    };
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'new.pdf',
      revision: 2,
      draft,
      validation: { complete: true, errors: [] },
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Act
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((element: Element) =>
      element.textContent.includes('Confirm invoice'),
    ) as HTMLButtonElement;
    button.click();
    button.click();
    http
      .expectOne('/api/v1/intake/documents/doc-1/draft')
      .flush({ draft, revision: 3, validation: { complete: true, errors: [] } });
    const confirm = http.expectOne('/api/v1/intake/documents/doc-1/confirm');

    // Assert
    expect(confirm.request.body).toEqual({ expectedRevision: 3 });
    confirm.flush({ invoiceId: 'INV-2026-9999', status: 'confirmed' });
    expect(navigate).toHaveBeenCalledWith(['/invoices', 'INV-2026-9999']);
    http.verify();
  });

  it('should identify a confirmation failure after a successful save', async () => {
    // Arrange
    const params = convertToParamMap({ documentId: 'doc-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: params }, paramMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DraftPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const draft = {
      vendor: 'Example',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    };
    http.expectOne('/api/v1/intake/documents/doc-1').flush({
      documentId: 'doc-1',
      status: 'draft',
      originalName: 'new.pdf',
      revision: 2,
      draft,
      validation: { complete: false, errors: [] },
    });
    http
      .expectOne('/api/v1/intake/documents/doc-1/preview')
      .flush(new Blob(), { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Act
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((element: Element) =>
      element.textContent?.includes('Confirm invoice'),
    ) as HTMLButtonElement;
    button.click();
    http
      .expectOne('/api/v1/intake/documents/doc-1/draft')
      .flush({ draft, revision: 3, validation: { complete: false, errors: [] } });
    http
      .expectOne('/api/v1/intake/documents/doc-1/confirm')
      .flush(
        { error: { code: 'invalid_draft', message: 'Draft is incomplete' } },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain(
      'Could not confirm the invoice. Draft is incomplete',
    );
    http.verify();
  });
});
