import { TestBed } from '@angular/core/testing';
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
});
