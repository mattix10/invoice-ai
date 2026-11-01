import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatWorkspaceAmount, InvoiceWorkspaceView } from '../data-access/invoice-adapter';

@Component({
  selector: 'app-invoice-fields',
  imports: [Panel],
  templateUrl: './invoice-fields.html',
  styleUrl: './invoice-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceFields {
  readonly data = input.required<InvoiceWorkspaceView>();
  protected readonly amount = formatWorkspaceAmount;
}
