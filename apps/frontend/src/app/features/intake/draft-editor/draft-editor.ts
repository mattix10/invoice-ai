import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { protectPendingChanges } from '../../../core/navigation/pending-changes';
import { DraftFields } from '../draft-fields/draft-fields';
import { DraftItemsEditor } from '../draft-items-editor/draft-items-editor';
import { DraftSummary } from '../draft-summary/draft-summary';
import { FormsModule } from '@angular/forms';
import {
  Draft,
  SuggestionDecisionBatch,
  SuggestionProposal,
  Validation,
} from '../data-access/intake-api';
import { DraftValidation } from '../draft-validation/draft-validation';

@Component({
  selector: 'app-draft-editor',
  imports: [FormsModule, DraftFields, DraftItemsEditor, DraftSummary, DraftValidation],
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
  private readonly savedSnapshot = linkedSignal(() => JSON.stringify(this.draft()));

  constructor() {
    protectPendingChanges(() => this.hasPendingChanges());
  }

  hasPendingChanges(): boolean {
    return this.busy() || JSON.stringify(this.form()) !== this.savedSnapshot();
  }

  markSaved(draft: Draft): void {
    this.form.set(structuredClone(draft));
    this.savedSnapshot.set(JSON.stringify(draft));
  }

  protected patchDraft(patch: Partial<Draft>): void {
    this.form.update((draft) => ({ ...draft, ...patch }));
  }

  protected applySuggestions(proposals: SuggestionProposal[]): void {
    this.form.update((draft) => {
      const updated = structuredClone(draft);
      for (const proposal of proposals) {
        Object.assign(updated, { [proposal.field]: structuredClone(proposal.value) });
      }

      return updated;
    });
  }
}
