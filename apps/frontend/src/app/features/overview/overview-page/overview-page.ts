import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InvoiceApi } from '../../invoices/data-access/invoice-api';
import { summaryView } from '../../invoices/data-access/invoice-adapter';
import { RouterLink } from '@angular/router';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { OverviewKpis } from '../overview-kpis/overview-kpis';
import { ProcessingVolumeChart } from '../processing-volume-chart/processing-volume-chart';
import { InvoiceStatusChart } from '../invoice-status-chart/invoice-status-chart';
import { RecentInvoicesTable } from '../recent-invoices-table/recent-invoices-table';
import { AttentionQueue } from '../attention-queue/attention-queue';

const NEXT_REVIEW_QUERY = { status: 'needs_review', page_size: 1, sort: '-id' } as const;

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
  private readonly invoiceApi = inject(InvoiceApi);
  protected readonly recentInvoices = this.invoiceApi.invoiceListResource({}, (invoicePage) =>
    invoicePage.items.map(summaryView),
  );
  protected readonly nextInvoiceForReview = this.invoiceApi.invoiceListResource(
    NEXT_REVIEW_QUERY,
    (invoicePage) => invoicePage.items[0]?.id ?? null,
  );
  protected readonly demoOverview = OVERVIEW_DEMO_DATA;
  protected readonly investigationLink = [
    '/invoices',
    OVERVIEW_DEMO_DATA.invoice.id,
    'investigation',
  ];
}
