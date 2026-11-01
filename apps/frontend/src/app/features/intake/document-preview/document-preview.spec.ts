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
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('blob:invoice');
    fixture.destroy();
    expect(revoke).toHaveBeenCalledWith('blob:invoice');
    create.mockRestore();
    revoke.mockRestore();
  });

  it('zooms the document preview using the toolbar', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:invoice');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(DocumentPreview);
    fixture.componentRef.setInput('file', new Blob(['pdf']));
    fixture.componentRef.setInput('name', 'invoice.pdf');
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[aria-label="Zoom in"]').click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('output').textContent).toContain('125%');
    expect(fixture.nativeElement.querySelector('img').style.width).toBe('125%');
    fixture.destroy();
    create.mockRestore();
    revoke.mockRestore();
  });
});
