import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { OverviewKpis } from '../overview-kpis/overview-kpis';
import { ProcessingVolumeChart } from '../processing-volume-chart/processing-volume-chart';
import { InvoiceStatusChart } from '../invoice-status-chart/invoice-status-chart';
import { RecentInvoicesTable } from '../recent-invoices-table/recent-invoices-table';
import { AttentionQueue } from '../attention-queue/attention-queue';

@Component({
  selector: 'app-overview-page',
  imports: [
    RouterLink,
    OverviewKpis,
    ProcessingVolumeChart,
    InvoiceStatusChart,
    RecentInvoicesTable,
    AttentionQueue,
  ],
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPage {
  protected readonly data = OVERVIEW_DEMO_DATA;
  protected readonly invoiceLink = ['/invoices', OVERVIEW_DEMO_DATA.invoice.id];
  protected readonly investigationLink = [...this.invoiceLink, 'investigation'];
}
