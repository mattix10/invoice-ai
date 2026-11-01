import { TestBed } from '@angular/core/testing';
import { PurchaseOrderMappingComponent } from './purchase-order-mapping';

it('emits the selected PO line for an invoice line', async () => {
  // Arrange
  const fixture = TestBed.createComponent(PurchaseOrderMappingComponent);
  fixture.componentRef.setInput('invoice', { items: [{ position: 1, name: 'Monitor' }] });
  fixture.componentRef.setInput('order', {
    items: [{ position: 5, description: 'Monitor', quantity: 1, unitNet: '90.00' }],
  });
  fixture.componentRef.setInput('mappings', {});
  const changes: Record<number, number | null>[] = [];

  // Act
  fixture.componentInstance.mappingsChanged.subscribe((mapping) => changes.push(mapping));
  await fixture.whenStable();

  const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  select.selectedIndex = 1;
  select.dispatchEvent(new Event('change'));

  // Assert
  expect(changes).toEqual([{ 1: 5 }]);
});
