import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Draft,
  SuggestionDecisionBatch,
  SuggestionProposal,
  Validation,
} from '../data-access/intake-api';
import { SuggestionsPanel } from '../suggestions-panel/suggestions-panel';

@Component({
  selector: 'app-draft-editor',
  imports: [FormsModule, SuggestionsPanel],
  templateUrl: './draft-editor.html',
  styleUrl: './draft-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftEditor {
  readonly draft = input.required<Draft>();
  readonly step = input(2);
  readonly stepChange = output<number>();
  readonly documentId = input('');
  readonly validation = input.required<Validation>();
  readonly busy = input(false);
  readonly save = output<Draft>();
  readonly confirm = output<Draft>();
  readonly decide = output<SuggestionDecisionBatch>();
  protected readonly form = linkedSignal(() => structuredClone(this.draft()));

  protected applySuggestions(proposals: SuggestionProposal[]): void {
    this.form.update((draft) => {
      const updated = structuredClone(draft);
      for (const proposal of proposals) {
        Object.assign(updated, { [proposal.field]: structuredClone(proposal.value) });
      }

      return updated;
    });
  }

  protected addTotals(): void {
    this.form.update((draft) => ({
      ...draft,
      declaredTotals: { net: null, vat: null, gross: null },
    }));
  }

  protected removeTotals(): void {
    this.form.update((draft) => ({ ...draft, declaredTotals: null }));
  }

  protected addItem(): void {
    this.form.update((draft) => ({
      ...draft,
      items: [
        ...draft.items,
        { position: draft.items.length + 1, name: null, quantity: null, unitNet: null },
      ],
    }));
  }

  protected removeItem(index: number): void {
    this.form.update((draft) => ({
      ...draft,
      items: draft.items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, position: itemIndex + 1 })),
    }));
  }
}
