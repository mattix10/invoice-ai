import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InvoiceDetailDto, PurchaseOrder } from '../data-access/invoice-api';

@Component({
  selector: 'app-purchase-order-mapping',
  imports: [FormsModule],
  templateUrl: './purchase-order-mapping.html',
  styleUrl: './purchase-order-mapping.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderMappingComponent {
  readonly invoice = input.required<InvoiceDetailDto>();
  readonly order = input.required<PurchaseOrder>();
  readonly mappings = input.required<Record<number, number | null>>();
  readonly busy = input(false);
  readonly mappingsChanged = output<Record<number, number | null>>();
  readonly linkRequested = output<void>();

  protected selectLine(invoicePosition: number, poPosition: number | null): void {
    this.mappingsChanged.emit({ ...this.mappings(), [invoicePosition]: poPosition });
  }
}
