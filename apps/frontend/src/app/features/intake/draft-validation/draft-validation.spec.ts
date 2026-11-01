import { TestBed } from '@angular/core/testing';
import { DraftValidation } from './draft-validation';

describe('DraftValidation', () => {
  it('shows human-readable missing fields and preserves unfamiliar server errors', async () => {
    const fixture = TestBed.createComponent(DraftValidation);
    fixture.componentRef.setInput('errors', [
      'supplier_invoice_number',
      'vat_rate',
      'custom_error',
    ]);

    await fixture.whenStable();

    const items = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('li'),
      (item) => item.textContent?.trim(),
    );
    expect(items).toEqual(['Invoice number', 'VAT rate', 'custom_error']);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });
});
