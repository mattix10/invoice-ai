import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-invoice-comparison-table',
  templateUrl: './invoice-comparison-table.html',
  styleUrl: './invoice-comparison-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceComparisonTable {
  readonly label = input.required<string>();
  readonly headers = input.required<readonly string[]>();
  readonly rows = input.required<readonly (readonly string[])[]>();
}
