import { TestBed } from '@angular/core/testing';
import type { Draft } from '../data-access/intake-api';
import { DraftFields } from './draft-fields';

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

it('should emit field changes without mutating its input', async () => {
  const fixture = TestBed.createComponent(DraftFields);
  fixture.componentRef.setInput('draft', draft);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  await fixture.whenStable();
  const vendor = fixture.nativeElement.querySelector('[name="vendor"]') as HTMLInputElement;
  vendor.value = 'Edited';
  vendor.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  expect(changed).toHaveBeenCalledWith({ vendor: 'Edited' });
  expect(draft.vendor).toBe('Example');
});
