import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatInvoiceAmount } from '../data-access/invoice-adapter';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';

@Component({
  selector: 'app-investigation-evidence',
  imports: [Panel],
  templateUrl: './investigation-evidence.html',
  styleUrl: './investigation-evidence.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestigationEvidence {
  readonly data = input.required<typeof INVOICE_WORKSPACE_DATA>();
  protected readonly amount = formatInvoiceAmount;
}
