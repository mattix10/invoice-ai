import { TestBed } from '@angular/core/testing';
import type { Draft } from '../data-access/intake-api';
import { DraftSummary } from './draft-summary';

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

it('should associate the line values with native table column headers', async () => {
  const fixture = TestBed.createComponent(DraftSummary);
  fixture.componentRef.setInput('draft', {
    ...draft,
    items: [{ position: 3, name: 'Monitor', quantity: 2, unitNet: '10.50' }],
  });
  fixture.componentRef.setInput('validation', { complete: true, errors: [] });
  const stepChange = vi.fn();
  fixture.componentInstance.stepChange.subscribe(stepChange);
  await fixture.whenStable();
  const table = fixture.nativeElement.querySelector(
    'table[aria-label="Invoice line items summary"]',
  ) as HTMLTableElement;
  expect(
    Array.from(table.querySelectorAll('th[scope="col"]'), (cell) => cell.textContent?.trim()),
  ).toEqual(['#', 'Description', 'Qty', 'Unit net', 'Net amount']);
  expect(
    Array.from(table.querySelectorAll('tbody td'), (cell) => cell.textContent?.trim()),
  ).toEqual(['3', 'Monitor', '2', '10.50', '21.00']);
  (fixture.nativeElement.querySelector('.edit-link') as HTMLButtonElement).click();
  expect(stepChange).toHaveBeenCalledWith(2);
});
