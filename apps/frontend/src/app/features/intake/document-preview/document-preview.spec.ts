import { TestBed } from '@angular/core/testing';
import { DocumentPreview } from './document-preview';
describe('DocumentPreview', () => {
  it('should display the uploaded filename', async () => {
    // Arrange
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:invoice');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(DocumentPreview);
    fixture.componentRef.setInput('file', new Blob(['pdf']));
    fixture.componentRef.setInput('name', 'new.pdf');
    // Act
    await fixture.whenStable();
    // Assert
    expect(fixture.nativeElement.textContent).toContain('new.pdf');
    expect(fixture.nativeElement.querySelector('iframe').getAttribute('src')).toBe('blob:invoice');
    fixture.destroy();
    expect(revoke).toHaveBeenCalledWith('blob:invoice');
    create.mockRestore();
    revoke.mockRestore();
  });
});
