import { Panel } from '../../../shared/ui/panel/panel';
import { CurrencyPipe, formatCurrency } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';
import { InvoiceComparisonTable } from '../invoice-comparison-table/invoice-comparison-table';

@Component({
  selector: 'app-invoice-comparison',
  imports: [Panel, CurrencyPipe, InvoiceComparisonTable],

  templateUrl: './invoice-comparison.html',
  styleUrl: './invoice-comparison.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceComparison {
  readonly data = input.required<typeof INVOICE_WORKSPACE_DATA>();
  protected readonly itemHeaders = [
    'Item',
    'Qty',
    'Invoice unit',
    'PO unit',
    'Invoice net',
    'PO net',
  ];
  protected readonly totalHeaders = ['Totals', 'Invoice', 'Purchase order'];

  private money(value: number): string {
    return formatCurrency(value, 'en-US', 'PLN', 'PLN');
  }
  protected readonly itemRows = computed(() =>
    this.data().items.map((item) => [
      item.name,
      String(item.quantity),
      this.money(item.invoiceUnitNet),
      this.money(item.poUnitNet),
      this.money(item.invoiceNet),
      this.money(item.poNet),
    ]),
  );
  protected readonly totalRows = computed(() => {
    const data = this.data();
    return [
      ['Net', this.money(data.invoiceNet), this.money(data.poNet)],
      [`VAT ${data.invoice.vatRate}%`, this.money(data.invoiceVat), this.money(data.poVat)],
      ['Gross', this.money(data.invoiceGross), this.money(data.poGross)],
    ];
  });
}
