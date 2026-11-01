import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InvoiceDetailDto } from '../data-access/invoice-api';
import { PurchaseOrderEditorComponent } from '../purchase-order-editor/purchase-order-editor';
import { PurchaseOrderMappingComponent } from '../purchase-order-mapping/purchase-order-mapping';
import { PurchaseOrderWorkflow } from './purchase-order-workflow';

@Component({
  selector: 'app-purchase-order-link',
  imports: [FormsModule, PurchaseOrderEditorComponent, PurchaseOrderMappingComponent],
  providers: [PurchaseOrderWorkflow],
  templateUrl: './purchase-order-link.html',
  styleUrl: './purchase-order-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderLinkComponent implements OnChanges {
  readonly invoice = input.required<InvoiceDetailDto>();
  readonly comparisonAvailable = input(false);
  readonly linked = output<void>();
  protected readonly workflow = inject(PurchaseOrderWorkflow);

  private readonly orderEditor = viewChild(PurchaseOrderEditorComponent);

  hasPendingChanges(): boolean {
    return this.workflow.busy() || (this.orderEditor()?.hasPendingChanges() ?? false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invoice']) this.workflow.openInvoice(this.invoice());
  }

  protected linkOrder(): void {
    this.workflow.linkOrder(() => this.linked.emit());
  }
}
