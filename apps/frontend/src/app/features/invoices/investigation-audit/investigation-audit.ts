import { Panel } from '../../../shared/ui/panel/panel';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';

@Component({
  selector: 'app-investigation-audit',
  imports: [Panel, CurrencyPipe, DecimalPipe],
  templateUrl: './investigation-audit.html',
  styleUrl: './investigation-audit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestigationAudit {
  readonly data = input.required<typeof INVOICE_WORKSPACE_DATA>();
}
