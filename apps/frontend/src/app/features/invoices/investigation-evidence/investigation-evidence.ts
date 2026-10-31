import { Panel } from '../../../shared/ui/panel/panel';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';

@Component({
  selector: 'app-investigation-evidence',
  imports: [Panel, CurrencyPipe],
  templateUrl: './investigation-evidence.html',
  styleUrl: './investigation-evidence.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestigationEvidence {
  readonly data = input.required<typeof INVOICE_WORKSPACE_DATA>();
}
