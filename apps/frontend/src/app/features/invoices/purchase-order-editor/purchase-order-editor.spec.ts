import { TestBed } from '@angular/core/testing';
import { PurchaseOrderEditorComponent } from './purchase-order-editor';

it('initializes a fictional order with the invoice currency', async () => {
  // Arrange
  const fixture = TestBed.createComponent(PurchaseOrderEditorComponent);
  fixture.componentRef.setInput('mode', 'create');
  fixture.componentRef.setInput('invoice', { currency: 'PLN', vatRate: '0.23' });

  // Act
  await fixture.whenStable();

  // Assert
  expect(
    (fixture.nativeElement.querySelector('input[name="currency"]') as HTMLInputElement).value,
  ).toBe('PLN');
  expect(fixture.nativeElement.textContent).toContain('PO line 1');
});

it('should preserve existing positions when removing and adding lines', async () => {
  const fixture = TestBed.createComponent(PurchaseOrderEditorComponent);
  fixture.componentRef.setInput('mode', 'edit');
  fixture.componentRef.setInput('invoice', { currency: 'PLN', vatRate: '0.23' });
  fixture.componentRef.setInput('order', {
    externalReference: 'PO-1',
    supplier: 'Example',
    currency: 'PLN',
    vatRate: '0.23',
    items: [1, 2, 3].map((position) => ({
      position,
      description: 'Item',
      quantity: 1,
      unitNet: '1.00',
    })),
  });
  const saved = vi.fn();
  fixture.componentInstance.saved.subscribe(saved);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  element.querySelectorAll<HTMLButtonElement>('fieldset fieldset button')[1].click();
  await fixture.whenStable();
  Array.from(element.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Add line'))!
    .click();
  await fixture.whenStable();
  const description = element.querySelector<HTMLInputElement>(
    'fieldset fieldset:last-of-type label:nth-of-type(2) input',
  )!;
  description.value = 'New item';
  description.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  element.querySelector('form')!.dispatchEvent(new Event('submit'));
  expect(saved.mock.calls[0][0].items.map((item: { position: number }) => item.position)).toEqual([
    1, 3, 4,
  ]);
});

it('should disable every editable control and action during a save', async () => {
  const fixture = TestBed.createComponent(PurchaseOrderEditorComponent);
  fixture.componentRef.setInput('mode', 'create');
  fixture.componentRef.setInput('invoice', { currency: 'PLN', vatRate: '0.23' });
  fixture.componentRef.setInput('busy', true);
  await fixture.whenStable();
  const controls = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('input,button'),
  );
  expect(controls.length).toBeGreaterThan(5);
  expect(controls.every((control) => control.matches(':disabled'))).toBe(true);
  fixture.componentRef.setInput('busy', false);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[name="currency"]').matches(':disabled')).toBe(false);
});

it('should not emit a PO with manually duplicated positions', async () => {
  const fixture = TestBed.createComponent(PurchaseOrderEditorComponent);
  fixture.componentRef.setInput('mode', 'edit');
  fixture.componentRef.setInput('invoice', { currency: 'PLN', vatRate: '0.23' });
  fixture.componentRef.setInput('order', {
    externalReference: 'PO-1',
    supplier: 'Example',
    currency: 'PLN',
    vatRate: '0.23',
    items: [1, 1].map((position) => ({
      position,
      description: 'Item',
      quantity: 1,
      unitNet: '1.00',
    })),
  });
  const saved = vi.fn();
  fixture.componentInstance.saved.subscribe(saved);
  await fixture.whenStable();
  fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
  await fixture.whenStable();
  expect(saved).not.toHaveBeenCalled();
  expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
    'different position',
  );
});
