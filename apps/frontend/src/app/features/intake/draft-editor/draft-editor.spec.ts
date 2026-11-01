import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DraftEditor } from './draft-editor';

describe('DraftEditor', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('should show saved draft values', async () => {
    // Arrange
    const fixture = TestBed.createComponent(DraftEditor);
    fixture.componentRef.setInput('draft', {
      vendor: 'Example',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    });
    fixture.componentRef.setInput('validation', { complete: false, errors: ['due'] });

    // Act
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.querySelector('[name="vendor"]').value).toBe('Example');
    expect(fixture.nativeElement.textContent).toContain('due');
  });

  it('should disable the entire editor while a request is pending', async () => {
    // Arrange
    const fixture = TestBed.createComponent(DraftEditor);
    fixture.componentRef.setInput('draft', {
      vendor: 'Example',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [{ position: 1, name: 'Work', quantity: 1, unitNet: '10.00' }],
      declaredTotals: null,
    });
    fixture.componentRef.setInput('validation', { complete: false, errors: [] });
    fixture.componentRef.setInput('busy', true);

    // Act
    await fixture.whenStable();

    // Assert
    const editor = fixture.nativeElement.querySelector('form > fieldset') as HTMLFieldSetElement;
    expect(editor.disabled).toBe(true);
    expect(editor.querySelector('[name="vendor"]')?.matches(':disabled')).toBe(true);
    expect(
      [...editor.querySelectorAll('button')].every((button) => button.matches(':disabled')),
    ).toBe(true);
  });

  it('retains unsaved field edits when moving between steps', async () => {
    const fixture = TestBed.createComponent(DraftEditor);
    fixture.componentRef.setInput('draft', {
      vendor: 'Original',
      supplierInvoiceNumber: null,
      issued: null,
      due: null,
      currency: null,
      vatRate: null,
      items: [],
      declaredTotals: null,
    });
    fixture.componentRef.setInput('validation', { complete: false, errors: [] });
    await fixture.whenStable();
    const vendor = fixture.nativeElement.querySelector('[name="vendor"]') as HTMLInputElement;
    vendor.value = 'Edited vendor';
    vendor.dispatchEvent(new Event('input'));
    fixture.componentRef.setInput('step', 3);
    await fixture.whenStable();
    fixture.componentRef.setInput('step', 2);
    await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('[name="vendor"]') as HTMLInputElement).value).toBe(
      'Edited vendor',
    );
  });
});
