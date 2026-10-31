import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Draft, Validation } from '../data-access/intake-api';
@Component({
  selector: 'app-draft-editor',
  imports: [FormsModule],
  templateUrl: './draft-editor.html',
  styleUrl: './draft-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftEditor {
  readonly draft = input.required<Draft>();
  readonly validation = input.required<Validation>();
  readonly busy = input(false);
  readonly save = output<Draft>();
  readonly confirm = output<Draft>();
  protected readonly form = linkedSignal(() => structuredClone(this.draft()));
  protected addTotals() {
    this.form.update((draft) => ({
      ...draft,
      declared_totals: { net: null, vat: null, gross: null },
    }));
  }
  protected removeTotals() {
    this.form.update((draft) => ({ ...draft, declared_totals: null }));
  }
  protected addItem() {
    this.form.update((d) => ({
      ...d,
      items: [
        ...d.items,
        { position: d.items.length + 1, name: null, quantity: null, unit_net: null },
      ],
    }));
  }
  protected removeItem(index: number) {
    this.form.update((d) => ({
      ...d,
      items: d.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 })),
    }));
  }
}
