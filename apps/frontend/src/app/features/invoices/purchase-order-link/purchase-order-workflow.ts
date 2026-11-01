import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, forkJoin, of, takeUntil, throwError } from 'rxjs';
import {
  InvoiceApi,
  InvoiceDetailDto,
  PurchaseOrder,
  PurchaseOrderFields,
  PurchaseOrderLink,
} from '../data-access/invoice-api';
import { formatInvoiceAmount } from '../data-access/invoice-adapter';

@Injectable()
export class PurchaseOrderWorkflow {
  invoice!: InvoiceDetailDto;
  private readonly invoiceChanged = new Subject<void>();

  openInvoice(invoice: InvoiceDetailDto): void {
    this.invoiceChanged.next();
    this.invoice = invoice;
    this.orders.set([]);
    this.link.set(null);
    this.selected.set(null);
    this.editor.set(null);
    this.result.set(null);
    this.mappings = {};
    this.busy.set(false);
    this.load();
  }

  private readonly api = inject(InvoiceApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly link = signal<PurchaseOrderLink | null>(null);
  readonly selected = signal<PurchaseOrder | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loadFailed = signal(false);
  readonly result = signal<string | null>(null);
  readonly editor = signal<'create' | 'edit' | null>(null);
  mappings: Record<number, number | null> = {};

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set('');
    forkJoin({
      orders: this.api.purchaseOrders(),
      link: this.api
        .purchaseOrderLink(this.invoice.id)
        .pipe(
          catchError((error: unknown) =>
            error instanceof HttpErrorResponse && error.status === 404
              ? of(null)
              : throwError(() => error),
          ),
        ),
    })
      .pipe(takeUntil(this.invoiceChanged), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ orders, link }) => {
          this.orders.set(orders);
          this.link.set(link);
          const selected = orders.find((order) => order.id === link?.poId) ?? null;
          this.selectOrder(selected?.id ?? '');
          if (link) {
            this.mappings = Object.fromEntries(
              link.mappings.map((mapping) => [mapping.invoiceLinePosition, mapping.poLinePosition]),
            );
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
          this.error.set('Purchase orders could not be loaded.');
        },
      });
  }

  selectOrder(id: string): void {
    this.selected.set(this.orders().find((order) => order.id === id) ?? null);
    this.editor.set(null);
    this.mappings = {};
    this.result.set(null);
  }

  saveOrder(form: PurchaseOrderFields): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .savePurchaseOrder(
        form,
        this.editor() === 'edit' ? (this.selected() ?? undefined) : undefined,
      )
      .pipe(takeUntil(this.invoiceChanged), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.orders.update((orders) => [
            ...orders.filter((entry) => entry.id !== order.id),
            order,
          ]);
          this.link.update((link) =>
            link && link.poId === order.id ? { ...link, sourceChanged: true } : link,
          );
          this.selectOrder(order.id);
          this.editor.set(null);
          this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'Could not save the PO. Check its fields and version, then reload if needed.',
          );
        },
      });
  }

  linkOrder(onLinked: () => void): void {
    const order = this.selected();
    if (!order || this.busy()) return;
    const mappings = this.invoice.items.map((item) => ({
      invoiceLinePosition: item.position,
      poLinePosition: Number(this.mappings[item.position]),
    }));
    if (
      mappings.some((mapping) => !mapping.poLinePosition) ||
      new Set(mappings.map((mapping) => mapping.poLinePosition)).size !== mappings.length
    ) {
      this.error.set('Map every invoice line to a different PO line.');

      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .linkPurchaseOrder(this.invoice.id, {
        poId: order.id,
        poVersion: order.version,
        expectedLinkRevision: this.link()?.revision ?? 0,
        mappings,
      })
      .pipe(takeUntil(this.invoiceChanged), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (link) => {
          this.link.set(link);
          this.busy.set(false);
          onLinked();
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Could not link the PO. Reload to check for changes before retrying.');
        },
      });
  }

  reconcile(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .reconcile(this.invoice.id)
      .pipe(takeUntil(this.invoiceChanged), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(
            `Revision ${result.revision}: net ${formatInvoiceAmount(result.difference.net, result.inputs.currency)}, VAT ${formatInvoiceAmount(result.difference.vat, result.inputs.currency)}, gross ${formatInvoiceAmount(result.difference.gross, result.inputs.currency)}.`,
          );
          this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Reconciliation failed. You can safely retry.');
        },
      });
  }
}
