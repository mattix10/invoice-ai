import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { InvoiceApi } from '../../invoices/data-access/invoice-api';
import { summaryView } from '../../invoices/data-access/invoice-adapter';
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
  private readonly api = inject(InvoiceApi);
  protected readonly invoices = signal<ReturnType<typeof summaryView>[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly data = OVERVIEW_DEMO_DATA;
  protected readonly invoiceLink = ['/invoices', OVERVIEW_DEMO_DATA.invoice.id];
  protected readonly investigationLink = [...this.invoiceLink, 'investigation'];

  constructor() {
    this.load();
  }
  protected load() {
    this.state.set('loading');
    this.api.list().subscribe({
      next: (page) => {
        try {
          this.invoices.set(page.items.map(summaryView));
          this.state.set('ready');
        } catch {
          this.state.set('error');
        }
      },
      error: () => this.state.set('error'),
    });
  }
}
