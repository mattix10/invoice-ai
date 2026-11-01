import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatInvoiceAmount, type InvoiceWorkspaceView } from '../data-access/invoice-adapter';

@Component({
  selector: 'app-invoice-difference',
  imports: [],
  templateUrl: './invoice-difference.html',
  styleUrl: './invoice-difference.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDifference {
  readonly data = input.required<InvoiceWorkspaceView>();
  protected readonly amount = formatInvoiceAmount;
}
