import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-draft-validation',
  imports: [],
  templateUrl: './draft-validation.html',
  styleUrl: './draft-validation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftValidation {
  readonly errors = input.required<string[]>();
  protected readonly labels: Record<string, string> = {
    vendor: 'Vendor',
    supplier_invoice_number: 'Invoice number',
    issued: 'Issue date',
    due: 'Due date',
    currency: 'Currency',
    vat_rate: 'VAT rate',
    items: 'Line items',
    declared_totals: 'Declared totals',
  };
}
