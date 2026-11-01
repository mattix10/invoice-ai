import { TestBed } from '@angular/core/testing';
import type { Draft } from '../data-access/intake-api';
import { DraftItemsEditor } from './draft-items-editor';

const draft: Draft = {
  vendor: 'Example',
  supplierInvoiceNumber: null,
  issued: null,
  due: null,
  currency: 'PLN',
  vatRate: '0.23',
  items: [],
  declaredTotals: null,
};

it('should append a unique position after non-consecutive imported lines', async () => {
  const fixture = TestBed.createComponent(DraftItemsEditor);
  fixture.componentRef.setInput('draft', {
    ...draft,
    items: [
      { position: 1, name: 'First', quantity: 1, unitNet: '10.00' },
      { position: 3, name: 'Third', quantity: 1, unitNet: '10.00' },
    ],
  });
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  await fixture.whenStable();
  (fixture.nativeElement.querySelector('.add-item') as HTMLButtonElement).click();
  expect(changed).toHaveBeenCalledWith({
    items: [
      expect.objectContaining({ position: 1 }),
      expect.objectContaining({ position: 3 }),
      expect.objectContaining({ position: 4 }),
    ],
  });
});

it('should update a line amount through its typed output', async () => {
  const fixture = TestBed.createComponent(DraftItemsEditor);
  fixture.componentRef.setInput('draft', {
    ...draft,
    items: [{ position: 1, name: 'First', quantity: 2, unitNet: '10.00' }],
  });
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  await fixture.whenStable();
  const amount = fixture.nativeElement.querySelector(
    '.item label:nth-of-type(3) input',
  ) as HTMLInputElement;
  amount.value = '10.5';
  amount.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  expect(changed).toHaveBeenCalledWith({ items: [expect.objectContaining({ unitNet: '10.5' })] });
});
