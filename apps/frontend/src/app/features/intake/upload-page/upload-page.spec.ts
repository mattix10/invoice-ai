import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { UploadPage } from './upload-page';
describe('UploadPage', () => {
  it('should send the selected PDF as multipart and navigate after upload', async () => {
    // Arrange
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(UploadPage);
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input');
    const file = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    // Act
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne('/api/v1/intake/documents');
    // Assert
    expect(request.request.method).toBe('POST');
    expect(request.request.body.get('file')).toBe(file);
    request.flush({ document_id: 'doc-1' });
    expect(navigate).toHaveBeenCalledWith(['/intake', 'doc-1']);
    http.verify();
  });
  it('should show an upload failure and allow retry', async () => {
    // Arrange
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(UploadPage);
    const http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input');
    Object.defineProperty(input, 'files', {
      value: [new File(['pdf'], 'a.pdf', { type: 'application/pdf' })],
    });
    input.dispatchEvent(new Event('change'));
    // Act
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    http
      .expectOne('/api/v1/intake/documents')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    // Assert
    expect(fixture.nativeElement.textContent).toContain('Upload failed');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
    http.verify();
  });
  it('should request explicit consent before uploading duplicate content', async () => {
    // Arrange
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(UploadPage);
    const http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input');
    Object.defineProperty(input, 'files', {
      value: [new File(['pdf'], 'a.pdf', { type: 'application/pdf' })],
    });
    input.dispatchEvent(new Event('change'));
    // Act
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    http.expectOne('/api/v1/intake/documents').flush(
      {
        error: {
          code: 'duplicate_document',
          message: 'Duplicate',
          existing_document_id: 'doc-1',
        },
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((element: Element) =>
      element.textContent?.includes('Create a separate document'),
    ) as HTMLButtonElement;
    button.click();
    const request = http.expectOne('/api/v1/intake/documents');
    // Assert
    expect(request.request.body.get('allow_duplicate')).toBe('true');
    request.flush({ document_id: 'doc-2' });
    http.verify();
  });
});
