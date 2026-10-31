import { Panel } from '../../../shared/ui/panel/panel';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvestigationEvidence } from '../investigation-evidence/investigation-evidence';
import { InvestigationAudit } from '../investigation-audit/investigation-audit';

@Component({
  selector: 'app-investigation-page',
  imports: [Panel, CurrencyPipe, RouterLink, InvestigationEvidence, InvestigationAudit],
  templateUrl: './investigation-page.html',
  styleUrl: './investigation-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestigationPage {
  protected readonly data = INVOICE_WORKSPACE_DATA;
}
