import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IntakeApi } from './intake-api';

describe('IntakeApi', () => {
  let intakeApi: IntakeApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    intakeApi = TestBed.inject(IntakeApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should send the file and explicit duplicate decision in multipart data', () => {
    // Arrange
    const invoicePdf = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });

    // Act
    intakeApi.uploadDocument(invoicePdf, true).subscribe();

    // Assert
    const upload = http.expectOne('/api/v1/intake/documents');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body.get('file')).toBe(invoicePdf);
    expect(upload.request.body.get('allowDuplicate')).toBe('true');
    upload.flush({ documentId: 'document-1' });
  });

  it('should submit the expected revision when confirming an invoice', () => {
    // Arrange
    const documentId = 'document/1';
    const expectedRevision = 3;

    // Act
    intakeApi.confirmInvoice(documentId, expectedRevision).subscribe();

    // Assert
    const confirmation = http.expectOne('/api/v1/intake/documents/document%2F1/confirm');
    expect(confirmation.request.method).toBe('POST');
    expect(confirmation.request.body).toEqual({ expectedRevision: expectedRevision });
    confirmation.flush({ invoiceId: 'INV-2026-1000', status: 'confirmed' });
  });
});
