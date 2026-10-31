import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OverviewKpi } from '../overview-demo.data';

@Component({
  selector: 'app-overview-kpis',
  imports: [Panel],
  templateUrl: './overview-kpis.html',
  styleUrl: './overview-kpis.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewKpis {
  readonly kpis = input.required<readonly OverviewKpi[]>();
}
