import { Panel } from '../../../shared/ui/panel/panel';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatWorkspaceAmount } from '../data-access/invoice-adapter';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';

@Component({
  selector: 'app-investigation-audit',
  imports: [Panel, DecimalPipe],
  templateUrl: './investigation-audit.html',
  styleUrl: './investigation-audit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestigationAudit {
  readonly data = input.required<typeof INVOICE_WORKSPACE_DATA>();
  protected readonly amount = formatWorkspaceAmount;
}
