import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PurchaseOrderLinkComponent } from './purchase-order-link';

const invoice = {
  id: 'INV-2026-9999',
  vendor: 'Example',
  due: '2026-11-19',
  currency: 'PLN',
  status: 'needs_review' as const,
  grossAmount: '123.00',
  issued: null,
  purchaseOrder: null,
  vatRate: '0.23',
  items: [{ position: 1, name: 'Monitor', quantity: 1, unitNet: '100.00', net: '100.00' }],
  totals: { net: '100.00', vat: '23.00', gross: '123.00' },
};
const order = {
  id: 'po-1',
  version: 1,
  externalReference: 'PO-1',
  supplier: 'Example',
  currency: 'PLN',
  vatRate: '0.23',
  items: [{ position: 5, description: 'Monitor', quantity: 1, unitNet: '90.00' }],
};

describe('PurchaseOrderLinkComponent', () => {
  it('reloads orders after a version conflict while linking', async () => {
    TestBed.configureTestingModule({
      imports: [PurchaseOrderLinkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PurchaseOrderLinkComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.detectChanges();
    http.expectOne('/api/v1/purchase-orders').flush([order]);
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    const selector = fixture.nativeElement.querySelector('#po-select') as HTMLSelectElement;
    selector.value = 'po-1';
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const line = fixture.nativeElement.querySelectorAll('select')[1] as HTMLSelectElement;
    line.selectedIndex = 1;
    line.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Link PO')
      ?.click();
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link')
      .flush({}, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Could not link the PO');
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Reload purchase orders')
      ?.click();
    http.expectOne('/api/v1/purchase-orders').flush([{ ...order, version: 2 }]);
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Could not link the PO');
    http.verify();
  });

  it('maps different line positions explicitly and links the selected PO', async () => {
    TestBed.configureTestingModule({
      imports: [PurchaseOrderLinkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PurchaseOrderLinkComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.detectChanges();
    http.expectOne('/api/v1/purchase-orders').flush([order]);
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('#po-select') as HTMLSelectElement;
    select.value = 'po-1';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const lineSelect = fixture.nativeElement.querySelectorAll('select')[1] as HTMLSelectElement;
    lineSelect.selectedIndex = 1;
    lineSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (element) => (element as HTMLElement).textContent?.trim() === 'Link PO',
    ) as HTMLButtonElement;
    button.click();
    const request = http.expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link');
    expect(request.request.body).toEqual({
      poId: 'po-1',
      poVersion: 1,
      expectedLinkRevision: 0,
      mappings: [{ invoiceLinePosition: 1, poLinePosition: 5 }],
    });
    request.flush({
      poId: 'po-1',
      poVersion: 1,
      revision: 1,
      snapshotId: 'snapshot',
      sourceChanged: false,
      provenance: 'existing',
      mappings: [{ invoiceLinePosition: 1, poLinePosition: 5 }],
    });
    http.verify();
  });

  it('shows an error and permits reloading when orders are unavailable', async () => {
    TestBed.configureTestingModule({
      imports: [PurchaseOrderLinkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PurchaseOrderLinkComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.detectChanges();
    http.expectOne('/api/v1/purchase-orders').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(http.expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link').cancelled).toBe(
      true,
    );
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Purchase orders could not be loaded');
    expect(fixture.nativeElement.querySelector('#po-select')).toBeNull();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    http.expectOne('/api/v1/purchase-orders').flush([]);
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Awaiting PO');
    http.verify({ ignoreCancelled: true });
  });

  it('submits the selected version when editing a PO', async () => {
    TestBed.configureTestingModule({
      imports: [PurchaseOrderLinkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PurchaseOrderLinkComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.detectChanges();
    http.expectOne('/api/v1/purchase-orders').flush([order]);
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('#po-select') as HTMLSelectElement;
    select.value = 'po-1';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const edit = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button) => (button as HTMLElement).textContent?.trim() === 'Edit PO',
    ) as HTMLButtonElement;
    edit.click();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector(
      'input[name="reference"]',
    ) as HTMLInputElement;
    input.value = 'PO-UPDATED';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    const request = http.expectOne('/api/v1/purchase-orders/po-1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.expectedVersion).toBe(1);
    expect(request.request.body.externalReference).toBe('PO-UPDATED');
    request.flush({ ...order, externalReference: 'PO-UPDATED', version: 2 });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('PO-UPDATED');
    http.verify();
  });

  it('closes the editor when the selected PO changes', async () => {
    TestBed.configureTestingModule({
      imports: [PurchaseOrderLinkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PurchaseOrderLinkComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/purchase-orders')
      .flush([order, { ...order, id: 'po-2', externalReference: 'PO-2' }]);
    http
      .expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    const selector = fixture.nativeElement.querySelector('#po-select') as HTMLSelectElement;
    selector.value = 'po-1';
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const edit = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button) => (button as HTMLElement).textContent?.trim() === 'Edit PO',
    ) as HTMLButtonElement;
    edit.click();
    await fixture.whenStable();
    expect(
      (fixture.nativeElement.querySelector('input[name="reference"]') as HTMLInputElement).value,
    ).toBe('PO-1');

    selector.value = 'po-2';
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();

    (
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (button) => (button as HTMLElement).textContent?.trim() === 'Edit PO',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(
      (fixture.nativeElement.querySelector('input[name="reference"]') as HTMLInputElement).value,
    ).toBe('PO-2');

    selector.value = '';
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    http.expectNone('/api/v1/purchase-orders/po-1');
    http.expectNone('/api/v1/purchase-orders/po-2');
    http.verify();
  });

  it('cancels the previous invoice request when the invoice changes', async () => {
    TestBed.configureTestingModule({
      imports: [PurchaseOrderLinkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PurchaseOrderLinkComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.detectChanges();
    const previousOrders = http.expectOne('/api/v1/purchase-orders');
    const previousLink = http.expectOne('/api/v1/invoices/INV-2026-9999/purchase-order-link');

    fixture.componentRef.setInput('invoice', { ...invoice, id: 'INV-2026-8888' });
    fixture.detectChanges();

    expect(previousOrders.cancelled).toBe(true);
    expect(previousLink.cancelled).toBe(true);
    http.expectOne('/api/v1/purchase-orders').flush([]);
    http
      .expectOne('/api/v1/invoices/INV-2026-8888/purchase-order-link')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Awaiting PO');
    http.verify();
  });
});
