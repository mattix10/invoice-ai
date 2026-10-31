import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { InvoiceStatus } from '../overview-demo.data';

@Component({
  selector: 'app-invoice-status-chart',
  imports: [Panel],
  templateUrl: './invoice-status-chart.html',
  styleUrl: './invoice-status-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceStatusChart {
  readonly statuses = input.required<readonly InvoiceStatus[]>();
  readonly chartLabel = input.required<string>();
}
