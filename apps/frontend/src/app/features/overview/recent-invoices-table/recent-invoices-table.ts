import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RecentInvoice } from '../overview-demo.data';

@Component({
  selector: 'app-recent-invoices-table',
  imports: [Panel, CurrencyPipe, RouterLink],
  templateUrl: './recent-invoices-table.html',
  styleUrl: './recent-invoices-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentInvoicesTable {
  readonly invoices = input.required<readonly RecentInvoice[]>();
}
