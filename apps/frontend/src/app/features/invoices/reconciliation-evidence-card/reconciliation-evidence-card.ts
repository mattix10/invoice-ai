import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ReconciliationRead } from '../../../core/api/schema';
import { Panel } from '../../../shared/ui/panel/panel';
import { formatInvoiceAmount } from '../data-access/invoice-adapter';

@Component({
  selector: 'app-reconciliation-evidence-card',
  imports: [RouterLink, Panel],
  templateUrl: './reconciliation-evidence-card.html',
  styleUrl: './reconciliation-evidence-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReconciliationEvidenceCard {
  readonly invoiceId = input.required<string>();
  readonly state = input.required<'loading' | 'ready' | 'error'>();
  readonly reconciliationMissing = input(false);
  readonly result = input<ReconciliationRead | null>(null);
  readonly selectedRevision = input(false);
  readonly retry = output<void>();
  protected readonly amount = formatInvoiceAmount;
}
