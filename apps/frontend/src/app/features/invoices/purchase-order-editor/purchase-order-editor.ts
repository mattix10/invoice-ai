import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  input,
  output,
} from '@angular/core';
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
}
