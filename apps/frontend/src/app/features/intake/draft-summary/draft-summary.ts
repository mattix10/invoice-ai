import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Draft, Validation } from '../data-access/intake-api';
import { lineNet, formatVatRate } from '../data-access/intake-money';

@Component({
  selector: 'app-draft-summary',
  imports: [],

  templateUrl: './draft-summary.html',
  styleUrl: './draft-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftSummary {
  readonly draft = input.required<Draft>();
  readonly validation = input.required<Validation>();
  readonly stepChange = output<number>();
  protected readonly lineNet = lineNet;
  protected readonly formatVatRate = formatVatRate;
}
