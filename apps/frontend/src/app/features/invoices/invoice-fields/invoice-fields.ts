import { Panel } from '../../../shared/ui/panel/panel';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';

@Component({
  selector: 'app-invoice-fields',
  imports: [Panel, CurrencyPipe],
  templateUrl: './invoice-fields.html',
  styleUrl: './invoice-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceFields {
  readonly data = input.required<typeof INVOICE_WORKSPACE_DATA>();
}
