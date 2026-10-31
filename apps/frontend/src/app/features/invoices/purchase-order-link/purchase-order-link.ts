import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import {
  InvoiceApi,
  InvoiceDetailDto,
  PurchaseOrder,
  PurchaseOrderFields,
  PurchaseOrderLink,
} from '../data-access/invoice-api';
import { formatInvoiceAmount } from '../data-access/invoice-adapter';

@Component({
  selector: 'app-purchase-order-link',
  imports: [FormsModule],
  templateUrl: './purchase-order-link.html',
  styleUrl: './purchase-order-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderLinkComponent implements OnInit {
  readonly invoice = input.required<InvoiceDetailDto>();
  readonly comparisonAvailable = input(false);
  readonly linked = output<void>();
  private readonly api = inject(InvoiceApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly orders = signal<PurchaseOrder[]>([]);
  protected readonly link = signal<PurchaseOrderLink | null>(null);
  protected readonly selected = signal<PurchaseOrder | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<string | null>(null);
  protected readonly editor = signal<'create' | 'edit' | null>(null);
  protected mappings: Record<number, number | null> = {};
  protected form: PurchaseOrderFields = {
    externalReference: '',
    supplier: '',
    currency: '',
    vatRate: '',
    items: [],
  };

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      orders: this.api.purchaseOrders(),
      link: this.api
        .purchaseOrderLink(this.invoice().id)
        .pipe(
          catchError((error: unknown) =>
            error instanceof HttpErrorResponse && error.status === 404
              ? of(null)
              : throwError(() => error),
          ),
        ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
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
          this.error.set('Purchase orders could not be loaded.');
        },
      });
  }

  protected selectOrder(id: string): void {
    this.selected.set(this.orders().find((order) => order.id === id) ?? null);
    this.editor.set(null);
    this.mappings = {};
    this.result.set(null);
  }

  protected openEditor(mode: 'create' | 'edit'): void {
    const order = this.selected();
    this.form =
      mode === 'edit' && order
        ? {
            externalReference: order.externalReference,
            supplier: order.supplier,
            currency: order.currency,
            vatRate: order.vatRate,
            items: order.items.map((item) => ({ ...item })),
          }
        : this.emptyForm();
    this.editor.set(mode);
    this.error.set('');
  }

  protected addItem(): void {
    this.form.items.push({
      position: this.form.items.length + 1,
      description: '',
      quantity: 1,
      unitNet: '0.00',
    });
  }

  protected removeItem(index: number): void {
    this.form.items.splice(index, 1);
  }

  protected saveOrder(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .savePurchaseOrder(
        this.form,
        this.editor() === 'edit' ? (this.selected() ?? undefined) : undefined,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
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

  protected linkOrder(): void {
    const order = this.selected();
    if (!order || this.busy()) return;
    const mappings = this.invoice().items.map((item) => ({
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
      .linkPurchaseOrder(this.invoice().id, {
        poId: order.id,
        poVersion: order.version,
        expectedLinkRevision: this.link()?.revision ?? 0,
        mappings,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (link) => {
          this.link.set(link);
          this.busy.set(false);
          this.linked.emit();
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Could not link the PO. Reload to check for changes before retrying.');
        },
      });
  }

  protected reconcile(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .reconcile(this.invoice().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
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

  private emptyForm(): PurchaseOrderFields {
    return {
      externalReference: '',
      supplier: '',
      currency: this.invoice().currency,
      vatRate: this.invoice().vatRate ?? '',
      items: [{ position: 1, description: '', quantity: 1, unitNet: '0.00' }],
    };
  }
}
