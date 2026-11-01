import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CopilotPanel } from '../copilot-panel/copilot-panel';
import { ReconciliationEvidenceCard } from '../reconciliation-evidence-card/reconciliation-evidence-card';
import { InvestigationSession } from '../data-access/investigation-session';
import { SupplierInquiry } from '../supplier-inquiry/supplier-inquiry';

@Component({
  selector: 'app-investigation-page',
  imports: [RouterLink, CopilotPanel, ReconciliationEvidenceCard, SupplierInquiry],
  providers: [InvestigationSession],
  templateUrl: './investigation-page.html',
  styleUrl: './investigation-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestigationPage {
  protected readonly session = inject(InvestigationSession);
}
