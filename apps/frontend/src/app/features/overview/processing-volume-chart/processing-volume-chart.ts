import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProcessingVolume } from '../overview-demo.data';

@Component({
  selector: 'app-processing-volume-chart',
  imports: [Panel],
  templateUrl: './processing-volume-chart.html',
  styleUrl: './processing-volume-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessingVolumeChart {
  readonly volume = input.required<readonly ProcessingVolume[]>();
  readonly chartLabel = input.required<string>();
  readonly note = input.required<{
    readonly period: string;
    readonly count: number;
    readonly annotation: string;
  }>();
}
