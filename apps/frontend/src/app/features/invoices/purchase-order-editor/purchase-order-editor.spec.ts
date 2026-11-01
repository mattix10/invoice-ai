import { TestBed } from '@angular/core/testing';
import { PurchaseOrderEditorComponent } from './purchase-order-editor';

it('initializes a fictional order with the invoice currency', async () => {
  const fixture = TestBed.createComponent(PurchaseOrderEditorComponent);
  fixture.componentRef.setInput('mode', 'create');
  fixture.componentRef.setInput('invoice', { currency: 'PLN', vatRate: '0.23' });
  await fixture.whenStable();
  expect(
    (fixture.nativeElement.querySelector('input[name="currency"]') as HTMLInputElement).value,
  ).toBe('PLN');
  expect(fixture.nativeElement.textContent).toContain('PO line 1');
});
