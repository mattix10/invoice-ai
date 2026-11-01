import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { InvoiceWorkspaceView } from '../data-access/invoice-adapter';

@Component({
  selector: 'app-invoice-difference',
  imports: [CurrencyPipe],
  templateUrl: './invoice-difference.html',
  styleUrl: './invoice-difference.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDifference {
  readonly data = input.required<InvoiceWorkspaceView>();
}
