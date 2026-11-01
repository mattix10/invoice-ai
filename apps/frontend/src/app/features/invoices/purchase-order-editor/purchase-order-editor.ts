import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  input,
  output,
  signal,
} from '@angular/core';
import { protectPendingChanges } from '../../../core/navigation/pending-changes';
import { FormsModule } from '@angular/forms';
import { InvoiceDetailDto, PurchaseOrder, PurchaseOrderFields } from '../data-access/invoice-api';

@Component({
  selector: 'app-purchase-order-editor',
  imports: [FormsModule],
  templateUrl: './purchase-order-editor.html',
  styleUrl: './purchase-order-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderEditorComponent implements OnChanges {
  readonly mode = input.required<'create' | 'edit'>();
  readonly order = input<PurchaseOrder | null>(null);
  readonly invoice = input.required<InvoiceDetailDto>();
  readonly busy = input(false);
  readonly saved = output<PurchaseOrderFields>();
  readonly cancelled = output<void>();
  protected form!: PurchaseOrderFields;
  protected readonly error = signal('');
  private savedSnapshot = '';

  constructor() {
    protectPendingChanges(() => this.hasPendingChanges());
  }

  hasPendingChanges(): boolean {
    return this.busy() || (!!this.form && JSON.stringify(this.form) !== this.savedSnapshot);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['mode'] && !changes['order'] && !changes['invoice']) return;
    const order = this.order();
    this.form =
      this.mode() === 'edit' && order
        ? {
            externalReference: order.externalReference,
            supplier: order.supplier,
            currency: order.currency,
            vatRate: order.vatRate,
            items: order.items.map((item) => ({ ...item })),
          }
        : {
            externalReference: '',
            supplier: '',
            currency: this.invoice().currency,
            vatRate: this.invoice().vatRate ?? '',
            items: [{ position: 1, description: '', quantity: 1, unitNet: '0.00' }],
          };
    this.savedSnapshot = JSON.stringify(this.form);
  }

  protected submit(): void {
    if (this.busy()) return;
    const positions = this.form.items.map((item) => item.position);
    if (new Set(positions).size !== positions.length) {
      this.error.set('Each PO line must have a different position.');

      return;
    }
    this.error.set('');
    this.saved.emit(structuredClone(this.form));
  }

  protected addItem(): void {
    const nextPosition = Math.max(0, ...this.form.items.map((item) => item.position)) + 1;
    if (this.busy() || this.form.items.length >= 100 || nextPosition > 2147483647) {
      this.error.set('No more PO lines can be added.');

      return;
    }
    this.form.items.push({
      position: nextPosition,
      description: '',
      quantity: 1,
      unitNet: '0.00',
    });
  }

  protected removeItem(index: number): void {
    this.form.items.splice(index, 1);
  }
}
