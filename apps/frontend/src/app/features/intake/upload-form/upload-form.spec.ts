import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UploadForm } from './upload-form';
describe('UploadForm', () => {
  it('should show validation when no file was selected', async () => {
    // Arrange
    const fixture = TestBed.createComponent(UploadForm);
    await fixture.whenStable();
    // Act
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    // Assert
    expect(fixture.nativeElement.textContent).toContain('Select a non-empty PDF');
  });
  it('should emit the selected PDF', async () => {
    // Arrange
    const fixture = TestBed.createComponent(UploadForm);
    const file = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });
    const emit = vi.fn();
    fixture.componentInstance.upload.subscribe(emit);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input');
    Object.defineProperty(input, 'files', { value: [file] });
    // Act
    input.dispatchEvent(new Event('change'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    // Assert
    expect(emit).toHaveBeenCalledWith(file);
  });

  it('should keep the submitted file selected while the upload is pending', async () => {
    // Arrange
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(UploadForm);
    const originalFile = new File(['pdf'], 'original.pdf', { type: 'application/pdf' });
    const otherFile = new File(['pdf'], 'other.pdf', { type: 'application/pdf' });
    const uploadDuplicate = vi.fn();
    fixture.componentInstance.uploadDuplicate.subscribe(uploadDuplicate);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [originalFile], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    // Act
    Object.defineProperty(input, 'files', { value: [otherFile], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.componentRef.setInput('busy', false);
    fixture.componentRef.setInput('duplicate', 'document-1');
    await fixture.whenStable();
    const duplicateButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.includes('Create a separate document'),
    ) as HTMLButtonElement;
    duplicateButton.click();

    // Assert
    expect(uploadDuplicate).toHaveBeenCalledWith(originalFile);
  });

  it('should disable file selection while an upload is pending', async () => {
    // Arrange
    const fixture = TestBed.createComponent(UploadForm);
    fixture.componentRef.setInput('busy', true);

    // Act
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(true);
  });
});
