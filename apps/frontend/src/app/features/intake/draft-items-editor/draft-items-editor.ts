import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { Draft, DraftItem } from '../data-access/intake-api';
import { lineNet, formatVatRate } from '../data-access/intake-money';

@Component({
  selector: 'app-draft-items-editor',
  imports: [FormsModule],
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(NgForm, { optional: true, skipSelf: true }),
    },
  ],
  templateUrl: './draft-items-editor.html',
  styleUrl: './draft-items-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftItemsEditor {
  readonly draft = input.required<Draft>();
  readonly changed = output<Partial<Draft>>();
  protected readonly lineNet = lineNet;
  protected readonly formatVatRate = formatVatRate;

  protected changeItem(index: number, patch: Partial<DraftItem>): void {
    this.changed.emit({
      items: this.draft().items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  protected changeTotals(field: 'net' | 'vat' | 'gross', value: string): void {
    const totals = this.draft().declaredTotals;
    if (totals) this.changed.emit({ declaredTotals: { ...totals, [field]: value } });
  }

  protected addItem(): void {
    const items = this.draft().items;
    const position = Math.max(0, ...items.map((item) => item.position ?? 0)) + 1;
    if (items.length >= 1000 || position > 2147483647) return;
    this.changed.emit({
      items: [...items, { position, name: null, quantity: null, unitNet: null }],
    });
  }

  protected removeItem(index: number): void {
    this.changed.emit({ items: this.draft().items.filter((_, i) => i !== index) });
  }

  protected addTotals(): void {
    this.changed.emit({ declaredTotals: { net: null, vat: null, gross: null } });
  }

  protected removeTotals(): void {
    this.changed.emit({ declaredTotals: null });
  }
}
